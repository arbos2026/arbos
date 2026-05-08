import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';

const OtpSendSchema = z.object({ phone: z.string().regex(/^\+?\d{10,15}$/) });
const OtpVerifySchema = z.object({ phone: z.string(), code: z.string().length(6) });
const RefreshSchema = z.object({ refresh_token: z.string().min(1) });

function generateOTP() { return process.env.NODE_ENV === 'development' ? '123456' : crypto.randomInt(100000, 999999).toString(); }
function generateRefreshToken() { return crypto.randomBytes(40).toString('hex'); }

async function sendSMS(phone: string, code: string) {
  if (process.env.NODE_ENV === 'development') { console.log(`📱 OTP for ${phone}: ${code}`); return; }
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  fastify.post('/otp/send', async (req, reply) => {
    const body = OtpSendSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation', message: body.error.issues[0]?.message });
    const { phone } = body.data;
    const recent = await prisma.oTPCode.count({ where: { phone, created_at: { gte: new Date(Date.now() - 10*60*1000) }, used: false } });
    if (recent >= 3) return reply.code(429).send({ error: 'TooManyRequests', message: 'Слишком много запросов' });
    const code = generateOTP();
    await prisma.oTPCode.create({ data: { phone, code, expires_at: new Date(Date.now() + 5*60*1000) } });
    await sendSMS(phone, code);
    return { success: true, expires_in: 300 };
  });

  fastify.post('/otp/verify', async (req, reply) => {
    const body = OtpVerifySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation', message: body.error.issues[0]?.message });
    const { phone, code } = body.data;
    const otp = await prisma.oTPCode.findFirst({ where: { phone, used: false, expires_at: { gte: new Date() } }, orderBy: { created_at: 'desc' } });
    if (!otp) return reply.code(400).send({ error: 'InvalidOTP', message: 'OTP истёк или не найден' });
    if (otp.attempts >= 3) { await prisma.oTPCode.update({ where: { id: otp.id }, data: { used: true } }); return reply.code(400).send({ error: 'TooManyAttempts' }); }
    if (otp.code !== code) { await prisma.oTPCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } }); return reply.code(400).send({ error: 'InvalidOTP', message: 'Неверный код' }); }
    await prisma.oTPCode.update({ where: { id: otp.id }, data: { used: true } });
    let user = await prisma.user.findUnique({ where: { phone } });
    const isNew = !user;
    if (!user) {
      user = await prisma.user.create({ data: { phone, is_verified: true, referral_code: crypto.randomBytes(6).toString('hex') } });
      await prisma.notification.create({ data: { user_id: user.id, type: 'WELCOME', title: 'Добро пожаловать в ArbOS!', body: 'Расскажи нам о себе.', channels: ['IN_APP'] } });
    }
    const refreshToken = generateRefreshToken();
    await prisma.session.create({ data: { user_id: user.id, refresh_token: refreshToken, ip_address: req.ip, user_agent: req.headers['user-agent'], expires_at: new Date(Date.now() + 30*24*60*60*1000) } });
    const accessToken = fastify.jwt.sign({ sub: user.id, phone: user.phone, plan: user.plan });
    return { access_token: accessToken, refresh_token: refreshToken, user: { id: user.id, phone: user.phone, name: user.name, plan: user.plan, onboarding_done: user.onboarding_done }, is_new: isNew };
  });

  fastify.post('/refresh', async (req, reply) => {
    const body = RefreshSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation' });
    const session = await prisma.session.findUnique({ where: { refresh_token: body.data.refresh_token }, include: { user: true } });
    if (!session || session.expires_at < new Date()) return reply.code(401).send({ error: 'Unauthorized', message: 'Refresh token истёк' });
    const newRefresh = generateRefreshToken();
    await prisma.session.update({ where: { id: session.id }, data: { refresh_token: newRefresh, expires_at: new Date(Date.now() + 30*24*60*60*1000) } });
    const accessToken = fastify.jwt.sign({ sub: session.user.id, phone: session.user.phone, plan: session.user.plan });
    return { access_token: accessToken, refresh_token: newRefresh };
  });

  fastify.delete('/logout', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const body = req.body as { refresh_token?: string };
    if (body?.refresh_token) await prisma.session.deleteMany({ where: { refresh_token: body.refresh_token } });
    return reply.code(204).send();
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
const OnboardingSchema = z.object({
  capital_range: z.enum(['UNDER_500','RANGE_500_2K','RANGE_2K_10K','OVER_10K']),
  city: z.string().min(1), country: z.string().length(2),
  categories: z.array(z.string()).min(1).max(5),
  experience_level: z.enum(['BEGINNER','INTERMEDIATE','EXPERT']),
  risk_profile: z.enum(['CONSERVATIVE','MODERATE','AGGRESSIVE']),
});
export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req) => prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } }));
  fastify.put('/me', { preHandler: [fastify.authenticate] }, async (req) => prisma.user.update({ where: { id: req.user.sub }, data: req.body as any }));
  fastify.post('/me/onboarding', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const body = OnboardingSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation', message: body.error.issues[0]?.message });
    const { categories, ...rest } = body.data;
    return { success: true, user: await prisma.user.update({ where: { id: req.user.sub }, data: { ...rest, preferred_cats: categories, onboarding_done: true } }) };
  });
  fastify.get('/me/stats', { preHandler: [fastify.authenticate] }, async (req) => {
    const [total, completed, agg] = await Promise.all([
      prisma.tradeJournalEntry.count({ where: { user_id: req.user.sub } }),
      prisma.tradeJournalEntry.count({ where: { user_id: req.user.sub, status: 'SOLD' } }),
      prisma.tradeJournalEntry.aggregate({ where: { user_id: req.user.sub, status: 'SOLD' }, _sum: { profit: true }, _avg: { roi_actual: true } }),
    ]);
    return { total_deals: total, completed_deals: completed, total_profit_usd: agg._sum.profit ?? 0, avg_roi: agg._avg.roi_actual ?? 0 };
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ChatSchema = z.object({ session_id: z.string().optional(), message: z.string().min(1).max(2000) });
export const coachRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  fastify.post('/chat', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const body = ChatSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error:'Validation', message:body.error.issues[0]?.message });
    const user = await prisma.user.findUniqueOrThrow({ where:{ id:req.user.sub } });
    const session = body.data.session_id ? await prisma.aICoachSession.findFirst({ where:{ id:body.data.session_id, user_id:req.user.sub } }) : null;
    const history: Array<{ role:'user'|'assistant'; content:string }> = session ? (session.messages as any) : [];
    history.push({ role:'user', content:body.data.message });
    const system = `Ты — Deal AI Coach ArbOS. Профиль: тариф ${user.plan}, опыт ${user.experience_level}, риск ${user.risk_profile}. Давай конкретные советы на русском языке, до 300 слов.`;
    reply.raw.setHeader('Content-Type','text/event-stream');
    reply.raw.setHeader('Cache-Control','no-cache');
    reply.raw.setHeader('Connection','keep-alive');
    const stream = await anthropic.messages.stream({ model:'claude-sonnet-4-20250514', max_tokens:1000, system, messages:history });
    let msg = '';
    for await (const chunk of stream) {
      if (chunk.type==='content_block_delta' && chunk.delta.type==='text_delta') { msg += chunk.delta.text; reply.raw.write(`data: ${JSON.stringify({ text:chunk.delta.text })}\n\n`); }
    }
    history.push({ role:'assistant', content:msg });
    const usage = await stream.finalUsage();
    if (session) {
      await prisma.aICoachSession.update({ where:{ id:session.id }, data:{ messages:history as any, total_tokens:{ increment:usage.input_tokens+usage.output_tokens } } });
      reply.raw.write(`data: ${JSON.stringify({ session_id:session.id, done:true })}\n\n`);
    } else {
      const s = await prisma.aICoachSession.create({ data:{ user_id:req.user.sub, messages:history as any, total_tokens:usage.input_tokens+usage.output_tokens } });
      reply.raw.write(`data: ${JSON.stringify({ session_id:s.id, done:true })}\n\n`);
    }
    reply.raw.end();
  });
  fastify.get('/sessions', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req) => {
    return { data: await prisma.aICoachSession.findMany({ where:{ user_id:req.user.sub }, orderBy:{ updated_at:'desc' }, take:20, select:{ id:true, created_at:true, updated_at:true, total_tokens:true } }) };
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AnalyzeSchema = z.object({
  budget_usd: z.number().min(100), city: z.string().min(1), country: z.string().length(2),
  categories: z.array(z.string()).min(1), max_days: z.number().min(7),
  risk_profile: z.enum(['CONSERVATIVE','MODERATE','AGGRESSIVE']),
});
export const navigatorRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  fastify.post('/analyze', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const body = AnalyzeSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error:'Validation', message:body.error.issues[0]?.message });
    const { budget_usd, city, country, categories, max_days, risk_profile } = body.data;
    const windows = await prisma.arbitrageWindow.findMany({ where:{ is_active:true, product:{ category_id:{ in:categories } } }, orderBy:{ margin_pct:'desc' }, take:10, include:{ product:{ include:{ category:true } } } });
    const routes = await prisma.logisticsRoute.findMany({ where:{ to_country:country, is_active:true } });
    reply.raw.setHeader('Content-Type','text/event-stream');
    reply.raw.setHeader('Cache-Control','no-cache');
    reply.raw.setHeader('Connection','keep-alive');
    const stream = await anthropic.messages.stream({
      model:'claude-sonnet-4-20250514', max_tokens:1000,
      system:'Ты — Deal Navigator ArbOS. Давай конкретные торговые рекомендации на русском языке. До 400 слов.',
      messages:[{ role:'user', content:`Бюджет: $${budget_usd}, Локация: ${city} ${country}, Риск: ${risk_profile}, Срок: ${max_days} дней\n\nОкна рынка:\n${windows.map((w:any) => `${w.product?.name_ru}: ${w.margin_pct}% маржи, ${w.buy_country}→${w.sell_marketplace}`).join('\n')}\n\nЛогистика:\n${routes.map(r => `${r.from_country}→${r.to_country}: $${r.cost_per_kg}/кг`).join('\n')}\n\nДай топ-3 рекомендации с расчётами.` }],
    });
    for await (const chunk of stream) {
      if (chunk.type==='content_block_delta' && chunk.delta.type==='text_delta') reply.raw.write(`data: ${JSON.stringify({ text:chunk.delta.text })}\n\n`);
    }
    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
  });
};

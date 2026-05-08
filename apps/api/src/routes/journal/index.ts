import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
const RATES: Record<string,number> = { USD:1, KZT:1/450, KGS:1/87.5, UZS:1/12700, CNY:1/7.25, RUB:1/89 };
const CreateSchema = z.object({
  product_id: z.string(), product_name: z.string().min(1),
  supplier_name: z.string().optional(),
  buy_price: z.number().positive(),
  buy_currency: z.enum(['USD','KZT','KGS','UZS','CNY','RUB']).default('USD'),
  quantity: z.number().positive(),
  unit: z.enum(['KG','TONNE','PCS','BOX','SET','LITRE']).default('KG'),
  logistics_cost: z.number().optional(), customs_cost: z.number().optional(),
  platform_fee: z.number().optional(), planned_margin_pct: z.number().optional(),
  notes: z.string().optional(),
});
const UpdateSchema = z.object({
  sell_price: z.number().optional(),
  sell_currency: z.enum(['USD','KZT','KGS','UZS','CNY','RUB']).optional(),
  status: z.enum(['PLANNED','ORDERED','PAID','SHIPPED','RECEIVED','LISTED','SOLD','CANCELLED']).optional(),
  notes: z.string().optional(),
});
const StageSchema = z.object({
  status: z.enum(['ORDERED','PAID','SHIPPED','RECEIVED','LISTED','SOLD','CANCELLED']),
  notes: z.string().optional(),
});
export const journalRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  fastify.get('/', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req) => {
    return { data: await prisma.tradeJournalEntry.findMany({ where:{ user_id:req.user.sub }, orderBy:{ created_at:'desc' }, include:{ stages:{ orderBy:{ occurred_at:'asc' } } } }) };
  });
  fastify.post('/', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const body = CreateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error:'Validation', message:body.error.issues[0]?.message });
    const buyUsd = body.data.buy_price * (RATES[body.data.buy_currency] ?? 1);
    return reply.code(201).send(await prisma.tradeJournalEntry.create({ data:{ user_id:req.user.sub, ...body.data, buy_price_usd:buyUsd, stages:{ create:[{ status:'PLANNED' }] } }, include:{ stages:true } }));
  });
  fastify.get('/:id', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const { id } = req.params as { id:string };
    const e = await prisma.tradeJournalEntry.findFirst({ where:{ id, user_id:req.user.sub }, include:{ stages:{ orderBy:{ occurred_at:'asc' } }, product:true } });
    if (!e) return reply.code(404).send({ error:'NotFound' });
    return e;
  });
  fastify.put('/:id', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const { id } = req.params as { id:string };
    const body = UpdateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error:'Validation', message:body.error.issues[0]?.message });
    const existing = await prisma.tradeJournalEntry.findFirst({ where:{ id, user_id:req.user.sub } });
    if (!existing) return reply.code(404).send({ error:'NotFound' });
    const update: any = { ...body.data };
    if (body.data.sell_price && body.data.sell_currency) {
      const sellUsd = body.data.sell_price * (RATES[body.data.sell_currency] ?? 1);
      const cost = Number(existing.buy_price_usd)*Number(existing.quantity) + Number(existing.logistics_cost??0) + Number(existing.customs_cost??0) + Number(existing.platform_fee??0);
      const rev = sellUsd * Number(existing.quantity);
      Object.assign(update, { sell_price_usd:sellUsd, total_investment:cost, total_revenue:rev, profit:rev-cost, roi_actual:cost>0?((rev-cost)/cost)*100:0 });
    }
    return prisma.tradeJournalEntry.update({ where:{ id }, data:update, include:{ stages:true } });
  });
  fastify.delete('/:id', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const { id } = req.params as { id:string };
    if (!await prisma.tradeJournalEntry.findFirst({ where:{ id, user_id:req.user.sub } })) return reply.code(404).send({ error:'NotFound' });
    await prisma.tradeJournalEntry.delete({ where:{ id } });
    return reply.code(204).send();
  });
  fastify.post('/:id/stage', { preHandler: [fastify.requirePlan('SCOUT')] }, async (req, reply) => {
    const { id } = req.params as { id:string };
    const body = StageSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error:'Validation', message:body.error.issues[0]?.message });
    if (!await prisma.tradeJournalEntry.findFirst({ where:{ id, user_id:req.user.sub } })) return reply.code(404).send({ error:'NotFound' });
    await prisma.$transaction([prisma.journalStage.create({ data:{ entry_id:id, ...body.data } }), prisma.tradeJournalEntry.update({ where:{ id }, data:{ status:body.data.status } })]);
    return prisma.tradeJournalEntry.findUnique({ where:{ id }, include:{ stages:{ orderBy:{ occurred_at:'asc' } } } });
  });
};

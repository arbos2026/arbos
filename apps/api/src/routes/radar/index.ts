import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
const Q = z.object({
  category_id: z.string().optional(), min_margin: z.coerce.number().optional(),
  max_risk: z.coerce.number().optional(), confidence: z.string().optional(),
  sell_marketplace: z.string().optional(), buy_country: z.string().optional(),
  sort: z.enum(['margin','roi','risk','updated']).default('margin'),
  page: z.coerce.number().default(1), limit: z.coerce.number().min(1).max(50).default(20),
});
export const radarRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const q = Q.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'Validation' });
    const { category_id, min_margin, max_risk, confidence, sell_marketplace, buy_country, sort, page, limit } = q.data;
    const planLimits: Record<string,number> = { FREE: 3, SCOUT: 15 };
    const eff = planLimits[req.user.plan] ? Math.min(limit, planLimits[req.user.plan]!) : limit;
    const confList = confidence?.split(',') as any[] | undefined;
    const where: any = { is_active: true,
      ...(category_id && { product: { category_id } }),
      ...(min_margin !== undefined && { margin_pct: { gte: min_margin } }),
      ...(max_risk !== undefined && { risk_score: { lte: max_risk } }),
      ...(confList && { confidence: { in: confList } }),
      ...(sell_marketplace && { sell_marketplace }),
      ...(buy_country && { buy_country }),
    };
    const orderBy: any = { margin:{margin_pct:'desc'}, roi:{roi:'desc'}, risk:{risk_score:'asc'}, updated:{calculated_at:'desc'} }[sort];
    const [windows, total] = await Promise.all([
      prisma.arbitrageWindow.findMany({ where, orderBy, skip:(page-1)*eff, take:eff, include:{ product:{ include:{ category:true } } } }),
      prisma.arbitrageWindow.count({ where }),
    ]);
    return { data: windows, total, page, limit: eff, has_more: page*eff < total };
  });
  fastify.get('/trending', { preHandler: [fastify.authenticate] }, async () => {
    return { data: await prisma.arbitrageWindow.findMany({ where:{ is_active:true, confidence:{ in:['LIVE','FRESH'] }, margin_pct:{ gte:30 } }, orderBy:{ margin_pct:'desc' }, take:10, include:{ product:{ include:{ category:true } } } }) };
  });
  fastify.get('/categories', { preHandler: [fastify.authenticate] }, async () => {
    return prisma.category.findMany({ where:{ parent_id:null }, orderBy:{ sort_order:'asc' }, include:{ children:true } });
  });
  fastify.get('/:productId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const product = await prisma.product.findUnique({ where:{ id:productId }, include:{ category:true, arb_windows:{ where:{ is_active:true }, orderBy:{ margin_pct:'desc' } }, prices:{ orderBy:{ updated_at:'desc' }, take:20, include:{ supplier:true } } } });
    if (!product) return reply.code(404).send({ error:'NotFound' });
    return product;
  });
};

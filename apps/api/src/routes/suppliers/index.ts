import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
const Q = z.object({ category: z.string().optional(), country: z.string().optional(), page: z.coerce.number().default(1), limit: z.coerce.number().default(20) });
export const suppliersRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const q = Q.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error:'Validation' });
    const where: any = { ...(q.data.country && { country:q.data.country }), ...(q.data.category && { category_links:{ some:{ category:{ slug:q.data.category } } } }) };
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy:[{ plan:'desc' },{ rating:'desc' }], skip:(q.data.page-1)*q.data.limit, take:q.data.limit, include:{ category_links:{ include:{ category:true } } } }),
      prisma.supplier.count({ where }),
    ]);
    const free = req.user.plan === 'FREE';
    return { data: suppliers.map(s => ({ ...s, contact_phone:free?null:s.contact_phone, contact_email:free?null:s.contact_email, telegram_id:free?null:s.telegram_id?.toString() })), total };
  });
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id:string };
    const s = await prisma.supplier.findUnique({ where:{ id }, include:{ category_links:{ include:{ category:true } }, reviews:{ take:10 } } });
    if (!s) return reply.code(404).send({ error:'NotFound' });
    await prisma.supplier.update({ where:{ id }, data:{ weekly_views:{ increment:1 } } });
    const free = req.user.plan === 'FREE';
    return { ...s, contact_phone:free?null:s.contact_phone, contact_locked:free };
  });
};

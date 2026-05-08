import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { Plan } from '@arbos/types';
export interface JWTPayload { sub: string; phone: string; plan: Plan; iat: number; exp: number; }
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePlan: (minPlan: Plan) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest { user: JWTPayload; }
}
const PLAN_ORDER: Plan[] = ['FREE', 'SCOUT', 'PRO', 'EXPERT'];
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify(); } catch { reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' }); }
  });
  fastify.decorate('requirePlan', (minPlan: Plan) => async (req: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(req, reply);
    if (PLAN_ORDER.indexOf(req.user.plan) < PLAN_ORDER.indexOf(minPlan)) {
      reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: `Требуется тариф ${minPlan} или выше`, required_plan: minPlan });
    }
  });
};
export default fp(authPlugin, { name: 'auth' });
export { authPlugin };

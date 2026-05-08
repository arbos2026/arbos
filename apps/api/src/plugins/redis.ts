import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Redis } from 'ioredis';
declare module 'fastify' { interface FastifyInstance { redis: Redis; } }
const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 3, lazyConnect: true });
  await redis.connect();
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => { await redis.quit(); });
};
export default fp(redisPlugin, { name: 'redis' });
export { redisPlugin };

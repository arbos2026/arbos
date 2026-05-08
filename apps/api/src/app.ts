import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth/index.js';
import { usersRoutes } from './routes/users/index.js';
import { radarRoutes } from './routes/radar/index.js';
import { navigatorRoutes } from './routes/navigator/index.js';
import { suppliersRoutes } from './routes/suppliers/index.js';
import { productsRoutes } from './routes/products/index.js';
import { pricesRoutes } from './routes/prices/index.js';
import { arbitrageRoutes } from './routes/arbitrage/index.js';
import { journalRoutes } from './routes/journal/index.js';
import { alertsRoutes } from './routes/alerts/index.js';
import { coachRoutes } from './routes/coach/index.js';
import { schoolRoutes } from './routes/school/index.js';
import { notificationsRoutes } from './routes/notifications/index.js';
import { subscriptionsRoutes } from './routes/subscriptions/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { internalRoutes } from './routes/internal/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    },
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'], credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(jwt, { secret: process.env.JWT_SECRET!, sign: { expiresIn: '15m' } });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes,          { prefix: '/auth' });
  await app.register(usersRoutes,         { prefix: '/users' });
  await app.register(radarRoutes,         { prefix: '/radar' });
  await app.register(navigatorRoutes,     { prefix: '/navigator' });
  await app.register(suppliersRoutes,     { prefix: '/suppliers' });
  await app.register(productsRoutes,      { prefix: '/products' });
  await app.register(pricesRoutes,        { prefix: '/prices' });
  await app.register(arbitrageRoutes,     { prefix: '/arbitrage' });
  await app.register(journalRoutes,       { prefix: '/journal' });
  await app.register(alertsRoutes,        { prefix: '/alerts' });
  await app.register(coachRoutes,         { prefix: '/coach' });
  await app.register(schoolRoutes,        { prefix: '/school' });
  await app.register(notificationsRoutes, { prefix: '/notifications' });
  await app.register(subscriptionsRoutes, { prefix: '/subscriptions' });
  await app.register(adminRoutes,         { prefix: '/admin' });
  await app.register(internalRoutes,      { prefix: '/internal' });
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
  return app;
}

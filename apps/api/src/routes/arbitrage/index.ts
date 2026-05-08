import type { FastifyPluginAsync } from "fastify";
export const arbitrageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "arbitrage - in progress" };
  });
};

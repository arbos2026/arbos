import type { FastifyPluginAsync } from "fastify";
export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "alerts - in progress" };
  });
};

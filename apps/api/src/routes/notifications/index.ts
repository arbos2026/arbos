import type { FastifyPluginAsync } from "fastify";
export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "notifications - in progress" };
  });
};

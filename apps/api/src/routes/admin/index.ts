import type { FastifyPluginAsync } from "fastify";
export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "admin - in progress" };
  });
};

import type { FastifyPluginAsync } from "fastify";
export const internalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "internal - in progress" };
  });
};

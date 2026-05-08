import type { FastifyPluginAsync } from "fastify";
export const pricesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "prices - in progress" };
  });
};

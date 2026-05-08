import type { FastifyPluginAsync } from "fastify";
export const schoolRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "school - in progress" };
  });
};

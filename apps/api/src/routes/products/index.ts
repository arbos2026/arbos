import type { FastifyPluginAsync } from "fastify";
export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate] }, async () => {
    return { data: [], message: "products - in progress" };
  });
};

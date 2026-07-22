import { appRouter, createTRPCContext } from "@repo/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: request.headers }),
  });
}

export { handler as GET, handler as POST };

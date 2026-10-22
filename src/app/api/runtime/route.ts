import { createNextRuntimeProtocolRouteHandler } from "@ontahi/runtime-nextjs/runtime-protocol";

import { localRuntimeProtocolDispatcher } from "@/application/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createNextRuntimeProtocolRouteHandler({
  dispatcher: localRuntimeProtocolDispatcher,
  context: async () => ({ principal: null }),
});

import { createNextRuntimeProtocolRouteHandler } from "@ontahi/runtime-nextjs/runtime-protocol";

import { localRuntimeProtocolDispatcher } from "@/application/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const participantTokenFromReferer = (referer: string | null) => {
  if (!referer) return undefined;
  try {
    return new URL(referer).pathname.match(/^\/p\/([^/]+)/)?.[1];
  } catch {
    return undefined;
  }
};

export const POST = createNextRuntimeProtocolRouteHandler({
  dispatcher: localRuntimeProtocolDispatcher,
  context: async (request) => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const participantSessionIds = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((cookie) => cookie.trim().split("=").map(decodeURIComponent))
      .filter(([name, value]) => name.startsWith("bartlett_session_") && value)
      .map(([, value]) => value);
    const participantPublicToken = participantTokenFromReferer(
      request.headers.get("referer"),
    );

    return {
      principal: user
        ? { subject: user.id, kind: "user" as const, issuer: "supabase" }
        : null,
      participantSessionIds,
      participantPublicToken,
      cacheScope: user
        ? ["admin", user.id]
        : [
            "participant",
            participantPublicToken ?? "unknown",
            ...participantSessionIds.sort(),
          ],
    };
  },
});

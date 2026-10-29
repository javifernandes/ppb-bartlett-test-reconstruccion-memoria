import { createNextRuntimeProtocolRouteHandler } from "@ontahi/runtime-nextjs/runtime-protocol";
import { query } from "@ontahi/core/data-graph";

import { localRuntimeProtocolDispatcher } from "@/application/runtime";
import { BartlettApplication, ResultShare } from "@/application/graph";
import {
  participantRequestMetadataFromRequest,
  participantRequestMetadataResourceKey,
} from "@/application/participant-request-metadata";
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

const resultShareTokenFromReferer = (referer: string | null) => {
  if (!referer) return undefined;
  try {
    return new URL(referer).pathname.match(/^\/r\/([^/]+)/)?.[1];
  } catch {
    return undefined;
  }
};

const referenceId = (value: unknown) => {
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "locator" in value &&
    typeof value.locator === "object" &&
    value.locator !== null &&
    "id" in value.locator
  ) {
    return String(value.locator.id);
  }
  return undefined;
};

export const POST = createNextRuntimeProtocolRouteHandler({
  dispatcher: localRuntimeProtocolDispatcher,
  context: async (request) => {
    const demoMode = process.env.SEED_DEMO_DATA === "true";
    const authConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const user =
      demoMode || !authConfigured
        ? { id: "local-demo-admin" }
        : (await (await createSupabaseServerClient()).auth.getUser()).data.user;
    const participantSessionIds = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((cookie) => cookie.trim().split("=").map(decodeURIComponent))
      .filter(([name, value]) => name.startsWith("bartlett_session_") && value)
      .map(([, value]) => value);
    const participantPublicToken = participantTokenFromReferer(
      request.headers.get("referer"),
    );
    const resultShareToken = resultShareTokenFromReferer(
      request.headers.get("referer"),
    );
    const resultShare = resultShareToken
      ? (
          await BartlettApplication.graph.read(
            query(ResultShare).where((share) => share.id.eq(resultShareToken)),
            { scope: `public-result-share.${resultShareToken}` },
          )
        ).find((share) => share.status === "active")
      : undefined;
    const resultShareAuthority = resultShare
      ? {
          token: resultShare.id,
          sessionId: referenceId(resultShare.session)!,
        }
      : undefined;

    return {
      principal: user
        ? { subject: user.id, kind: "user" as const, issuer: "supabase" }
        : null,
      participantSessionIds,
      participantPublicToken,
      resultShare: resultShareAuthority,
      resources: new Map([
        [
          participantRequestMetadataResourceKey,
          participantRequestMetadataFromRequest(request),
        ],
      ]),
      cacheScope: user
        ? ["admin", user.id]
        : [
            "participant",
            participantPublicToken ?? "unknown",
            resultShareAuthority?.token ?? "no-result-share",
            ...participantSessionIds.sort(),
          ],
    };
  },
});

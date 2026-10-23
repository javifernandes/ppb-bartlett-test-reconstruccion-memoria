import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const updateSupabaseSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const runtimeOrPublicRoute =
    pathname.startsWith("/api/runtime") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/p/");

  // The runtime route resolves its own authority, while auth callbacks and
  // participant pages are public. Avoid a second concurrent getUser call for
  // every graph request, especially immediately after an OAuth callback.
  if (runtimeOrPublicRoute) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const publicRoute = pathname === "/login";

  if (!user && !publicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname !== "/" || request.nextUrl.search) {
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    } else {
      loginUrl.search = "";
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  return response;
};

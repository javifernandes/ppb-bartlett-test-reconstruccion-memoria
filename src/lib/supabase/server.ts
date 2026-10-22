import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL.");
  return value;
};

const supabasePublishableKey = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return value;
};

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them.
        }
      },
    },
  });
};

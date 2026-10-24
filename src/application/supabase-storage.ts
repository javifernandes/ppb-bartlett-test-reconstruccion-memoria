import {
  createSupabaseDataGraphStorage,
  supabaseNaming,
} from "@ontahi/supabase/data-graph";
import { createClient } from "@supabase/supabase-js";

const requiredEnvironmentVariable = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} para usar persistencia Supabase.`);
  return value;
};

export const createSupabaseBartlettStorage = () => {
  const client = createClient(
    requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironmentVariable("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return createSupabaseDataGraphStorage({
    client,
    naming: supabaseNaming.snakeCase(),
    createError: ({ message, cause }) =>
      new Error(message, { cause: cause instanceof Error ? cause : undefined }),
  });
};

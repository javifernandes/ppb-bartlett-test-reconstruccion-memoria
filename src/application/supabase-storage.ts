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

const dataGraphEnvironmentVariable = (
  specificName: string,
  fallbackName: string,
) =>
  process.env[specificName]?.trim() ||
  requiredEnvironmentVariable(fallbackName);

export const createSupabaseBartlettStorage = () => {
  const client = createClient(
    dataGraphEnvironmentVariable(
      "DATA_GRAPH_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    dataGraphEnvironmentVariable(
      "DATA_GRAPH_SUPABASE_SECRET_KEY",
      "SUPABASE_SECRET_KEY",
    ),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return createSupabaseDataGraphStorage({
    client,
    naming: supabaseNaming.snakeCase(),
    overrides: {
      RecallAnalysis: { table: "recall_analyses" },
    },
    createError: ({ message, cause }) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Supabase data graph storage error", { message, cause });
      }

      return new Error(message, {
        cause: cause instanceof Error ? cause : undefined,
      });
    },
  });
};

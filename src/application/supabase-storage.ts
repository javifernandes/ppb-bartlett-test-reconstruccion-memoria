import type {
  AnyEntityDefinition,
  DataGraphDefaultStorage,
} from "@ontahi/core/data-graph";
import {
  applySupabaseDataGraphMappings,
  createSupabaseDataGraphRuntime,
  createSupabaseReflectedEntityDataReader,
  supabaseNaming,
} from "@ontahi/supabase/data-graph";
import { createClient } from "@supabase/supabase-js";
import { Effect } from "effect";

const requiredEnvironmentVariable = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} para usar persistencia Supabase.`);
  return value;
};

export const createSupabaseBartlettStorage = (
  entities: readonly AnyEntityDefinition[],
) => {
  applySupabaseDataGraphMappings({
    entities,
    naming: supabaseNaming.snakeCase(),
  });

  const client = createClient(
    requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironmentVariable("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const runtime = createSupabaseDataGraphRuntime({
    getReadClient: () => Effect.succeed(client),
    getCommandClient: () => Effect.succeed(client),
    createError: ({ message, cause }) =>
      new Error(message, { cause: cause instanceof Error ? cause : undefined }),
    entities,
  });
  const reflected = createSupabaseReflectedEntityDataReader({
    entities,
    getClient: () => client,
  });

  return {
    createRuntime: () => runtime,
    readEntityData: reflected.readEntityData,
  } satisfies DataGraphDefaultStorage<typeof runtime>;
};

import { createInMemoryDataGraphStorage } from "@ontahi/core/data-graph";
import { inProcessTasks, ontahi } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";
import { RecallAnalysis } from "./recall-analysis";
import { createBartlettSeed } from "./seed";
import { createSupabaseBartlettStorage } from "./supabase-storage";

const demoEnabled = process.env.SEED_DEMO_DATA === "true";
const useSupabaseStorage =
  process.env.NODE_ENV !== "test" &&
  !demoEnabled &&
  process.env.DATA_GRAPH_PROVIDER === "supabase";

const createBartlettApplication = () => {
  const entities = [
    Experiment,
    ParticipantSession,
    AnalysisRun,
    RecallAnalysis,
  ] as const;
  const inMemoryStorage = createInMemoryDataGraphStorage({
    dataset: createBartlettSeed(demoEnabled),
  });

  return ontahi({
    storage: useSupabaseStorage
      ? createSupabaseBartlettStorage()
      : inMemoryStorage,
    tasks: inProcessTasks(),
    entities,
  });
};

const developmentGlobal = globalThis as typeof globalThis & {
  bartlettApplication?: ReturnType<typeof createBartlettApplication>;
};

export const BartlettApplication =
  process.env.NODE_ENV === "development" && !useSupabaseStorage
    ? (developmentGlobal.bartlettApplication ??= createBartlettApplication())
    : createBartlettApplication();

export { AnalysisRun, Experiment, ParticipantSession, RecallAnalysis };

import { defineGraphApi } from "@ontahi/core/data-graph";

import { AnalysisRun } from "./application/analysis-run";
import { Experiment } from "./application/experiment";
import { ParticipantSession } from "./application/participant-session";

// Static composition root consumed by @ontahi/codegen. The executable,
// storage-bound application lives in src/application/graph.ts.
export const BartlettGraphApi = defineGraphApi({
  entities: { Experiment, ParticipantSession, AnalysisRun },
});

export { AnalysisRun, Experiment, ParticipantSession };

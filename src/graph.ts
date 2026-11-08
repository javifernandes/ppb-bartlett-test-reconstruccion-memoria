import { defineGraphApi } from "@ontahi/core/data-graph";

import { AnalysisRun } from "./application/entities/analysis-run";
import { Experiment } from "./application/entities/experiment";
import { ExperimentResultShare } from "./application/entities/experiment-result-share";
import { ParticipantSession } from "./application/entities/participant-session";
import { RecallAnalysis } from "./application/entities/recall-analysis";
import { ResultShare } from "./application/entities/result-share";
import { ShareChannel } from "./application/entities/share-channel";

// Static composition root consumed by @ontahi/codegen. The executable,
// storage-bound application lives in src/application/graph.ts.
export const BartlettGraphApi = defineGraphApi({
  entities: {
    Experiment,
    ExperimentResultShare,
    ParticipantSession,
    AnalysisRun,
    RecallAnalysis,
    ResultShare,
    ShareChannel,
  },
});

export {
  AnalysisRun,
  Experiment,
  ExperimentResultShare,
  ParticipantSession,
  RecallAnalysis,
  ResultShare,
  ShareChannel,
};

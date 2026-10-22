import { defineGraphApi } from "@ontahi/core/data-graph";

import { Experiment } from "./application/experiment";

// Static composition root consumed by @ontahi/codegen. The executable,
// storage-bound application lives in src/application/graph.ts.
export const BartlettGraphApi = defineGraphApi({ entities: { Experiment } });

export { Experiment };

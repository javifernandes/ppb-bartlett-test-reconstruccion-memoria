import { createInMemoryDataGraphStorage } from "@ontahi/core/data-graph";
import { inProcessTasks, ontahi } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";

const storage = createInMemoryDataGraphStorage({
  dataset: {
    Experiment: [
      {
        id: "experiment-wizard-of-oz",
        title: "Reconstrucción de una historia — prueba piloto",
        status: "draft",
        createdAt: "2026-10-22T00:00:00.000Z",
      },
    ],
  },
});

export const BartlettApplication = ontahi({
  storage,
  tasks: inProcessTasks(),
  entities: [Experiment],
});

export { Experiment };

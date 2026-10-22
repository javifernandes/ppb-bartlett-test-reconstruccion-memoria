import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";

export const AnalysisRun = entity({
  name: "AnalysisRun",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    status: field.enum([
      "running",
      "completed",
      "completed_with_errors",
    ] as const),
    analyzerVersion: field.nonEmptyString({ trim: true }),
    createdAt: field.nonEmptyString({ trim: true }),
  },
  domainOperationDefaults: {
    authority: "server",
    exposure: "bridge",
    layer: "analysis",
  },
  operations: ({ self, commands, operation }) => ({
    start: operation({
      input: graphSchema.object({
        id: self.fields.id,
        experiment: field.ref(Experiment),
        createdAt: self.fields.createdAt,
      }),
      output: self,
      bridge: { invalidate: [["AnalysisRun"]] },
      *run({ id, experiment, createdAt }) {
        const target = yield* experiment.resolve();

        if (!target || target.status !== "closed") {
          return yield* failOperation(
            "experiment_not_ready_for_analysis",
            "El experimento debe estar cerrado antes de analizarlo.",
          );
        }

        return yield* commands
          .insertReturning(
            {
              id,
              experiment,
              status: "running",
              analyzerVersion: "heuristic-v1",
              createdAt,
            },
            ["id", "experiment", "status", "analyzerVersion", "createdAt"],
          )
          .run();
      },
    }),
    finish: operation({
      input: graphSchema.object({
        run: field.ref(self),
        hasErrors: field.boolean(),
      }),
      output: self,
      bridge: { invalidate: [["AnalysisRun"]] },
      *run({ run, hasErrors }) {
        const current = yield* run.resolve();

        if (!current || current.status !== "running") {
          return yield* failOperation(
            "analysis_run_not_running",
            "La corrida de análisis no está en ejecución.",
          );
        }

        const [finished] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            {
              status: hasErrors ? "completed_with_errors" : "completed",
            },
            ["id", "experiment", "status", "analyzerVersion", "createdAt"],
          )
          .run();

        return finished;
      },
    }),
  }),
});

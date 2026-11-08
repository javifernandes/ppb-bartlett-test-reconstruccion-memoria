import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";

export const ExperimentResultShare = entity({
  name: "ExperimentResultShare",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    run: field.ref(AnalysisRun),
    status: field.enum(["active", "disabled"] as const),
    createdAt: field.nonEmptyString({ trim: true }),
  },
  domainOperationDefaults: {
    authority: "server",
    exposure: "bridge",
    layer: "experiments",
  },
  operations: ({ self, commands, operation, app }) => ({
    create: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({
        id: self.fields.id,
        experiment: graphSchema.existingRef(Experiment),
        run: graphSchema.existingRef(AnalysisRun),
        createdAt: self.fields.createdAt,
      }),
      output: self,
      bridge: { invalidate: [["ExperimentResultShare"]] },
      *run({ id, experiment, run, createdAt }) {
        if (
          run.experiment.locator.id !== experiment.id ||
          experiment.reportingAnalysisRunId !== run.id ||
          (experiment.status !== "published" && experiment.status !== "closed")
        ) {
          return yield* failOperation(
            "experiment_results_not_shareable",
            "Los resultados seleccionados no corresponden al análisis publicado del experimento.",
          );
        }

        return yield* commands
          .insertReturning(
            {
              id,
              experiment: Experiment.refById(experiment.id),
              run: AnalysisRun.refById(run.id),
              status: "active",
              createdAt,
            },
            ["id", "experiment", "run", "status", "createdAt"],
          )
          .run();
      },
    }),
    disable: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({ share: graphSchema.existingRef(self) }),
      output: self,
      bridge: { invalidate: [["ExperimentResultShare"]] },
      *run({ share }) {
        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(share.id))
          .updateReturning({ status: "disabled" }, [
            "id",
            "experiment",
            "run",
            "status",
            "createdAt",
          ])
          .run();
        return updated;
      },
    }),
  }),
});

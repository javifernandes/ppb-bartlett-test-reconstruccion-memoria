import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

export const Experiment = entity({
  name: "Experiment",
  fields: {
    id: field.id(),
    title: field.nonEmptyString({ trim: true }),
    story: field.nonEmptyString({ trim: true }),
    status: field.enum(["draft", "published", "closed"] as const),
    createdAt: field.nonEmptyString({ trim: true }),
  },
  display: { primary: "title", search: ["title"] },
  domainOperationDefaults: {
    authority: "server",
    exposure: "bridge",
    layer: "experiments",
  },
  operations: ({ self, commands, operation }) => ({
    createDraft: operation({
      input: graphSchema
        .pick(self, ["id", "title", "story", "createdAt"])
        .named("CreateExperimentInput"),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      run: (input) =>
        commands
          .insertReturning({ ...input, status: "draft" }, [
            "id",
            "title",
            "story",
            "status",
            "createdAt",
          ])
          .run(),
    }),
    updateDraft: operation({
      input: graphSchema.object({
        experiment: field.ref(self),
        title: self.fields.title,
        story: self.fields.story,
      }),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      *run({ experiment, title, story }) {
        const current = yield* experiment.resolve();

        if (!current) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        if (current.status !== "draft") {
          return yield* failOperation(
            "experiment_not_editable",
            "Sólo se pueden editar experimentos en borrador.",
          );
        }

        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ title, story }, [
            "id",
            "title",
            "story",
            "status",
            "createdAt",
          ])
          .run();

        if (!updated) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        return updated;
      },
    }),
  }),
});

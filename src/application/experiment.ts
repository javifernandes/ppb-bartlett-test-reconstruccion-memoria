import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";

export const Experiment = entity({
  name: "Experiment",
  fields: {
    id: field.id(),
    title: field.nonEmptyString({ trim: true }),
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
        .pick(self, ["id", "title", "createdAt"])
        .named("CreateExperimentInput"),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      run: (input) =>
        commands
          .insertReturning({ ...input, status: "draft" }, [
            "id",
            "title",
            "status",
            "createdAt",
          ])
          .run(),
    }),
  }),
});

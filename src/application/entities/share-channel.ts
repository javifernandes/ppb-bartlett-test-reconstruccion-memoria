import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";

export const ShareChannel = entity({
  name: "ShareChannel",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    name: field.nonEmptyString({ trim: true, maxLength: 80 }),
    status: field.enum(["active", "disabled"] as const),
    createdAt: field.nonEmptyString({ trim: true }),
  },
  display: { primary: "name", search: ["name"] },
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
        experiment: field.ref(Experiment),
        name: self.fields.name,
        createdAt: self.fields.createdAt,
      }),
      output: self,
      bridge: { invalidate: [["ShareChannel"]] },
      *run({ id, experiment, name, createdAt }) {
        const target = yield* experiment.resolve();
        if (!target || target.status === "draft") {
          return yield* failOperation(
            "experiment_not_shareable",
            "El experimento todavía no se puede compartir.",
          );
        }

        return yield* commands
          .insertReturning(
            { id, experiment, name, status: "active", createdAt },
            ["id", "experiment", "name", "status", "createdAt"],
          )
          .run();
      },
    }),
    disable: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({ channel: field.ref(self) }),
      output: self,
      bridge: { invalidate: [["ShareChannel"]] },
      *run({ channel }) {
        const current = yield* channel.resolve();
        if (!current) {
          return yield* failOperation(
            "share_channel_not_found",
            "El enlace de difusión no existe.",
          );
        }

        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "disabled" }, [
            "id",
            "experiment",
            "name",
            "status",
            "createdAt",
          ])
          .run();
        return updated;
      },
    }),
  }),
});

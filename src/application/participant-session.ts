import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";

export const ParticipantSession = entity({
  name: "ParticipantSession",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    status: field.enum(["reading", "recalling", "submitted"] as const),
    startedAt: field.nonEmptyString({ trim: true }),
    recallText: field.nullable(field.nonEmptyString({ trim: true })),
    submittedAt: field.nullable(field.nonEmptyString({ trim: true })),
  },
  domainOperationDefaults: {
    authority: "server",
    exposure: "bridge",
    layer: "participation",
  },
  operations: ({ self, commands, operation }) => ({
    start: operation({
      input: graphSchema.object({
        id: self.fields.id,
        experiment: field.ref(Experiment),
        startedAt: self.fields.startedAt,
      }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({ id, experiment, startedAt }) {
        const target = yield* experiment.resolve();

        if (!target || target.status !== "published") {
          return yield* failOperation(
            "experiment_not_accepting_participants",
            "El experimento no está recibiendo respuestas.",
          );
        }

        return yield* commands
          .insertReturning(
            {
              id,
              experiment,
              status: "reading",
              startedAt,
              recallText: null,
              submittedAt: null,
            },
            [
              "id",
              "experiment",
              "status",
              "startedAt",
              "recallText",
              "submittedAt",
            ],
          )
          .run();
      },
    }),
    startRecall: operation({
      input: graphSchema.object({ session: field.ref(self) }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({ session }) {
        const current = yield* session.resolve();

        if (!current || current.status !== "reading") {
          return yield* failOperation(
            "participant_session_not_reading",
            "La sesión no puede avanzar a la reconstrucción.",
          );
        }

        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "recalling" }, [
            "id",
            "experiment",
            "status",
            "startedAt",
            "recallText",
            "submittedAt",
          ])
          .run();

        return updated;
      },
    }),
    submitRecall: operation({
      input: graphSchema.object({
        session: field.ref(self),
        recallText: field.nonEmptyString({ trim: true }),
        submittedAt: field.nonEmptyString({ trim: true }),
      }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({ session, recallText, submittedAt }) {
        const current = yield* session.resolve();

        if (!current || current.status !== "recalling") {
          return yield* failOperation(
            "participant_session_not_recalling",
            "La sesión no está esperando una reconstrucción.",
          );
        }

        const [submitted] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "submitted", recallText, submittedAt }, [
            "id",
            "experiment",
            "status",
            "startedAt",
            "recallText",
            "submittedAt",
          ])
          .run();

        return submitted;
      },
    }),
  }),
});

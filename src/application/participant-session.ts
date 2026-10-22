import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";

export const ParticipantSession = entity({
  name: "ParticipantSession",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    status: field.enum([
      "reading",
      "interval",
      "recalling",
      "submitted",
    ] as const),
    startedAt: field.nonEmptyString({ trim: true }),
    intervalStartedAt: field.nullable(field.nonEmptyString({ trim: true })),
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
              intervalStartedAt: null,
              recallText: null,
              submittedAt: null,
            },
            [
              "id",
              "experiment",
              "status",
              "startedAt",
              "intervalStartedAt",
              "recallText",
              "submittedAt",
            ],
          )
          .run();
      },
    }),
    finishReading: operation({
      input: graphSchema.object({
        session: field.ref(self),
        experiment: field.ref(Experiment),
      }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({ session, experiment }) {
        const current = yield* session.resolve();
        const target = yield* experiment.resolve();

        if (
          !current ||
          !target ||
          target.id !== current.experiment.locator.id ||
          target.status !== "published" ||
          current.status !== "reading"
        ) {
          return yield* failOperation(
            "participant_session_not_reading",
            "La sesión no puede avanzar a la reconstrucción.",
          );
        }

        const hasInterval = target.intervalSeconds > 0;
        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            {
              status: hasInterval ? "interval" : "recalling",
              intervalStartedAt: hasInterval ? new Date().toISOString() : null,
            },
            [
              "id",
              "experiment",
              "status",
              "startedAt",
              "intervalStartedAt",
              "recallText",
              "submittedAt",
            ],
          )
          .run();

        return updated;
      },
    }),
    startRecall: operation({
      input: graphSchema.object({
        session: field.ref(self),
        experiment: field.ref(Experiment),
      }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({ session, experiment }) {
        const current = yield* session.resolve();
        const target = yield* experiment.resolve();

        if (
          !current ||
          !target ||
          target.id !== current.experiment.locator.id ||
          target.status !== "published" ||
          current.status !== "interval" ||
          !current.intervalStartedAt
        ) {
          return yield* failOperation(
            "participant_session_not_in_interval",
            "La sesión no está en el intervalo previo a la reconstrucción.",
          );
        }

        const availableAt =
          Date.parse(current.intervalStartedAt) + target.intervalSeconds * 1000;
        if (Date.now() < availableAt) {
          return yield* failOperation(
            "participant_interval_not_finished",
            "Todavía no terminó el intervalo configurado.",
          );
        }

        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "recalling" }, [
            "id",
            "experiment",
            "status",
            "startedAt",
            "intervalStartedAt",
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
        experiment: field.ref(Experiment),
        recallText: field.nonEmptyString({ trim: true }),
        submittedAt: field.nonEmptyString({ trim: true }),
      }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({ session, experiment, recallText, submittedAt }) {
        const current = yield* session.resolve();

        if (!current || current.status !== "recalling") {
          return yield* failOperation(
            "participant_session_not_recalling",
            "La sesión no está esperando una reconstrucción.",
          );
        }

        const target = yield* experiment.resolve();
        if (
          !target ||
          target.id !== current.experiment.locator.id ||
          target.status !== "published"
        ) {
          return yield* failOperation(
            "experiment_not_accepting_responses",
            "El experimento ya no recibe respuestas.",
          );
        }

        const [submitted] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "submitted", recallText, submittedAt }, [
            "id",
            "experiment",
            "status",
            "startedAt",
            "intervalStartedAt",
            "recallText",
            "submittedAt",
          ])
          .run();

        return submitted;
      },
    }),
  }),
});

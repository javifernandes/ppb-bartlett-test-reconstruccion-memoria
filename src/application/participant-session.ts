import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import {
  failOperation,
  getCurrentInvocationContext,
} from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";
import {
  type ParticipantRequestMetadata,
  participantRequestMetadataResourceKey,
} from "./participant-request-metadata";

export const ParticipantSession = entity({
  name: "ParticipantSession",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    contentLanguage: field.enum(["es", "en"] as const),
    countryCode: field.nullable(field.nonEmptyString({ trim: true })),
    browserLocale: field.nullable(field.nonEmptyString({ trim: true })),
    timezone: field.nullable(field.nonEmptyString({ trim: true })),
    deviceType: field.nullable(
      field.enum(["mobile", "tablet", "desktop"] as const),
    ),
    browser: field.nullable(field.nonEmptyString({ trim: true })),
    operatingSystem: field.nullable(field.nonEmptyString({ trim: true })),
    screenWidth: field.nullable(field.integer({ min: 0, max: 20_000 })),
    screenHeight: field.nullable(field.integer({ min: 0, max: 20_000 })),
    status: field.enum([
      "reading",
      "interval",
      "recalling",
      "submitted",
    ] as const),
    startedAt: field.nonEmptyString({ trim: true }),
    intervalStartedAt: field.nullable(field.nonEmptyString({ trim: true })),
    recallingStartedAt: field.nullable(field.nonEmptyString({ trim: true })),
    lastActivityAt: field.nonEmptyString({ trim: true }),
    recallText: field.nullable(
      field.nonEmptyString({ trim: true, maxLength: 5_000 }),
    ),
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
        contentLanguage: self.fields.contentLanguage,
        browserLocale: field.nonEmptyString({ trim: true }),
        timezone: field.nonEmptyString({ trim: true }),
        deviceType: field.enum(["mobile", "tablet", "desktop"] as const),
        browser: field.nonEmptyString({ trim: true }),
        operatingSystem: field.nonEmptyString({ trim: true }),
        screenWidth: field.integer({ min: 0, max: 20_000 }),
        screenHeight: field.integer({ min: 0, max: 20_000 }),
        startedAt: self.fields.startedAt,
      }),
      output: self,
      bridge: { invalidate: [["ParticipantSession"]] },
      *run({
        id,
        experiment,
        contentLanguage,
        browserLocale,
        timezone,
        deviceType,
        browser,
        operatingSystem,
        screenWidth,
        screenHeight,
        startedAt,
      }) {
        const target = yield* experiment.resolve();
        const requestMetadata = getCurrentInvocationContext()?.resources.get(
          participantRequestMetadataResourceKey,
        ) as ParticipantRequestMetadata | undefined;

        if (!target || target.status !== "published") {
          return yield* failOperation(
            "experiment_not_accepting_participants",
            "El experimento no está recibiendo respuestas.",
          );
        }

        if (
          contentLanguage !== target.primaryLanguage &&
          contentLanguage !== target.alternateLanguage
        ) {
          return yield* failOperation(
            "experiment_language_not_available",
            "El idioma seleccionado no está disponible.",
          );
        }

        return yield* commands
          .insertReturning(
            {
              id,
              experiment,
              contentLanguage,
              countryCode: requestMetadata?.countryCode ?? null,
              browserLocale,
              timezone,
              deviceType,
              browser,
              operatingSystem,
              screenWidth,
              screenHeight,
              status: "reading",
              startedAt,
              intervalStartedAt: null,
              recallingStartedAt: null,
              lastActivityAt: startedAt,
              recallText: null,
              submittedAt: null,
            },
            [
              "id",
              "experiment",
              "contentLanguage",
              "countryCode",
              "browserLocale",
              "timezone",
              "deviceType",
              "browser",
              "operatingSystem",
              "screenWidth",
              "screenHeight",
              "status",
              "startedAt",
              "intervalStartedAt",
              "recallingStartedAt",
              "lastActivityAt",
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
        const transitionedAt = new Date().toISOString();
        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            {
              status: hasInterval ? "interval" : "recalling",
              intervalStartedAt: hasInterval ? transitionedAt : null,
              recallingStartedAt: hasInterval ? null : transitionedAt,
              lastActivityAt: transitionedAt,
            },
            [
              "id",
              "experiment",
              "contentLanguage",
              "countryCode",
              "browserLocale",
              "timezone",
              "deviceType",
              "browser",
              "operatingSystem",
              "screenWidth",
              "screenHeight",
              "status",
              "startedAt",
              "intervalStartedAt",
              "recallingStartedAt",
              "lastActivityAt",
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

        const recallingStartedAt = new Date().toISOString();
        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            {
              status: "recalling",
              recallingStartedAt,
              lastActivityAt: recallingStartedAt,
            },
            [
              "id",
              "experiment",
              "contentLanguage",
              "countryCode",
              "browserLocale",
              "timezone",
              "deviceType",
              "browser",
              "operatingSystem",
              "screenWidth",
              "screenHeight",
              "status",
              "startedAt",
              "intervalStartedAt",
              "recallingStartedAt",
              "lastActivityAt",
              "recallText",
              "submittedAt",
            ],
          )
          .run();

        return updated;
      },
    }),
    submitRecall: operation({
      input: graphSchema.object({
        session: field.ref(self),
        experiment: field.ref(Experiment),
        recallText: field.nonEmptyString({
          trim: true,
          maxLength: 5_000,
          messages: {
            maxLength: "La respuesta no puede superar los 5000 caracteres.",
          },
        }),
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
          .updateReturning(
            {
              status: "submitted",
              recallText,
              submittedAt,
              lastActivityAt: submittedAt,
            },
            [
              "id",
              "experiment",
              "contentLanguage",
              "countryCode",
              "browserLocale",
              "timezone",
              "deviceType",
              "browser",
              "operatingSystem",
              "screenWidth",
              "screenHeight",
              "status",
              "startedAt",
              "intervalStartedAt",
              "recallingStartedAt",
              "lastActivityAt",
              "recallText",
              "submittedAt",
            ],
          )
          .run();

        return submitted;
      },
    }),
  }),
});

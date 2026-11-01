import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";
import { Effect, Either } from "effect";

import {
  prepareStory,
  type StoryAnalysisRubric,
} from "../analysis/story-analysis-model";

export const Experiment = entity({
  name: "Experiment",
  fields: {
    id: field.id(),
    title: field.nonEmptyString({ trim: true }),
    participantTitle: field.nonEmptyString({ trim: true }),
    introduction: field.nonEmptyString({ trim: true }),
    consentText: field.nonEmptyString({ trim: true }),
    story: field.nonEmptyString({ trim: true }),
    recallInstructions: field.nonEmptyString({ trim: true }),
    primaryLanguage: field.enum(["es", "en"] as const),
    alternateLanguage: field.nullable(field.enum(["es", "en"] as const)),
    alternateParticipantTitle: field.nullable(
      field.nonEmptyString({ trim: true }),
    ),
    alternateIntroduction: field.nullable(field.nonEmptyString({ trim: true })),
    alternateConsentText: field.nullable(field.nonEmptyString({ trim: true })),
    alternateStory: field.nullable(field.nonEmptyString({ trim: true })),
    alternateRecallInstructions: field.nullable(
      field.nonEmptyString({ trim: true }),
    ),
    intervalSeconds: field.integer({ min: 0, max: 3600 }),
    distractorEnabled: field.boolean(),
    status: field.enum(["draft", "published", "closed"] as const),
    createdAt: field.nonEmptyString({ trim: true }),
    publishedAt: field.nullable(field.nonEmptyString({ trim: true })),
    publicToken: field.nullable(field.nonEmptyString({ trim: true })),
    analysisRunId: field.nullable(field.nonEmptyString({ trim: true })),
    analysisRubrics: field.nullable(field.json()),
    analysisPreparedAt: field.nullable(field.nonEmptyString({ trim: true })),
  },
  display: { primary: "title", search: ["title"] },
  domainOperationDefaults: {
    authority: "server",
    exposure: "bridge",
    layer: "experiments",
  },
  operations: ({ self, commands, operation, app }) => ({
    createDraft: operation({
      requires: [app.require.authenticated()],
      input: graphSchema
        .pick(self, ["id", "title", "story", "createdAt"])
        .named("CreateExperimentInput"),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      run: (input) =>
        commands
          .insertReturning(
            {
              ...input,
              participantTitle: input.title,
              introduction:
                "Vas a participar en una prueba de reconstrucción de memoria.",
              consentText:
                "Acepto participar voluntariamente. Mi respuesta y datos técnicos generales se registrarán de forma anónima, sin información que me identifique. Puedo abandonar antes de enviarla.",
              recallInstructions:
                "Escribí todo lo que recuerdes, con el mayor detalle posible.",
              primaryLanguage: "es",
              alternateLanguage: null,
              alternateParticipantTitle: null,
              alternateIntroduction: null,
              alternateConsentText: null,
              alternateStory: null,
              alternateRecallInstructions: null,
              intervalSeconds: 0,
              distractorEnabled: false,
              status: "draft",
              publishedAt: null,
              publicToken: null,
              analysisRunId: null,
              analysisRubrics: null,
              analysisPreparedAt: null,
            },
            [
              "id",
              "title",
              "participantTitle",
              "introduction",
              "consentText",
              "story",
              "recallInstructions",
              "primaryLanguage",
              "alternateLanguage",
              "alternateParticipantTitle",
              "alternateIntroduction",
              "alternateConsentText",
              "alternateStory",
              "alternateRecallInstructions",
              "intervalSeconds",
              "distractorEnabled",
              "status",
              "createdAt",
              "publishedAt",
              "publicToken",
              "analysisRunId",
              "analysisRubrics",
              "analysisPreparedAt",
            ],
          )
          .run(),
    }),
    updateDraft: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({
        experiment: field.ref(self),
        title: self.fields.title,
        participantTitle: self.fields.participantTitle,
        introduction: self.fields.introduction,
        consentText: self.fields.consentText,
        story: self.fields.story,
        recallInstructions: self.fields.recallInstructions,
        primaryLanguage: self.fields.primaryLanguage,
        alternateLanguage: self.fields.alternateLanguage,
        alternateParticipantTitle: self.fields.alternateParticipantTitle,
        alternateIntroduction: self.fields.alternateIntroduction,
        alternateConsentText: self.fields.alternateConsentText,
        alternateStory: self.fields.alternateStory,
        alternateRecallInstructions: self.fields.alternateRecallInstructions,
        intervalSeconds: self.fields.intervalSeconds,
        distractorEnabled: self.fields.distractorEnabled,
      }),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      *run({
        experiment,
        title,
        participantTitle,
        introduction,
        consentText,
        story,
        recallInstructions,
        primaryLanguage,
        alternateLanguage,
        alternateParticipantTitle,
        alternateIntroduction,
        alternateConsentText,
        alternateStory,
        alternateRecallInstructions,
        intervalSeconds,
        distractorEnabled,
      }) {
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

        const alternateValues = [
          alternateParticipantTitle,
          alternateIntroduction,
          alternateConsentText,
          alternateStory,
          alternateRecallInstructions,
        ];
        const hasCompleteAlternate = alternateValues.every(Boolean);
        const hasAnyAlternate = alternateValues.some(Boolean);
        if (
          (alternateLanguage && !hasCompleteAlternate) ||
          (!alternateLanguage && hasAnyAlternate) ||
          alternateLanguage === primaryLanguage
        ) {
          return yield* failOperation(
            "invalid_language_variant",
            "La variante debe usar el otro idioma y tener todos sus textos completos.",
          );
        }

        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            {
              title,
              participantTitle,
              introduction,
              consentText,
              story,
              recallInstructions,
              primaryLanguage,
              alternateLanguage,
              alternateParticipantTitle,
              alternateIntroduction,
              alternateConsentText,
              alternateStory,
              alternateRecallInstructions,
              intervalSeconds,
              distractorEnabled,
              analysisRunId: null,
              analysisRubrics: null,
              analysisPreparedAt: null,
            },
            [
              "id",
              "title",
              "participantTitle",
              "introduction",
              "consentText",
              "story",
              "recallInstructions",
              "primaryLanguage",
              "alternateLanguage",
              "alternateParticipantTitle",
              "alternateIntroduction",
              "alternateConsentText",
              "alternateStory",
              "alternateRecallInstructions",
              "intervalSeconds",
              "distractorEnabled",
              "status",
              "createdAt",
              "publishedAt",
              "publicToken",
              "analysisRunId",
              "analysisRubrics",
              "analysisPreparedAt",
            ],
          )
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
    prepareAnalysis: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({
        experiment: field.ref(self),
        preparedAt: self.fields.createdAt,
      }),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      *run({ experiment, preparedAt }) {
        const current = yield* experiment.resolve();
        if (!current || current.status !== "draft") {
          return yield* failOperation(
            "experiment_not_preparable",
            "Sólo se puede preparar un experimento en borrador.",
          );
        }

        const primary = yield* Effect.either(
          Effect.tryPromise(() =>
            prepareStory(current.story, current.primaryLanguage),
          ),
        );
        if (Either.isLeft(primary)) {
          return yield* failOperation(
            "story_analysis_failed",
            primary.left instanceof Error
              ? primary.left.message
              : "No se pudo preparar la historia.",
          );
        }

        const rubrics = [primary.right];
        if (current.alternateLanguage && current.alternateStory) {
          const alternate = yield* Effect.either(
            Effect.tryPromise(() =>
              prepareStory(current.alternateStory!, current.alternateLanguage!),
            ),
          );
          if (Either.isLeft(alternate)) {
            return yield* failOperation(
              "story_analysis_failed",
              alternate.left instanceof Error
                ? alternate.left.message
                : "No se pudo preparar la variante de la historia.",
            );
          }
          rubrics.push(alternate.right);
        }

        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            { analysisRubrics: rubrics, analysisPreparedAt: preparedAt },
            ["id", "analysisRubrics", "analysisPreparedAt"],
          )
          .run();
        return updated;
      },
    }),
    publish: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({
        experiment: field.ref(self),
        publishedAt: self.fields.createdAt,
        publicToken: field.nonEmptyString({ trim: true }),
        analysisRunId: field.nonEmptyString({ trim: true }),
      }),
      output: self,
      *run({ experiment, publishedAt, publicToken, analysisRunId }) {
        const current = yield* experiment.resolve();

        if (!current) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        if (current.status !== "draft") {
          return yield* failOperation(
            "experiment_not_publishable",
            "Sólo se pueden publicar experimentos en borrador.",
          );
        }

        const analysisRubrics = current.analysisRubrics as
          | StoryAnalysisRubric[]
          | null;
        if (!analysisRubrics?.length) {
          return yield* failOperation(
            "experiment_analysis_not_prepared",
            "Prepará la historia para el análisis antes de publicarla.",
          );
        }

        const [published] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning(
            { status: "published", publishedAt, publicToken, analysisRunId },
            [
              "id",
              "title",
              "participantTitle",
              "introduction",
              "consentText",
              "story",
              "recallInstructions",
              "primaryLanguage",
              "alternateLanguage",
              "alternateParticipantTitle",
              "alternateIntroduction",
              "alternateConsentText",
              "alternateStory",
              "alternateRecallInstructions",
              "intervalSeconds",
              "distractorEnabled",
              "status",
              "createdAt",
              "publishedAt",
              "publicToken",
              "analysisRunId",
              "analysisRubrics",
              "analysisPreparedAt",
            ],
          )
          .run();

        if (!published) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        return published;
      },
    }),
    close: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({ experiment: field.ref(self) }),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      *run({ experiment }) {
        const current = yield* experiment.resolve();

        if (!current) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        if (current.status !== "published") {
          return yield* failOperation(
            "experiment_not_closable",
            "Sólo se pueden cerrar experimentos publicados.",
          );
        }

        const [closed] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "closed" }, [
            "id",
            "title",
            "participantTitle",
            "introduction",
            "consentText",
            "story",
            "recallInstructions",
            "primaryLanguage",
            "alternateLanguage",
            "alternateParticipantTitle",
            "alternateIntroduction",
            "alternateConsentText",
            "alternateStory",
            "alternateRecallInstructions",
            "intervalSeconds",
            "distractorEnabled",
            "status",
            "createdAt",
            "publishedAt",
            "publicToken",
            "analysisRunId",
            "analysisRubrics",
            "analysisPreparedAt",
          ])
          .run();

        return closed;
      },
    }),
    deletePermanently: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({ experiment: field.ref(self) }),
      output: self,
      *run({ experiment }) {
        const current = yield* experiment.resolve();

        if (!current) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        const [deleted] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .deleteManyReturning([
            "id",
            "title",
            "participantTitle",
            "introduction",
            "consentText",
            "story",
            "recallInstructions",
            "primaryLanguage",
            "alternateLanguage",
            "alternateParticipantTitle",
            "alternateIntroduction",
            "alternateConsentText",
            "alternateStory",
            "alternateRecallInstructions",
            "intervalSeconds",
            "distractorEnabled",
            "status",
            "createdAt",
            "publishedAt",
            "publicToken",
            "analysisRunId",
            "analysisRubrics",
            "analysisPreparedAt",
          ])
          .run();

        if (!deleted) {
          return yield* failOperation(
            "experiment_not_found",
            "El experimento no existe.",
          );
        }

        return deleted;
      },
    }),
  }),
});

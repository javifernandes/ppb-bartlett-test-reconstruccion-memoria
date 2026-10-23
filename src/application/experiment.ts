import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

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
    intervalSeconds: field.integer({ min: 0, max: 3600 }),
    distractorEnabled: field.boolean(),
    status: field.enum(["draft", "published", "closed"] as const),
    createdAt: field.nonEmptyString({ trim: true }),
    publishedAt: field.nullable(field.nonEmptyString({ trim: true })),
    publicToken: field.nullable(field.nonEmptyString({ trim: true })),
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
                "Acepto participar voluntariamente y comprendo que puedo abandonar la actividad antes de enviar mi respuesta.",
              recallInstructions:
                "Escribí todo lo que recuerdes, con el mayor detalle posible.",
              intervalSeconds: 0,
              distractorEnabled: false,
              status: "draft",
              publishedAt: null,
              publicToken: null,
            },
            [
              "id",
              "title",
              "participantTitle",
              "introduction",
              "consentText",
              "story",
              "recallInstructions",
              "intervalSeconds",
              "distractorEnabled",
              "status",
              "createdAt",
              "publishedAt",
              "publicToken",
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
              intervalSeconds,
              distractorEnabled,
            },
            [
              "id",
              "title",
              "participantTitle",
              "introduction",
              "consentText",
              "story",
              "recallInstructions",
              "intervalSeconds",
              "distractorEnabled",
              "status",
              "createdAt",
              "publishedAt",
              "publicToken",
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
    publish: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({
        experiment: field.ref(self),
        publishedAt: self.fields.createdAt,
        publicToken: field.nonEmptyString({ trim: true }),
      }),
      output: self,
      bridge: { invalidate: [["Experiment"]] },
      *run({ experiment, publishedAt, publicToken }) {
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

        const [published] = yield* commands
          .where((candidate) => candidate.id.eq(current.id))
          .updateReturning({ status: "published", publishedAt, publicToken }, [
            "id",
            "title",
            "participantTitle",
            "introduction",
            "consentText",
            "story",
            "recallInstructions",
            "intervalSeconds",
            "distractorEnabled",
            "status",
            "createdAt",
            "publishedAt",
            "publicToken",
          ])
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
            "intervalSeconds",
            "distractorEnabled",
            "status",
            "createdAt",
            "publishedAt",
            "publicToken",
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
            "intervalSeconds",
            "distractorEnabled",
            "status",
            "createdAt",
            "publishedAt",
            "publicToken",
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

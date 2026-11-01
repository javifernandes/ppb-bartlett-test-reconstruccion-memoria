import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";

const secondsBetween = (from?: string | null, to?: string | null) => {
  if (!from || !to) return 0;
  const duration = Math.round((Date.parse(to) - Date.parse(from)) / 1_000);
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
};

export const ResultShare = entity({
  name: "ResultShare",
  fields: {
    id: field.id(),
    experiment: field.ref(Experiment),
    session: field.ref(ParticipantSession),
    contentLanguage: field.enum(["es", "en"] as const),
    story: field.nonEmptyString({ trim: true }),
    recallText: field.nonEmptyString({ trim: true, maxLength: 5_000 }),
    readingSeconds: field.integer({ min: 0, max: 604_800 }),
    distractorSeconds: field.integer({ min: 0, max: 604_800 }),
    recallSeconds: field.integer({ min: 0, max: 604_800 }),
    totalSeconds: field.integer({ min: 0, max: 604_800 }),
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
        session: graphSchema.existingRef(ParticipantSession),
        createdAt: self.fields.createdAt,
      }),
      output: self,
      bridge: { invalidate: [["ResultShare"]] },
      *run({ id, experiment, session, createdAt }) {
        if (
          experiment.id !== session.experiment.locator.id ||
          session.status !== "submitted" ||
          !session.recallText
        ) {
          return yield* failOperation(
            "result_not_shareable",
            "Sólo se pueden compartir respuestas completas.",
          );
        }

        return yield* commands
          .insertReturning(
            {
              id,
              experiment: Experiment.refById(experiment.id),
              session: ParticipantSession.refById(session.id),
              contentLanguage: session.contentLanguage,
              story:
                session.contentLanguage === experiment.alternateLanguage &&
                experiment.alternateStory
                  ? experiment.alternateStory
                  : experiment.story,
              recallText: session.recallText,
              readingSeconds: secondsBetween(
                session.startedAt,
                session.intervalStartedAt ??
                  session.recallingStartedAt ??
                  session.submittedAt,
              ),
              distractorSeconds: secondsBetween(
                session.intervalStartedAt,
                session.recallingStartedAt,
              ),
              recallSeconds: secondsBetween(
                session.recallingStartedAt,
                session.submittedAt ?? session.lastActivityAt,
              ),
              totalSeconds: secondsBetween(
                session.startedAt,
                session.submittedAt ?? session.lastActivityAt,
              ),
              status: "active",
              createdAt,
            },
            [
              "id",
              "experiment",
              "session",
              "contentLanguage",
              "story",
              "recallText",
              "readingSeconds",
              "distractorSeconds",
              "recallSeconds",
              "totalSeconds",
              "status",
              "createdAt",
            ],
          )
          .run();
      },
    }),
    disable: operation({
      requires: [app.require.authenticated()],
      input: graphSchema.object({ share: graphSchema.existingRef(self) }),
      output: self,
      bridge: { invalidate: [["ResultShare"]] },
      *run({ share }) {
        const [updated] = yield* commands
          .where((candidate) => candidate.id.eq(share.id))
          .updateReturning({ status: "disabled" }, [
            "id",
            "experiment",
            "session",
            "contentLanguage",
            "story",
            "recallText",
            "readingSeconds",
            "distractorSeconds",
            "recallSeconds",
            "totalSeconds",
            "status",
            "createdAt",
          ])
          .run();
        return updated;
      },
    }),
  }),
});

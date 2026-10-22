import { field, graphSchema } from "@ontahi/core/data-graph";
import { entity } from "@ontahi/core/entity";
import { failOperation } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";

export type RecallPhenomenonKind =
  | "omission"
  | "intrusion"
  | "substitution"
  | "rationalization"
  | "accentuation";

export type RecallPhenomenon = {
  kind: RecallPhenomenonKind;
  storyExcerpt: string | null;
  recallExcerpt: string | null;
  explanation: string;
  confidence: number;
};

const ignoredWords = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "lo",
  "los",
  "para",
  "por",
  "que",
  "se",
  "su",
  "sus",
  "un",
  "una",
  "y",
]);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

const tokens = (value: string) =>
  (normalize(value).match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length > 2 && !ignoredWords.has(token),
  );

const units = (value: string) =>
  value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((unit) => unit.trim())
    .filter(Boolean);

const overlap = (source: string, comparisonTokens: Set<string>) => {
  const sourceTokens = [...new Set(tokens(source))];
  if (sourceTokens.length === 0) return 0;
  return (
    sourceTokens.filter((token) => comparisonTokens.has(token)).length /
    sourceTokens.length
  );
};

export const analyzeRecallHeuristically = (
  story: string,
  recall: string,
): {
  retainedUnitsCount: number;
  omittedUnitsCount: number;
  intrusionCount: number;
  phenomena: RecallPhenomenon[];
} => {
  const storyUnits = units(story);
  const recallUnits = units(recall);
  const recallTokens = new Set(tokens(recall));
  const storyTokens = new Set(tokens(story));
  const phenomena: RecallPhenomenon[] = [];
  let retainedUnitsCount = 0;
  let omittedUnitsCount = 0;

  for (const storyUnit of storyUnits) {
    const score = overlap(storyUnit, recallTokens);
    if (score >= 0.5) retainedUnitsCount += 1;
    if (score < 0.5) {
      omittedUnitsCount += 1;
      phenomena.push({
        kind: "omission",
        storyExcerpt: storyUnit,
        recallExcerpt: null,
        explanation:
          "La reconstrucción no conserva suficientes términos de esta unidad narrativa.",
        confidence: Math.round((1 - score) * 100) / 100,
      });
    }
  }

  let intrusionCount = 0;
  for (const recallUnit of recallUnits) {
    const recallUnitTokens = tokens(recallUnit);
    const score = overlap(recallUnit, storyTokens);
    if (recallUnitTokens.length >= 3 && score <= 0.35) {
      intrusionCount += 1;
      phenomena.push({
        kind: "intrusion",
        storyExcerpt: null,
        recallExcerpt: recallUnit,
        explanation:
          "Esta unidad de la reconstrucción tiene escasa coincidencia léxica con la historia original.",
        confidence: Math.round((1 - score) * 100) / 100,
      });
    }
  }

  return {
    retainedUnitsCount,
    omittedUnitsCount,
    intrusionCount,
    phenomena,
  };
};

export const RecallAnalysis = entity({
  name: "RecallAnalysis",
  fields: {
    id: field.id(),
    run: field.ref(AnalysisRun),
    session: field.ref(ParticipantSession),
    experiment: field.ref(Experiment),
    status: field.enum(["completed"] as const),
    rubricVersion: field.nonEmptyString({ trim: true }),
    retainedUnitsCount: field.integer({ min: 0 }),
    omittedUnitsCount: field.integer({ min: 0 }),
    intrusionCount: field.integer({ min: 0 }),
    phenomena: field.json(),
    createdAt: field.nonEmptyString({ trim: true }),
  },
  domainOperationDefaults: {
    authority: "server",
    exposure: "bridge",
    layer: "analysis",
  },
  operations: ({ self, commands, operation }) => ({
    analyze: operation({
      input: graphSchema.object({
        id: self.fields.id,
        run: field.ref(AnalysisRun),
        session: field.ref(ParticipantSession),
        experiment: field.ref(Experiment),
        createdAt: self.fields.createdAt,
      }),
      output: self,
      bridge: { invalidate: [["RecallAnalysis"]] },
      *run({ id, run, session, experiment, createdAt }) {
        const analysisRun = yield* run.resolve();
        const participantSession = yield* session.resolve();
        const targetExperiment = yield* experiment.resolve();

        if (
          !analysisRun ||
          !participantSession ||
          !targetExperiment ||
          analysisRun.status !== "running" ||
          analysisRun.experiment.locator.id !== targetExperiment.id ||
          participantSession.experiment.locator.id !== targetExperiment.id ||
          participantSession.status !== "submitted" ||
          !participantSession.recallText
        ) {
          return yield* failOperation(
            "recall_not_analyzable",
            "La respuesta no puede analizarse en esta corrida.",
          );
        }

        const result = analyzeRecallHeuristically(
          targetExperiment.story,
          participantSession.recallText,
        );

        return yield* commands
          .insertReturning(
            {
              id,
              run,
              session,
              experiment,
              status: "completed",
              rubricVersion: "bartlett-heuristic-v1",
              ...result,
              createdAt,
            },
            [
              "id",
              "run",
              "session",
              "experiment",
              "status",
              "rubricVersion",
              "retainedUnitsCount",
              "omittedUnitsCount",
              "intrusionCount",
              "phenomena",
              "createdAt",
            ],
          )
          .run();
      },
    }),
  }),
});

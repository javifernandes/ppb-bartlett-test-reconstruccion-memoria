import type { RecallPhenomenon } from "../entities/recall-analysis";

type SemanticComponent = {
  status: "preserved" | "transformed" | "omitted";
  evidence: string | null;
  observedValue: string | null;
  confidence: number;
};

type SemanticAssessment = {
  factAssessments: Array<{
    factId: string;
    predicate: SemanticComponent;
    slots: Array<SemanticComponent & { slotId: string }>;
  }>;
  entityMappings: Array<{
    canonicalEntity: string;
    observedForm: string;
    evidence: string | null;
    explanation: string;
    confidence: number;
  }>;
  intrusions: Array<{
    evidence: string;
    explanation: string;
    confidence: number;
  }>;
};

type SemanticRubric = {
  version: string;
  language: "es" | "en";
  narrativeUnits: Array<{
    facts: Array<{
      id: string;
      statement: string;
      storyExcerpt?: string;
      frame: {
        predicate: { label: string; sourceExcerpt?: string };
        slots: Array<{
          slotId: string;
          role: string;
          expected: string;
          sourceExcerpt?: string;
        }>;
      };
    }>;
  }>;
};

type SemanticSummary = {
  facts: {
    preserved: number;
    omitted: number;
  };
  [key: string]: unknown;
};

export const analyzeSemanticRecall = async (
  rubric: SemanticRubric,
  recall: string,
) => {
  // The evaluator is shared with the validated local V3 harness. Keeping one
  // implementation prevents the backfill and live submit paths from drifting.
  const analysisModule =
    await import("../../../evals/analysis-comparison/batch-v3.mjs");
  const metricsModule =
    await import("../../../evals/analysis-comparison/metrics-v3.mjs");
  const result = (await analysisModule.analyzeSemanticFrames(
    rubric,
    recall,
  )) as {
    model: string;
    usage: { prompt_tokens?: number; completion_tokens?: number } | null;
    output: SemanticAssessment;
  };
  const summary = metricsModule.summarizeParticipantV3(
    rubric,
    result.output.factAssessments,
  ) as SemanticSummary;
  return { ...result, summary };
};

const componentPhenomenon = ({
  component,
  storyExcerpt,
  label,
}: {
  component: SemanticComponent;
  storyExcerpt: string;
  label: string;
}): RecallPhenomenon => ({
  kind:
    component.status === "omitted"
      ? "omission"
      : component.status === "transformed"
        ? "substitution"
        : "retained",
  storyExcerpt,
  recallExcerpt: component.evidence,
  explanation:
    component.status === "omitted"
      ? `No se conserva ${label}.`
      : component.status === "transformed"
        ? `${label} aparece transformado como ${component.observedValue ?? "otra forma"}.`
        : `Se conserva ${label}.`,
  confidence: component.confidence,
});

export const semanticPhenomena = (
  rubric: SemanticRubric,
  assessment: SemanticAssessment,
): RecallPhenomenon[] => {
  const facts = rubric.narrativeUnits.flatMap((unit) => unit.facts);
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const phenomena: RecallPhenomenon[] = [];

  for (const evaluated of assessment.factAssessments) {
    const fact = factsById.get(evaluated.factId);
    if (!fact) continue;
    phenomena.push(
      componentPhenomenon({
        component: evaluated.predicate,
        storyExcerpt:
          fact.frame.predicate.sourceExcerpt ??
          fact.storyExcerpt ??
          fact.statement,
        label: `la acción «${fact.frame.predicate.label}»`,
      }),
    );
    const slots = new Map(
      evaluated.slots.map((component) => [component.slotId, component]),
    );
    for (const slot of fact.frame.slots) {
      const component = slots.get(slot.slotId);
      if (!component || component.status === "preserved") continue;
      phenomena.push(
        componentPhenomenon({
          component,
          storyExcerpt:
            slot.sourceExcerpt ?? fact.storyExcerpt ?? fact.statement,
          label: `${slot.role}=${slot.expected}`,
        }),
      );
    }
  }
  for (const intrusion of assessment.intrusions) {
    phenomena.push({
      kind: "intrusion",
      storyExcerpt: null,
      recallExcerpt: intrusion.evidence,
      explanation: intrusion.explanation,
      confidence: intrusion.confidence,
    });
  }
  return phenomena;
};

export type { SemanticAssessment, SemanticRubric };

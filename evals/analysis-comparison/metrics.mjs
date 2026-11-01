const importanceValues = ["backbone", "supporting", "detail"];
const statusValues = ["preserved", "transformed", "omitted"];

const divide = (numerator, denominator) =>
  denominator === 0 ? null : numerator / denominator;

const emptyCounts = () => ({
  total: 0,
  preserved: 0,
  transformed: 0,
  omitted: 0,
});

const addAssessment = (counts, status) => {
  counts.total += 1;
  counts[status] += 1;
};

const withRates = (counts) => ({
  ...counts,
  // Presence answers whether some version of the fact survived.
  presenceRate: divide(counts.preserved + counts.transformed, counts.total),
  // Fidelity is deliberately stricter: transformed facts do not count.
  fidelityRate: divide(counts.preserved, counts.total),
  omissionRate: divide(counts.omitted, counts.total),
  transformationRate: divide(
    counts.transformed,
    counts.preserved + counts.transformed,
  ),
});

const flattenFacts = (rubric) =>
  rubric.narrativeUnits.flatMap((unit) => unit.facts);

const indexAssessments = (facts, factAssessments) => {
  const expectedIds = new Set(facts.map((fact) => fact.id));
  const assessments = new Map();
  for (const assessment of factAssessments) {
    if (
      !expectedIds.has(assessment.factId) ||
      assessments.has(assessment.factId) ||
      !statusValues.includes(assessment.status)
    ) {
      throw new Error(`Evaluación inválida para ${assessment.factId}.`);
    }
    assessments.set(assessment.factId, assessment);
  }
  if (assessments.size !== facts.length) {
    throw new Error("La respuesta no evalúa exactamente todos los hechos.");
  }
  return assessments;
};

export const summarizeParticipant = (rubric, factAssessments) => {
  const facts = flattenFacts(rubric);
  const assessments = indexAssessments(facts, factAssessments);
  const countsByImportance = Object.fromEntries(
    importanceValues.map((importance) => [importance, emptyCounts()]),
  );
  const overall = emptyCounts();
  const secondary = emptyCounts();

  for (const fact of facts) {
    const status = assessments.get(fact.id).status;
    addAssessment(overall, status);
    addAssessment(countsByImportance[fact.importance], status);
    if (fact.importance !== "backbone") addAssessment(secondary, status);
  }

  const byImportance = Object.fromEntries(
    importanceValues.map((importance) => [
      importance,
      withRates(countsByImportance[importance]),
    ]),
  );

  return {
    overall: withRates(overall),
    byImportance,
    secondary: withRates(secondary),
    profileCoordinates: {
      backbonePresence: byImportance.backbone.presenceRate,
      backboneFidelity: byImportance.backbone.fidelityRate,
      secondaryPresence: divide(
        secondary.preserved + secondary.transformed,
        secondary.total,
      ),
      secondaryFidelity: divide(secondary.preserved, secondary.total),
    },
  };
};

export const summarizeCohort = (rubric, responses) => {
  const facts = flattenFacts(rubric);
  const factCounts = new Map(facts.map((fact) => [fact.id, emptyCounts()]));
  const participants = responses.map((response) => {
    const assessments = indexAssessments(facts, response.factAssessments);
    for (const fact of facts) {
      addAssessment(factCounts.get(fact.id), assessments.get(fact.id).status);
    }
    return {
      id: response.id,
      ...summarizeParticipant(rubric, response.factAssessments),
    };
  });

  const factsSummary = facts.map((fact) => ({
    ...fact,
    ...withRates(factCounts.get(fact.id)),
  }));
  const cohortCounts = emptyCounts();
  for (const counts of factCounts.values()) {
    cohortCounts.total += counts.total;
    cohortCounts.preserved += counts.preserved;
    cohortCounts.transformed += counts.transformed;
    cohortCounts.omitted += counts.omitted;
  }

  const rank = (selector, direction) =>
    [...factsSummary].sort(
      (left, right) =>
        direction * (selector(left) - selector(right)) ||
        left.id.localeCompare(right.id),
    );

  return {
    participantCount: participants.length,
    overall: withRates(cohortCounts),
    participants,
    facts: factsSummary,
    rankings: {
      mostRemembered: rank((fact) => fact.presenceRate, -1),
      mostFaithful: rank((fact) => fact.fidelityRate, -1),
      mostOmitted: rank((fact) => fact.omissionRate, -1),
      mostTransformed: rank((fact) => fact.transformationRate ?? -1, -1),
    },
  };
};

const factStatuses = ["preserved", "partial", "transformed", "omitted"];
const componentStatuses = ["preserved", "transformed", "omitted"];
const importanceValues = ["backbone", "supporting", "detail"];

const divide = (numerator, denominator) =>
  denominator === 0 ? null : numerator / denominator;

const emptyFactCounts = () => ({
  total: 0,
  preserved: 0,
  partial: 0,
  transformed: 0,
  omitted: 0,
});

const emptyComponentCounts = () => ({
  total: 0,
  preserved: 0,
  transformed: 0,
  omitted: 0,
});

const deriveFactStatus = (assessment) => {
  if (assessment.predicate.status === "omitted") return "omitted";
  const components = [assessment.predicate, ...assessment.slots];
  if (components.some((component) => component.status === "transformed")) {
    return "transformed";
  }
  if (components.some((component) => component.status === "omitted")) {
    return "partial";
  }
  return "preserved";
};

const anchorAssessmentComponents = (assessment) => {
  if (assessment.predicate.status !== "omitted") return assessment;
  return {
    ...assessment,
    slots: assessment.slots.map((slot) => ({
      ...slot,
      status: "omitted",
      evidence: null,
      observedValue: null,
      anchored: false,
      anchoringReason: "predicate_omitted",
    })),
  };
};

const withFactRates = (counts) => ({
  ...counts,
  presenceRate: divide(
    counts.preserved + counts.partial + counts.transformed,
    counts.total,
  ),
  completeRate: divide(counts.preserved + counts.transformed, counts.total),
  exactRate: divide(counts.preserved, counts.total),
  partialRate: divide(counts.partial, counts.total),
  transformationRate: divide(counts.transformed, counts.total),
  omissionRate: divide(counts.omitted, counts.total),
});

const withComponentRates = (counts) => ({
  ...counts,
  presenceRate: divide(counts.preserved + counts.transformed, counts.total),
  fidelityRate: divide(counts.preserved, counts.total),
  transformationRate: divide(counts.transformed, counts.total),
  omissionRate: divide(counts.omitted, counts.total),
});

const flattenFacts = (rubric) =>
  rubric.narrativeUnits.flatMap((unit) => unit.facts);

const indexAssessments = (rubric, factAssessments) => {
  const facts = flattenFacts(rubric);
  const byId = new Map(
    factAssessments.map((assessment) => [assessment.factId, assessment]),
  );
  if (byId.size !== facts.length || facts.some((fact) => !byId.has(fact.id))) {
    throw new Error("La respuesta V3 no evalúa exactamente todos los hechos.");
  }
  for (const fact of facts) {
    const assessment = byId.get(fact.id);
    if (!componentStatuses.includes(assessment.predicate?.status)) {
      throw new Error(`Predicado inválido para ${fact.id}.`);
    }
    const slotsById = new Map(
      (assessment.slots ?? []).map((slot) => [slot.slotId, slot]),
    );
    if (
      slotsById.size !== fact.frame.slots.length ||
      fact.frame.slots.some((slot) => !slotsById.has(slot.slotId)) ||
      [...slotsById.values()].some(
        (slot) => !componentStatuses.includes(slot.status),
      )
    ) {
      throw new Error(`Slots inválidos para ${fact.id}.`);
    }
    assessment.status = deriveFactStatus(assessment);
    if (!factStatuses.includes(assessment.status)) {
      throw new Error(`Estado derivado inválido para ${fact.id}.`);
    }
  }
  return byId;
};

const addFact = (counts, status) => {
  counts.total += 1;
  counts[status] += 1;
};

const addComponent = (counts, status) => {
  counts.total += 1;
  counts[status] += 1;
};

export const summarizeParticipantV3 = (rubric, factAssessments) => {
  const facts = flattenFacts(rubric);
  const assessments = indexAssessments(rubric, factAssessments);
  const overallFacts = emptyFactCounts();
  const overallComponents = emptyComponentCounts();
  const byImportance = Object.fromEntries(
    importanceValues.map((importance) => [
      importance,
      { facts: emptyFactCounts(), components: emptyComponentCounts() },
    ]),
  );

  for (const fact of facts) {
    const assessment = assessments.get(fact.id);
    addFact(overallFacts, assessment.status);
    addFact(byImportance[fact.importance].facts, assessment.status);
    for (const component of [assessment.predicate, ...assessment.slots]) {
      addComponent(overallComponents, component.status);
      addComponent(byImportance[fact.importance].components, component.status);
    }
  }

  return {
    facts: withFactRates(overallFacts),
    components: withComponentRates(overallComponents),
    byImportance: Object.fromEntries(
      importanceValues.map((importance) => [
        importance,
        {
          facts: withFactRates(byImportance[importance].facts),
          components: withComponentRates(byImportance[importance].components),
        },
      ]),
    ),
  };
};

export const summarizeCohortV3 = (rubric, responses) => {
  const participants = responses.map((response) => ({
    id: response.id,
    ...summarizeParticipantV3(rubric, response.factAssessments),
  }));
  const factTotals = emptyFactCounts();
  const componentTotals = emptyComponentCounts();
  for (const participant of participants) {
    for (const key of Object.keys(factTotals)) {
      factTotals[key] += participant.facts[key];
    }
    for (const key of Object.keys(componentTotals)) {
      componentTotals[key] += participant.components[key];
    }
  }
  return {
    participantCount: participants.length,
    facts: withFactRates(factTotals),
    components: withComponentRates(componentTotals),
    participants,
  };
};

export { anchorAssessmentComponents, deriveFactStatus };

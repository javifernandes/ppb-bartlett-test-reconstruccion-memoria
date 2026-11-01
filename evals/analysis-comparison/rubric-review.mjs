const factOverrides = {
  "es-f12": {
    statement: "El anciano le dijo que esperara a que pasaran canoas.",
  },
  "es-f16": {
    statement: "La mujer vio pasar canoas.",
  },
  "es-f29": {
    statement: "Comenzó a llover.",
  },
  "es-f33": {
    statement: "Encontraron la canasta.",
  },
};

export const applyRubricReview = (rubric) => {
  const reviewed = structuredClone(rubric);
  if (reviewed.language !== "es") return reviewed;
  const facts = reviewed.narrativeUnits.flatMap((unit) => unit.facts);
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  for (const [factId, override] of Object.entries(factOverrides)) {
    const fact = factsById.get(factId);
    if (!fact) throw new Error(`No existe el hecho revisado ${factId}.`);
    Object.assign(fact, override);
  }
  reviewed.version = "atomic-facts-v2-reviewed-1";
  reviewed.review = {
    version: "manual-review-1",
    note: "Se separaron del evento base las cantidades y referencias temporales que ya tienen un hecho propio.",
    overriddenFactIds: Object.keys(factOverrides),
  };
  return reviewed;
};

const predicateOverrides = {
  "es-f01": "llegar",
  "es-f02": "ocurrir",
  "es-f07": "venir_de",
  "es-f09": "cantar",
  "es-f11": "prohibir_cruzar",
  "es-f12": "esperar_paso",
  "es-f13": "cantidad_de",
  "es-f14": "justificar",
  "es-f17": "cantidad_de",
  "es-f20": "llegar",
  "es-f21": "escuchar",
  "es-f27": "pronunciar",
  "es-f30": "ocurrir",
  "es-f31": "oír_cantar",
  "es-f34": "ocurrir",
};

export const applyFrameReview = (rubric) => {
  const reviewed = structuredClone(rubric);
  if (reviewed.language !== "es") return reviewed;
  const facts = reviewed.narrativeUnits.flatMap((unit) => unit.facts);
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));

  for (const [factId, label] of Object.entries(predicateOverrides)) {
    const fact = factsById.get(factId);
    if (!fact) throw new Error(`No existe el frame ${factId}.`);
    fact.frame.predicate.label = label;
  }

  const originFact = factsById.get("es-f07");
  originFact.frame.predicate.sourceExcerpt = "venía de la montaña";
  originFact.frame.slots = [
    {
      slotId: "s1",
      role: "agent",
      expected: "mujer",
      sourceExcerpt: "Dijo",
      required: true,
    },
    {
      slotId: "s2",
      role: "source",
      expected: "montaña",
      sourceExcerpt: "la montaña",
      required: true,
    },
  ];

  const findingFact = factsById.get("es-f33");
  findingFact.frame.slots = findingFact.frame.slots
    .filter((slot) => slot.role !== "agent")
    .map((slot, index) => ({ ...slot, slotId: `s${index + 1}` }));

  reviewed.version = "semantic-frames-v3-reviewed-1";
  reviewed.review = {
    version: "manual-frame-review-1",
    predicateOverrideIds: Object.keys(predicateOverrides),
    notes: [
      "El origen de la mujer se evalúa como contenido recordado, sin exigir recordar el acto de habla.",
      "El agente no especificado del hallazgo final no se evalúa como slot.",
      "Tiempo, lugar y argumentos se mantienen en slots en vez de quedar absorbidos por el nombre del predicado.",
    ],
  };
  return reviewed;
};

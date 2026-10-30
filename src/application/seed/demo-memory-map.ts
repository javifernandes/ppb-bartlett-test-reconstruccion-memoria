export type DemoMemoryLevel = "full" | "trace" | "absent";

export type DemoTransformation = {
  kind: "generalization" | "substitution" | "rationalization";
  label: string;
  count: number;
  examples: string[];
};

export type DemoMemoryUnit = {
  id: string;
  text: string;
  concepts?: string[];
  fullCount: number;
  traceCount: number;
  absentCount: number;
  transformations: DemoTransformation[];
};

export const demoMemoryCohortSize = 60;

export const demoMemoryUnits: DemoMemoryUnit[] = [
  {
    id: "river",
    text: "Dos jóvenes bajaron al río",
    fullCount: 52,
    traceCount: 6,
    absentCount: 2,
    transformations: [],
  },
  {
    id: "seals",
    text: "para cazar focas.",
    fullCount: 31,
    traceCount: 14,
    absentCount: 15,
    transformations: [
      {
        kind: "substitution",
        label: "cazar focas → pescar",
        count: 9,
        examples: [
          "Dos amigos fueron al río a pescar.",
          "Había dos jóvenes pescando junto al río.",
        ],
      },
      {
        kind: "generalization",
        label: "focas → animales",
        count: 4,
        examples: ["Bajaron al río para cazar animales."],
      },
    ],
  },
  {
    id: "war-cries",
    text: "Oyeron gritos de guerra",
    fullCount: 43,
    traceCount: 8,
    absentCount: 9,
    transformations: [
      {
        kind: "generalization",
        label: "gritos de guerra → ruidos",
        count: 5,
        examples: ["Escucharon unos ruidos cerca del río."],
      },
    ],
  },
  {
    id: "log",
    text: "y se escondieron detrás de un tronco.",
    fullCount: 27,
    traceCount: 11,
    absentCount: 22,
    transformations: [
      {
        kind: "substitution",
        label: "tronco → árbol",
        count: 8,
        examples: ["Se escondieron detrás de un árbol."],
      },
    ],
  },
  {
    id: "canoe",
    text: "Una canoa con cinco hombres se acercó",
    fullCount: 36,
    traceCount: 15,
    absentCount: 9,
    transformations: [
      {
        kind: "substitution",
        label: "canoa → bote/barco",
        count: 13,
        examples: [
          "Se acercó un bote con varias personas.",
          "Llegó un barco con guerreros.",
        ],
      },
      {
        kind: "generalization",
        label: "cinco hombres → un grupo",
        count: 7,
        examples: ["Un grupo se acercó por el río."],
      },
    ],
  },
  {
    id: "invitation",
    text: "y los invitó a acompañarlos.",
    fullCount: 39,
    traceCount: 9,
    absentCount: 12,
    transformations: [],
  },
  {
    id: "accepted",
    text: "Uno de los jóvenes aceptó;",
    fullCount: 46,
    traceCount: 8,
    absentCount: 6,
    transformations: [],
  },
  {
    id: "returned-home",
    text: "el otro regresó a su casa.",
    fullCount: 30,
    traceCount: 12,
    absentCount: 18,
    transformations: [
      {
        kind: "rationalization",
        label: "agrega una razón familiar",
        count: 6,
        examples: ["El otro volvió porque su familia no sabía dónde estaba."],
      },
    ],
  },
  {
    id: "wounded",
    text: "Al amanecer, el joven que había partido volvió herido",
    fullCount: 38,
    traceCount: 13,
    absentCount: 9,
    transformations: [
      {
        kind: "generalization",
        label: "al amanecer → al día siguiente",
        count: 10,
        examples: ["Volvió herido al día siguiente."],
      },
    ],
  },
  {
    id: "death",
    text: "y murió después de contar lo ocurrido.",
    fullCount: 45,
    traceCount: 8,
    absentCount: 7,
    transformations: [],
  },
];

export const getDemoMemoryLevel = (
  unit: DemoMemoryUnit,
  responseIndex: number,
  unitIndex: number,
): DemoMemoryLevel => {
  const rank = (responseIndex * 17 + unitIndex * 11) % demoMemoryCohortSize;
  if (rank < unit.fullCount) return "full";
  if (rank < unit.fullCount + unit.traceCount) return "trace";
  return "absent";
};

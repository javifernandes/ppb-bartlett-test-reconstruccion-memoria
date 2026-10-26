export const storyUnits = [
  {
    id: "U01",
    importance: "central",
    text: "Dos jóvenes de Egulac bajaron al río durante la noche.",
  },
  {
    id: "U02",
    importance: "detail",
    text: "Su propósito era cazar focas.",
  },
  {
    id: "U03",
    importance: "central",
    text: "Escucharon gritos de guerra provenientes río arriba.",
  },
  {
    id: "U04",
    importance: "secondary",
    text: "Los jóvenes se escondieron detrás de un tronco.",
  },
  {
    id: "U05",
    importance: "central",
    text: "Una canoa con cinco hombres se acercó a ellos.",
  },
  {
    id: "U06",
    importance: "central",
    text: "Los hombres dijeron que iban a combatir a un pueblo río arriba.",
  },
  {
    id: "U07",
    importance: "central",
    text: "Invitaron a los dos jóvenes a acompañarlos.",
  },
  {
    id: "U08",
    importance: "detail",
    text: "Uno de los jóvenes respondió que no tenía flechas.",
  },
  {
    id: "U09",
    importance: "detail",
    text: "Los hombres le aseguraron que había flechas en la canoa.",
  },
  {
    id: "U10",
    importance: "secondary",
    text: "El otro joven decidió regresar a su casa porque su familia no sabía dónde estaba.",
  },
  {
    id: "U11",
    importance: "central",
    text: "El primer joven partió con los hombres y participó en el combate.",
  },
  {
    id: "U12",
    importance: "central",
    text: "Durante el combate recibió una herida que, según dijo, no provenía de una flecha.",
  },
  {
    id: "U13",
    importance: "secondary",
    text: "Al amanecer volvió a Egulac y relató lo sucedido.",
  },
  {
    id: "U14",
    importance: "central",
    text: "Cuando terminó de hablar cayó al suelo y murió.",
  },
  {
    id: "U15",
    importance: "detail",
    text: "Al abrirle la chaqueta, su familia encontró algo negro saliendo de su boca.",
  },
  {
    id: "U16",
    importance: "central",
    text: "La gente concluyó que había participado en una batalla de fantasmas.",
  },
];

export const story = storyUnits.map((unit) => unit.text).join(" ");

const allUnitIds = storyUnits.map((unit) => unit.id);

const expectation = ({
  retained = [],
  partial = [],
  transformations = [],
  intrusionCount = 0,
}) => ({
  statuses: Object.fromEntries(
    allUnitIds.map((id) => [
      id,
      retained.includes(id)
        ? "retained"
        : partial.includes(id)
          ? "partial"
          : "omitted",
    ]),
  ),
  transformations,
  intrusionCount,
});

export const cases = [
  {
    id: "literal-copy",
    description: "Control positivo: reproducción literal completa.",
    recall: story,
    expected: expectation({ retained: allUnitIds }),
  },
  {
    id: "faithful-paraphrase",
    description:
      "Conserva el significado con cambios léxicos y sintácticos normales.",
    recall:
      "De noche, dos muchachos de Egulac fueron al río a buscar focas. Oyeron voces de guerra que venían de río arriba y se ocultaron tras un tronco. Llegó una canoa en la que viajaban cinco hombres. Iban a luchar contra otra aldea e invitaron a los jóvenes. Uno dijo que no llevaba flechas, pero le explicaron que tenían algunas a bordo. El segundo volvió a casa porque su familia ignoraba dónde estaba. El primero fue al combate, quedó herido por algo que afirmó que no era una flecha y regresó al amanecer. Contó lo ocurrido, murió al terminar y de su boca salió una sustancia negra. Los pobladores pensaron que había luchado con fantasmas.",
    expected: expectation({ retained: allUnitIds }),
  },
  {
    id: "compressed-recall",
    description: "Recuerdo esquemático con conservación de la cadena central.",
    recall:
      "Dos jóvenes fueron al río. Llegó una canoa con guerreros que iban a pelear y los invitaron. Uno se fue con ellos. Volvió herido al amanecer, contó lo ocurrido y murió. La gente creyó que había sido una guerra de fantasmas.",
    expected: expectation({
      retained: ["U01", "U05", "U06", "U07", "U11", "U13", "U14", "U16"],
      partial: ["U12"],
    }),
  },
  {
    id: "conventional-substitutions",
    description:
      "Conserva eventos, pero reemplaza elementos por formas más convencionales.",
    recall:
      "Dos pescadores bajaron al río a pescar. Escucharon gritos y se escondieron. Un bote con cinco soldados se acercó. Los soldados iban a una guerra y los invitaron. Uno dijo que no tenía rifles, pero le contestaron que había armas en el bote. El otro regresó con su familia. El primero fue a luchar, volvió herido, contó la historia y murió.",
    expected: expectation({
      retained: [
        "U01",
        "U03",
        "U04",
        "U05",
        "U06",
        "U07",
        "U09",
        "U10",
        "U11",
        "U13",
        "U14",
      ],
      partial: ["U02", "U08", "U12"],
      transformations: [
        { kind: "substitution", unitId: "U01" },
        { kind: "substitution", unitId: "U02" },
        { kind: "substitution", unitId: "U05" },
        { kind: "substitution", unitId: "U06" },
        { kind: "substitution", unitId: "U08" },
        { kind: "substitution", unitId: "U09" },
      ],
    }),
  },
  {
    id: "intrusions",
    description: "Incluye dos agregados sin respaldo en la historia.",
    recall:
      "Dos jóvenes bajaron al río para cazar focas y escucharon gritos de guerra. Se escondieron detrás de un tronco. Había una tormenta muy fuerte y un automóvil rojo los esperaba en la orilla. Después llegó una canoa con cinco hombres que los invitaron a combatir río arriba.",
    expected: expectation({
      retained: ["U01", "U02", "U03", "U04", "U05", "U06", "U07"],
      intrusionCount: 2,
    }),
  },
  {
    id: "negation-trap",
    description:
      "Repite vocabulario de la historia, pero niega relaciones importantes.",
    recall:
      "Dos jóvenes de Egulac fueron al río, pero no escucharon gritos de guerra y nunca se escondieron. La canoa tenía cinco hombres, aunque ellos no invitaron a los jóvenes. Ninguno fue al combate y ambos regresaron sanos a sus casas.",
    expected: expectation({
      retained: ["U01", "U05"],
      partial: ["U03", "U04", "U07", "U11", "U12"],
      transformations: [
        { kind: "contradiction", unitId: "U03" },
        { kind: "contradiction", unitId: "U04" },
        { kind: "contradiction", unitId: "U07" },
        { kind: "contradiction", unitId: "U11" },
        { kind: "contradiction", unitId: "U12" },
      ],
    }),
  },
  {
    id: "causal-rationalization",
    description:
      "Introduce explicaciones familiares para hechos extraños o no explicados.",
    recall:
      "Dos jóvenes fueron al río y se cruzaron con soldados que iban a defender una aldea de un ataque. Uno los acompañó porque quería demostrar que era valiente; el otro volvió para no preocupar a sus padres. El joven fue herido por una bala, regresó a la mañana y murió por la pérdida de sangre. Su familia pensó que la sustancia oscura de su boca era sangre coagulada.",
    expected: expectation({
      retained: ["U01", "U05", "U06", "U07", "U10", "U11", "U13", "U14", "U15"],
      partial: ["U12"],
      transformations: [
        { kind: "rationalization", unitId: "U06" },
        { kind: "rationalization", unitId: "U10" },
        { kind: "rationalization", unitId: "U11" },
        { kind: "substitution", unitId: "U12" },
        { kind: "rationalization", unitId: "U14" },
        { kind: "rationalization", unitId: "U15" },
      ],
    }),
  },
  {
    id: "realistic-noisy-recall",
    description: "Reconstrucción breve, coloquial e imprecisa.",
    recall:
      "Eran dos tipos que estaban pescando focas de noche. Escucharon una guerra y se escondieron. Vinieron varios en unas canoas y uno de los chicos se fue con ellos aunque no tenía flechas. El otro se quedó porque la familia no sabía dónde estaba. El que fue volvió lastimado, contó lo que había pasado y se murió. Creo que era algo de fantasmas.",
    expected: expectation({
      retained: [
        "U01",
        "U02",
        "U03",
        "U04",
        "U05",
        "U06",
        "U07",
        "U08",
        "U10",
        "U11",
        "U13",
        "U14",
        "U16",
      ],
      partial: ["U12"],
      transformations: [
        { kind: "substitution", unitId: "U02" },
        { kind: "substitution", unitId: "U05" },
      ],
    }),
  },
  {
    id: "ultra-short-summary",
    description:
      "Resumen extremo que conserva algunos hitos mediante frases mínimas.",
    recall:
      "Dos jóvenes, una canoa y una guerra. Uno volvió herido y murió. Eran fantasmas.",
    expected: expectation({
      retained: ["U14"],
      partial: ["U01", "U03", "U05", "U12", "U13", "U16"],
    }),
  },
  {
    id: "keyword-salad",
    description:
      "Palabras aisladas sin relaciones suficientes; evita confundir coincidencia léxica con recuerdo proposicional.",
    recall:
      "focas, canoa, cinco hombres, flechas, herida, algo negro, fantasmas",
    expected: expectation({
      partial: ["U05"],
    }),
  },
  {
    id: "typo-heavy",
    description:
      "Reconstrucción comprensible con errores ortográficos frecuentes.",
    recall:
      "Dos jobenes de egulac fueron al rio a casar focas. Escucharon gritos de gerra y se escondieron atras de un tronco. Vino una canoa con sinco hombres que los invitaron a pelear. Uno fue y el otro volvio a su casa por la familia. El primero regreso erido, conto todo y murio. Dijeron que fue una vatalla de fantasmas.",
    expected: expectation({
      retained: [
        "U01",
        "U02",
        "U03",
        "U04",
        "U05",
        "U06",
        "U07",
        "U10",
        "U11",
        "U13",
        "U14",
        "U16",
      ],
      partial: ["U12"],
    }),
  },
  {
    id: "reordered-events",
    description:
      "Los eventos aparecen fuera de orden, pero conservan su contenido.",
    recall:
      "La gente dijo que había sido una batalla de fantasmas porque el joven murió después de contar su historia. Había regresado herido al amanecer. Antes, él y otro joven habían ido al río a cazar focas. Una canoa con cinco hombres los invitó a combatir río arriba. Uno fue con ellos y el otro volvió a su casa porque su familia no sabía dónde estaba.",
    expected: expectation({
      retained: [
        "U01",
        "U02",
        "U05",
        "U06",
        "U07",
        "U10",
        "U11",
        "U13",
        "U14",
        "U16",
      ],
      partial: ["U12"],
    }),
  },
  {
    id: "single-fragment",
    description: "La persona recuerda solamente un fragmento.",
    recall: "Había una canoa, nada más.",
    expected: expectation({
      partial: ["U05"],
    }),
  },
  {
    id: "keyword-contradictions",
    description:
      "Contiene vocabulario original, pero niega explícitamente los acontecimientos.",
    recall:
      "No había ninguna canoa, el joven sí tenía flechas, nunca volvió a Egulac y no murió.",
    expected: expectation({
      partial: ["U05", "U08", "U13", "U14"],
      transformations: [
        { kind: "contradiction", unitId: "U05" },
        { kind: "contradiction", unitId: "U08" },
        { kind: "contradiction", unitId: "U13" },
        { kind: "contradiction", unitId: "U14" },
      ],
    }),
  },
  {
    id: "unrelated-recall",
    description: "Respuesta fluida pero completamente ajena a la historia.",
    recall:
      "Un perro cruzó la plaza durante una tormenta. Después llegó un médico en automóvil y lo llevó a un hospital.",
    expected: expectation({
      intrusionCount: 2,
    }),
  },
];

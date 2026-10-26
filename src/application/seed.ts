import { demoMemoryUnits, getDemoMemoryLevel } from "./demo-memory-map";

const demoExperimentId = "experiment-complete-demo";
const bilingualDemoExperimentId = "experiment-bilingual-demo";
const demoRunId = "analysis-complete-demo";
const demoStory =
  "Dos jóvenes bajaron al río para cazar focas. Oyeron gritos de guerra y se escondieron detrás de un tronco. Una canoa con cinco hombres se acercó y los invitó a acompañarlos. Uno de los jóvenes aceptó; el otro regresó a su casa. Al amanecer, el joven que había partido volvió herido y murió después de contar lo ocurrido.";

const demoClientMetadata = {
  browserLocale: "es-AR",
  timezone: "America/Argentina/Buenos_Aires",
  deviceType: "mobile" as const,
  browser: "Chrome",
  operatingSystem: "Android",
  screenWidth: 393,
  screenHeight: 873,
};

const createBilingualDemoSessions = () =>
  Array.from({ length: 72 }, (_, index) => {
    const startedAt = new Date(Date.UTC(2026, 9, 24, 10, index * 4));
    const status =
      index % 9 === 0
        ? ("reading" as const)
        : index % 9 === 1
          ? ("interval" as const)
          : index % 9 === 2
            ? ("recalling" as const)
            : ("submitted" as const);
    const intervalStartedAt =
      status === "reading"
        ? null
        : new Date(startedAt.getTime() + 45_000).toISOString();
    const recallingStartedAt =
      status === "reading" || status === "interval"
        ? null
        : new Date(startedAt.getTime() + 55_000).toISOString();
    const submittedAt =
      status === "submitted"
        ? new Date(
            startedAt.getTime() + (95 + (index % 7) * 12) * 1_000,
          ).toISOString()
        : null;
    const lastActivityAt =
      submittedAt ??
      recallingStartedAt ??
      intervalStartedAt ??
      new Date(startedAt.getTime() + 25_000).toISOString();
    const contentLanguage = index % 3 === 0 ? ("en" as const) : ("es" as const);

    return {
      id: `session-bilingual-${String(index + 1).padStart(3, "0")}`,
      experiment: bilingualDemoExperimentId,
      contentLanguage,
      countryCode: ["AR", "US", "BR", "MX"][index % 4],
      ...demoClientMetadata,
      browserLocale: contentLanguage === "en" ? "en-US" : "es-AR",
      timezone:
        index % 4 === 1 ? "America/New_York" : "America/Argentina/Buenos_Aires",
      deviceType:
        index % 5 === 0
          ? ("desktop" as const)
          : index % 5 === 1
            ? ("tablet" as const)
            : ("mobile" as const),
      status,
      startedAt: startedAt.toISOString(),
      intervalStartedAt,
      recallingStartedAt,
      lastActivityAt,
      recallText:
        status === "submitted"
          ? contentLanguage === "es"
            ? `Dos jóvenes estaban junto al río. Llegó una canoa y uno acompañó a los guerreros. Reconstrucción ${index + 1}.`
            : `Two young men were by the river. A canoe arrived and one joined the warriors. Recall ${index + 1}.`
          : null,
      submittedAt,
    };
  });

const demoRecallTemplates = [
  "Dos jóvenes bajaron al río para cazar focas. Escucharon gritos y se escondieron. Llegó una canoa con cinco hombres; uno se fue con ellos y el otro volvió a su casa. Al amanecer regresó herido, contó lo ocurrido y murió.",
  "Dos amigos fueron al río a pescar. Oyeron ruidos de guerra detrás de un árbol. Un bote con varias personas los invitó y uno aceptó. Volvió herido al día siguiente y falleció.",
  "Dos jóvenes estaban cerca del río. Un barco con guerreros se acercó y les pidió que fueran con ellos. Uno fue, el otro regresó con su familia. El primero volvió herido y murió.",
  "Unos muchachos cazaban animales en el río. Escucharon gritos y se escondieron detrás de un tronco. Llegó una canoa; uno acompañó al grupo y después volvió lastimado.",
  "Dos jóvenes fueron al río. Había una canoa con cinco hombres que iban a una guerra. Uno los acompañó mientras el otro se fue a su casa. A la mañana siguiente el joven regresó herido y murió.",
  "Dos chicos pescaban. Escucharon algo y se ocultaron. Llegó un bote, uno de ellos se fue y luego volvió herido.",
  "Dos jóvenes, un río y una canoa. Uno se unió a los hombres y el otro regresó a casa. Más tarde el primero murió.",
  "Unos jóvenes estaban junto al río cuando se acercó un grupo en barco. Invitaron a uno a ir con ellos. Volvió herido al amanecer, contó lo sucedido y murió.",
];

const createAnalysisDemoSessions = () =>
  Array.from({ length: 60 }, (_, index) => {
    const startedAt = new Date(Date.UTC(2026, 9, 22, 9, 5 + index * 3));
    const intervalStartedAt = new Date(startedAt.getTime() + 35_000);
    const recallingStartedAt = new Date(intervalStartedAt.getTime() + 10_000);
    const submittedAt = new Date(
      recallingStartedAt.getTime() + (42 + (index % 9) * 8) * 1_000,
    );

    return {
      id: `session-demo-${String(index + 1).padStart(2, "0")}`,
      experiment: demoExperimentId,
      contentLanguage: "es" as const,
      countryCode: ["AR", "UY", "MX", "US", "CL", "CO"][index % 6],
      ...demoClientMetadata,
      deviceType: index % 5 === 0 ? ("desktop" as const) : ("mobile" as const),
      status: "submitted" as const,
      startedAt: startedAt.toISOString(),
      intervalStartedAt: intervalStartedAt.toISOString(),
      recallingStartedAt: recallingStartedAt.toISOString(),
      lastActivityAt: submittedAt.toISOString(),
      recallText: demoRecallTemplates[index % demoRecallTemplates.length],
      submittedAt: submittedAt.toISOString(),
    };
  });

const createAnalysisDemoResults = () =>
  Array.from({ length: 60 }, (_, responseIndex) => {
    const levels = demoMemoryUnits.map((unit, unitIndex) => ({
      unit,
      level: getDemoMemoryLevel(unit, responseIndex, unitIndex),
    }));
    const retainedUnitsCount = levels.filter(
      ({ level }) => level !== "absent",
    ).length;
    const omittedUnitsCount = levels.length - retainedUnitsCount;

    return {
      id: `recall-analysis-demo-${String(responseIndex + 1).padStart(2, "0")}`,
      run: demoRunId,
      session: `session-demo-${String(responseIndex + 1).padStart(2, "0")}`,
      experiment: demoExperimentId,
      status: "completed" as const,
      rubricVersion: "bartlett-memory-map-demo-v1",
      analyzerProvider: "fixture",
      analyzerModel: "synthetic-cohort",
      promptVersion: "recall-units-v2",
      inputTokens: null,
      outputTokens: null,
      retainedUnitsCount,
      omittedUnitsCount,
      intrusionCount: responseIndex % 11 === 0 ? 1 : 0,
      phenomena: levels
        .filter(({ level }) => level === "absent")
        .slice(0, 3)
        .map(({ unit }) => ({
          kind: "omission",
          storyExcerpt: unit.text,
          recallExcerpt: null,
          explanation: "Unidad narrativa no recuperada.",
          confidence: 0.9,
        })),
      unitAssessments: levels.map(({ unit, level }) => ({
        unitId: unit.id,
        presence: level,
        recallExcerpt: level === "absent" ? null : unit.text,
        confidence: 0.9,
      })),
      createdAt: new Date(
        Date.UTC(2026, 9, 22, 12, responseIndex),
      ).toISOString(),
    };
  });

export const createBartlettSeed = (demoEnabled: boolean) => ({
  Experiment: [
    {
      id: "experiment-wizard-of-oz",
      title: "Reconstrucción de una historia — prueba piloto",
      participantTitle: "Prueba de memoria",
      introduction:
        "Vas a leer una historia y luego te pediremos que la reconstruyas de memoria.",
      consentText:
        "Acepto participar voluntariamente y comprendo que puedo abandonar la actividad antes de enviar mi respuesta.",
      story:
        "Dos jóvenes de Egulac bajaron al río para cazar focas. Mientras estaban allí, una canoa con cinco hombres se acercó.",
      recallInstructions:
        "Escribí todo lo que recuerdes, con el mayor detalle posible.",
      primaryLanguage: "es" as const,
      alternateLanguage: null,
      alternateParticipantTitle: null,
      alternateIntroduction: null,
      alternateConsentText: null,
      alternateStory: null,
      alternateRecallInstructions: null,
      intervalSeconds: 0,
      distractorEnabled: false,
      status: "draft" as const,
      createdAt: "2026-10-22T00:00:00.000Z",
      publishedAt: null,
      publicToken: null,
      analysisRunId: null,
      analysisRubrics: null,
      analysisPreparedAt: null,
    },
    ...(demoEnabled
      ? [
          {
            id: bilingualDemoExperimentId,
            title: "Demo bilingüe — español e inglés",
            participantTitle: "Prueba de memoria",
            introduction:
              "Leé la historia y luego reconstruí todo lo que recuerdes.",
            consentText: "Acepto participar voluntariamente.",
            story: demoStory,
            recallInstructions:
              "Escribí todo lo que recuerdes, con el mayor detalle posible.",
            primaryLanguage: "es" as const,
            alternateLanguage: "en" as const,
            alternateParticipantTitle: "Memory test",
            alternateIntroduction:
              "Read the story and then reconstruct everything you remember.",
            alternateConsentText: "I voluntarily agree to participate.",
            alternateStory:
              "Two young men went down to the river to hunt seals. They heard war cries and hid behind a log. A canoe with five men approached and invited them to come along. One accepted; the other returned home. At dawn, the young man who had left returned wounded and died after telling what had happened.",
            alternateRecallInstructions:
              "Write everything you remember, with as much detail as possible.",
            intervalSeconds: 10,
            distractorEnabled: true,
            status: "published" as const,
            createdAt: "2026-10-22T08:00:00.000Z",
            publishedAt: "2026-10-22T08:01:00.000Z",
            publicToken: "demo-bilingue",
            analysisRunId: null,
            analysisRubrics: null,
            analysisPreparedAt: null,
          },
          {
            id: demoExperimentId,
            title: "Demo completa — análisis de reconstrucciones",
            participantTitle: "Prueba de memoria",
            introduction: "Leé la historia y reconstruí todo lo que recuerdes.",
            consentText: "Acepto participar voluntariamente.",
            story: demoStory,
            recallInstructions:
              "Escribí todo lo que recuerdes, con el mayor detalle posible.",
            primaryLanguage: "es" as const,
            alternateLanguage: "en" as const,
            alternateParticipantTitle: "Memory test",
            alternateIntroduction:
              "Read the story and reconstruct everything you remember.",
            alternateConsentText: "I voluntarily agree to participate.",
            alternateStory:
              "Two young men went down to the river to hunt seals. They heard war cries and hid behind a log. A canoe with five men approached and invited them to come along. One accepted; the other returned home. At dawn, the young man who had left returned wounded and died after telling what had happened.",
            alternateRecallInstructions:
              "Write everything you remember, with as much detail as possible.",
            intervalSeconds: 10,
            distractorEnabled: true,
            status: "closed" as const,
            createdAt: "2026-10-22T09:00:00.000Z",
            publishedAt: "2026-10-22T09:01:00.000Z",
            publicToken: "demo-completa",
            analysisRunId: demoRunId,
            analysisRubrics: [
              {
                language: "es",
                version: "story-units-v1",
                units: demoMemoryUnits.map(({ id, text }) => ({ id, text })),
              },
            ],
            analysisPreparedAt: "2026-10-22T09:00:30.000Z",
          },
        ]
      : []),
  ],
  ParticipantSession: demoEnabled
    ? [...createBilingualDemoSessions(), ...createAnalysisDemoSessions()]
    : [],
  AnalysisRun: demoEnabled
    ? [
        {
          id: demoRunId,
          experiment: demoExperimentId,
          status: "completed" as const,
          analyzerVersion: "local:demo-fixture-v1",
          createdAt: "2026-10-22T09:15:00.000Z",
        },
      ]
    : [],
  RecallAnalysis: demoEnabled ? createAnalysisDemoResults() : [],
});

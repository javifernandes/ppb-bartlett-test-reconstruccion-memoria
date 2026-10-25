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
          },
        ]
      : []),
  ],
  ParticipantSession: demoEnabled
    ? [
        ...createBilingualDemoSessions(),
        {
          id: "session-demo-1",
          experiment: demoExperimentId,
          contentLanguage: "es" as const,
          countryCode: "AR",
          ...demoClientMetadata,
          status: "submitted" as const,
          startedAt: "2026-10-22T09:05:00.000Z",
          intervalStartedAt: "2026-10-22T09:05:45.000Z",
          recallingStartedAt: "2026-10-22T09:05:55.000Z",
          lastActivityAt: "2026-10-22T09:07:10.000Z",
          recallText:
            "Dos jóvenes cazaban focas junto al río. Llegó una canoa con cinco guerreros y uno de ellos se fue con el grupo. Volvió herido al día siguiente y murió.",
          submittedAt: "2026-10-22T09:07:10.000Z",
        },
        {
          id: "session-demo-2",
          experiment: demoExperimentId,
          contentLanguage: "es" as const,
          countryCode: "UY",
          ...demoClientMetadata,
          status: "submitted" as const,
          startedAt: "2026-10-22T09:10:00.000Z",
          intervalStartedAt: "2026-10-22T09:10:30.000Z",
          recallingStartedAt: "2026-10-22T09:10:40.000Z",
          lastActivityAt: "2026-10-22T09:11:20.000Z",
          recallText:
            "Dos amigos estaban pescando. Un barco los invitó a una batalla. Uno regresó enfermo y luego falleció.",
          submittedAt: "2026-10-22T09:11:20.000Z",
        },
      ]
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
  RecallAnalysis: demoEnabled
    ? [
        {
          id: "recall-analysis-demo-1",
          run: demoRunId,
          session: "session-demo-1",
          experiment: demoExperimentId,
          status: "completed" as const,
          rubricVersion: "bartlett-demo-v1",
          analyzerProvider: "fixture",
          analyzerModel: "manual-example",
          promptVersion: "none",
          inputTokens: null,
          outputTokens: null,
          retainedUnitsCount: 4,
          omittedUnitsCount: 2,
          intrusionCount: 0,
          phenomena: [
            {
              kind: "omission",
              storyExcerpt: "el otro regresó a su casa",
              recallExcerpt: null,
              explanation:
                "La reconstrucción no menciona al joven que decidió regresar.",
              confidence: 0.96,
            },
          ],
          createdAt: "2026-10-22T09:15:01.000Z",
        },
        {
          id: "recall-analysis-demo-2",
          run: demoRunId,
          session: "session-demo-2",
          experiment: demoExperimentId,
          status: "completed" as const,
          rubricVersion: "bartlett-demo-v1",
          analyzerProvider: "fixture",
          analyzerModel: "manual-example",
          promptVersion: "none",
          inputTokens: null,
          outputTokens: null,
          retainedUnitsCount: 2,
          omittedUnitsCount: 4,
          intrusionCount: 0,
          phenomena: [
            {
              kind: "substitution",
              storyExcerpt: "cazar focas",
              recallExcerpt: "pescando",
              explanation:
                "La actividad poco familiar fue reemplazada por otra más convencional.",
              confidence: 0.92,
            },
            {
              kind: "substitution",
              storyExcerpt: "Una canoa",
              recallExcerpt: "Un barco",
              explanation:
                "La canoa de la historia fue reconstruida como un barco.",
              confidence: 0.94,
            },
          ],
          createdAt: "2026-10-22T09:15:02.000Z",
        },
      ]
    : [],
});

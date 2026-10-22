import { createInMemoryDataGraphStorage } from "@ontahi/core/data-graph";
import { inProcessTasks, ontahi } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";
import { RecallAnalysis } from "./recall-analysis";

const demoEnabled = process.env.SEED_DEMO_DATA === "true";
const demoExperimentId = "experiment-complete-demo";
const demoRunId = "analysis-complete-demo";
const demoStory =
  "Dos jóvenes bajaron al río para cazar focas. Oyeron gritos de guerra y se escondieron detrás de un tronco. Una canoa con cinco hombres se acercó y los invitó a acompañarlos. Uno de los jóvenes aceptó; el otro regresó a su casa. Al amanecer, el joven que había partido volvió herido y murió después de contar lo ocurrido.";

const createBartlettApplication = () => {
  const storage = createInMemoryDataGraphStorage({
    dataset: {
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
          intervalSeconds: 0,
          distractorEnabled: false,
          status: "draft",
          createdAt: "2026-10-22T00:00:00.000Z",
          publishedAt: null,
          publicToken: null,
        },
        ...(demoEnabled
          ? [
              {
                id: demoExperimentId,
                title: "Demo completa — análisis de reconstrucciones",
                participantTitle: "Prueba de memoria",
                introduction:
                  "Leé la historia y reconstruí todo lo que recuerdes.",
                consentText: "Acepto participar voluntariamente.",
                story: demoStory,
                recallInstructions:
                  "Escribí todo lo que recuerdes, con el mayor detalle posible.",
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
            {
              id: "session-demo-1",
              experiment: Experiment.refById(demoExperimentId),
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
              experiment: Experiment.refById(demoExperimentId),
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
              experiment: Experiment.refById(demoExperimentId),
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
              run: AnalysisRun.refById(demoRunId),
              session: ParticipantSession.refById("session-demo-1"),
              experiment: Experiment.refById(demoExperimentId),
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
              run: AnalysisRun.refById(demoRunId),
              session: ParticipantSession.refById("session-demo-2"),
              experiment: Experiment.refById(demoExperimentId),
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
    },
  });

  return ontahi({
    storage,
    tasks: inProcessTasks(),
    entities: [Experiment, ParticipantSession, AnalysisRun, RecallAnalysis],
  });
};

const developmentGlobal = globalThis as typeof globalThis & {
  bartlettApplication?: ReturnType<typeof createBartlettApplication>;
};

export const BartlettApplication =
  process.env.NODE_ENV === "development"
    ? (developmentGlobal.bartlettApplication ??= createBartlettApplication())
    : createBartlettApplication();

export { AnalysisRun, Experiment, ParticipantSession, RecallAnalysis };

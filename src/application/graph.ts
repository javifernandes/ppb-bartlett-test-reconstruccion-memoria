import { createInMemoryDataGraphStorage } from "@ontahi/core/data-graph";
import { inProcessTasks, ontahi } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";
import { RecallAnalysis } from "./recall-analysis";

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
      ],
      ParticipantSession: [],
      AnalysisRun: [],
      RecallAnalysis: [],
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

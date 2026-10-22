import { createInMemoryDataGraphStorage } from "@ontahi/core/data-graph";
import { inProcessTasks, ontahi } from "@ontahi/core/runtime/server";

import { Experiment } from "./experiment";

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
  },
});

export const BartlettApplication = ontahi({
  storage,
  tasks: inProcessTasks(),
  entities: [Experiment],
});

export { Experiment };

import { describe, expect, it } from "vitest";
import { query } from "@ontahi/core/data-graph";

import { BartlettApplication, Experiment, ParticipantSession } from "./graph";

describe("Bartlett application bootstrap", () => {
  it("runs a Query and an Operation against in-memory storage", async () => {
    const initial = await BartlettApplication.graph.read(query(Experiment), {
      scope: "bootstrap.initial-experiments",
    });

    expect(initial).toHaveLength(1);

    const created = await Experiment.createDraft({
      id: "experiment-test",
      title: "Experimento de prueba",
      story: "Una historia de prueba suficientemente concreta.",
      createdAt: "2026-10-22T12:00:00.000Z",
    });

    expect(created.ok).toBe(true);

    const updated = await Experiment.updateDraft({
      experiment: Experiment.refById("experiment-test"),
      title: "Experimento editado",
      participantTitle: "Una prueba de memoria",
      introduction: "Leé atentamente la siguiente historia.",
      consentText: "Acepto participar voluntariamente.",
      story: "La historia fue editada.",
      recallInstructions: "Escribí todo lo que recuerdes.",
      intervalSeconds: 30,
      distractorEnabled: true,
    });

    expect(updated).toMatchObject({
      ok: true,
      value: { title: "Experimento editado" },
    });

    const published = await Experiment.publish({
      experiment: Experiment.refById("experiment-test"),
      publishedAt: "2026-10-22T13:00:00.000Z",
      publicToken: "public-test-token",
    });

    expect(published).toMatchObject({
      ok: true,
      value: {
        status: "published",
        publicToken: "public-test-token",
      },
    });

    const rejectedUpdate = await Experiment.updateDraft({
      experiment: Experiment.refById("experiment-test"),
      title: "No debe cambiar",
      participantTitle: "No debe cambiar",
      introduction: "No debe cambiar",
      consentText: "No debe cambiar",
      story: "No debe cambiar",
      recallInstructions: "No debe cambiar",
      intervalSeconds: 0,
      distractorEnabled: false,
    });

    expect(rejectedUpdate).toMatchObject({
      ok: false,
      failure: { reason: "experiment_not_editable" },
    });

    const session = await ParticipantSession.start({
      id: "session-test",
      experiment: Experiment.refById("experiment-test"),
      startedAt: "2026-10-22T13:05:00.000Z",
    });
    expect(session).toMatchObject({
      ok: true,
      value: { status: "reading" },
    });

    const recalling = await ParticipantSession.startRecall({
      session: ParticipantSession.refById("session-test"),
    });
    expect(recalling).toMatchObject({
      ok: true,
      value: { status: "recalling" },
    });

    const submitted = await ParticipantSession.submitRecall({
      session: ParticipantSession.refById("session-test"),
      recallText: "Recuerdo que la historia había sido editada.",
      submittedAt: "2026-10-22T13:10:00.000Z",
    });
    expect(submitted).toMatchObject({
      ok: true,
      value: {
        status: "submitted",
        recallText: "Recuerdo que la historia había sido editada.",
      },
    });

    const experiments = await BartlettApplication.graph.read(
      query(Experiment).orderBy((experiment) => experiment.title),
      { scope: "bootstrap.created-experiments" },
    );

    expect(experiments.map((experiment) => experiment.title)).toEqual([
      "Experimento editado",
      "Reconstrucción de una historia — prueba piloto",
    ]);
  });
});

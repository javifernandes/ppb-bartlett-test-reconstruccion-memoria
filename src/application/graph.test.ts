import { describe, expect, it } from "vitest";
import { query } from "@ontahi/core/data-graph";

import { BartlettApplication, Experiment } from "./graph";

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
      story: "La historia fue editada.",
    });

    expect(updated).toMatchObject({
      ok: true,
      value: { title: "Experimento editado" },
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

import { describe, expect, it } from "vitest";

import { summarizeCohort, summarizeParticipant } from "./metrics.mjs";

const rubric = {
  narrativeUnits: [
    {
      id: "u1",
      facts: [
        { id: "f1", importance: "backbone", statement: "Núcleo 1" },
        { id: "f2", importance: "backbone", statement: "Núcleo 2" },
        { id: "f3", importance: "supporting", statement: "Apoyo" },
        { id: "f4", importance: "detail", statement: "Detalle" },
      ],
    },
  ],
};

const assessments = (statuses) =>
  Object.entries(statuses).map(([factId, status]) => ({ factId, status }));

describe("v2 analysis metrics", () => {
  it("separates presence from strict fidelity", () => {
    const summary = summarizeParticipant(
      rubric,
      assessments({
        f1: "preserved",
        f2: "transformed",
        f3: "omitted",
        f4: "preserved",
      }),
    );

    expect(summary.byImportance.backbone.presenceRate).toBe(1);
    expect(summary.byImportance.backbone.fidelityRate).toBe(0.5);
    expect(summary.secondary.presenceRate).toBe(0.5);
    expect(summary.profileCoordinates).toEqual({
      backbonePresence: 1,
      backboneFidelity: 0.5,
      secondaryPresence: 0.5,
      secondaryFidelity: 0.5,
    });
  });

  it("ranks stable and omitted facts across participants", () => {
    const summary = summarizeCohort(rubric, [
      {
        id: "p1",
        factAssessments: assessments({
          f1: "preserved",
          f2: "transformed",
          f3: "omitted",
          f4: "preserved",
        }),
      },
      {
        id: "p2",
        factAssessments: assessments({
          f1: "preserved",
          f2: "omitted",
          f3: "omitted",
          f4: "transformed",
        }),
      },
    ]);

    expect(summary.participantCount).toBe(2);
    expect(summary.rankings.mostRemembered[0].id).toBe("f1");
    expect(summary.rankings.mostOmitted[0].id).toBe("f3");
    expect(summary.facts.find((fact) => fact.id === "f2")).toMatchObject({
      presenceRate: 0.5,
      fidelityRate: 0,
      omissionRate: 0.5,
      transformationRate: 1,
    });
  });

  it("rejects incomplete assessments instead of hiding missing data", () => {
    expect(() =>
      summarizeParticipant(
        rubric,
        assessments({ f1: "preserved", f2: "omitted" }),
      ),
    ).toThrow("exactamente todos los hechos");
  });
});

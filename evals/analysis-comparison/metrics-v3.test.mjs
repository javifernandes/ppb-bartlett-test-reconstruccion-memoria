import { describe, expect, it } from "vitest";

import { anchorAssessmentComponents, deriveFactStatus } from "./metrics-v3.mjs";

const assessment = (predicate, slots) => ({
  predicate: { status: predicate },
  slots: slots.map((status) => ({ status })),
});

describe("anchorAssessmentComponents", () => {
  it("does not reuse an entity mention as evidence when the fact predicate is absent", () => {
    const result = anchorAssessmentComponents({
      predicate: { status: "omitted", evidence: null, observedValue: null },
      slots: [
        {
          status: "preserved",
          evidence: "Una señora",
          observedValue: "señora",
          confidence: 0.6,
        },
      ],
    });

    expect(result.slots[0]).toMatchObject({
      status: "omitted",
      evidence: null,
      observedValue: null,
      anchored: false,
      anchoringReason: "predicate_omitted",
    });
  });

  it("keeps role assessments when the predicate is present", () => {
    const input = assessment("preserved", ["preserved"]);
    expect(anchorAssessmentComponents(input)).toBe(input);
  });
});

describe("deriveFactStatus", () => {
  it("requires the predicate for fact presence", () => {
    expect(deriveFactStatus(assessment("omitted", ["preserved"]))).toBe(
      "omitted",
    );
  });

  it("distinguishes partial retention from transformation", () => {
    expect(
      deriveFactStatus(assessment("preserved", ["preserved", "omitted"])),
    ).toBe("partial");
    expect(
      deriveFactStatus(assessment("preserved", ["preserved", "transformed"])),
    ).toBe("transformed");
  });

  it("marks a fully retained frame as preserved", () => {
    expect(
      deriveFactStatus(assessment("preserved", ["preserved", "preserved"])),
    ).toBe("preserved");
  });
});

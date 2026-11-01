import { describe, expect, it } from "vitest";

import {
  semanticPhenomena,
  type SemanticAssessment,
  type SemanticRubric,
} from "./semantic-frame-runtime";

describe("semanticPhenomena", () => {
  it("adapts V3 components to inline-compatible phenomena", () => {
    const rubric: SemanticRubric = {
      version: "semantic-frames-v3.1",
      language: "es",
      narrativeUnits: [
        {
          facts: [
            {
              id: "f1",
              statement: "Una mujer llegó al pueblo al amanecer.",
              storyExcerpt: "Al amanecer, una mujer llegó a un pueblo.",
              frame: {
                predicate: {
                  label: "llegar",
                  sourceExcerpt: "una mujer llegó a un pueblo",
                },
                slots: [
                  {
                    slotId: "s1",
                    role: "temporalidad",
                    expected: "amanecer",
                    sourceExcerpt: "Al amanecer",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const assessment: SemanticAssessment = {
      entityMappings: [],
      intrusions: [
        {
          evidence: "con un caballo",
          explanation: "Se agrega un caballo.",
          confidence: 0.9,
        },
      ],
      factAssessments: [
        {
          factId: "f1",
          predicate: {
            status: "preserved",
            evidence: "Una mujer llegó al pueblo",
            observedValue: "llegar",
            confidence: 0.95,
          },
          slots: [
            {
              slotId: "s1",
              status: "omitted",
              evidence: null,
              observedValue: null,
              confidence: 0.9,
            },
          ],
        },
      ],
    };

    expect(semanticPhenomena(rubric, assessment)).toEqual([
      expect.objectContaining({
        kind: "retained",
        recallExcerpt: "Una mujer llegó al pueblo",
      }),
      expect.objectContaining({
        kind: "omission",
        storyExcerpt: "Al amanecer",
      }),
      expect.objectContaining({
        kind: "intrusion",
        recallExcerpt: "con un caballo",
      }),
    ]);
  });
});

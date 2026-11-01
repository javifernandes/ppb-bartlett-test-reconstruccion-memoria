import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const loadRubric = async (language) => {
  const report = JSON.parse(
    await readFile(
      resolve(
        `evals/story-preparation-v3/results/river-basket.${language}.semantic-frames-v3.1.json`,
      ),
      "utf8",
    ),
  );
  return report.rubric;
};

const flatten = (rubric) =>
  rubric.narrativeUnits.flatMap((unit) =>
    unit.facts.map((fact) => ({ ...fact, unitText: unit.text })),
  );

describe("river basket bilingual semantic rubric", () => {
  it("keeps the Spanish and English fact structures aligned", async () => {
    const spanish = flatten(await loadRubric("es"));
    const english = flatten(await loadRubric("en"));

    expect(spanish).toHaveLength(36);
    expect(english).toHaveLength(36);
    expect(
      english.map(({ localId, importance, kind, dependencies }) => ({
        localId,
        importance,
        kind,
        dependencies,
      })),
    ).toEqual(
      spanish.map(({ localId, importance, kind, dependencies }) => ({
        localId,
        importance,
        kind,
        dependencies,
      })),
    );
  });

  it.each(["es", "en"])(
    "keeps every %s frame traceable to literal story excerpts",
    async (language) => {
      const rubric = await loadRubric(language);
      const story = rubric.narrativeUnits.map((unit) => unit.text).join(" ");
      for (const fact of flatten(rubric)) {
        expect(fact.unitText).toContain(fact.storyExcerpt);
        expect(story).toContain(fact.frame.predicate.sourceExcerpt);
        expect(fact.frame.slots.length).toBeGreaterThan(0);
        for (const slot of fact.frame.slots) {
          expect(story).toContain(slot.sourceExcerpt);
          expect(slot.required).toBe(true);
        }
      }
    },
  );
});

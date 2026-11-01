import { describe, expect, it } from "vitest";
import {
  isTrivialEntityMapping,
  paretoFrontier,
  spearman,
  timeAxis,
  topOverlap,
} from "./semantic-dashboard-metrics";

describe("semantic dashboard metrics", () => {
  it("keeps only improving time-quality observations", () => {
    expect(
      paretoFrontier([
        { id: "a", x: 20, y: 0.5 },
        { id: "b", x: 30, y: 0.4 },
        { id: "c", x: 30, y: 0.7 },
        { id: "d", x: 40, y: 0.7 },
        { id: "e", x: 50, y: 0.8 },
      ]).map((point) => point.id),
    ).toEqual(["a", "c", "e"]);
  });

  it("computes rank concordance with ties", () => {
    expect(
      spearman([
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 30 },
      ]),
    ).toBe(1);
  });

  it("filters identities, pronouns and canonical translations", () => {
    expect(isTrivialEntityMapping("mujer", "una mujer", "es")).toBe(true);
    expect(isTrivialEntityMapping("mujer", "ella", "es")).toBe(true);
    expect(isTrivialEntityMapping("mujer", "woman", "en")).toBe(true);
    expect(isTrivialEntityMapping("mujer", "lady", "en")).toBe(false);
    expect(isTrivialEntityMapping("anciano", "abuelo", "es")).toBe(false);
  });

  it("compares language rankings by language-neutral fact id", () => {
    expect(
      topOverlap(
        [
          { id: "es-f1", localId: "f1" },
          { id: "es-f2", localId: "f2" },
        ],
        [
          { id: "en-f2", localId: "f2" },
          { id: "en-f3", localId: "f3" },
        ],
      ),
    ).toMatchObject({ count: 1, jaccard: 1 / 3 });
  });

  it("builds readable time ticks that cover the observed range", () => {
    expect(timeAxis(270)).toEqual({
      maximum: 300,
      step: 50,
      ticks: [0, 50, 100, 150, 200, 250, 300],
    });
    expect(timeAxis(83)).toEqual({
      maximum: 100,
      step: 20,
      ticks: [0, 20, 40, 60, 80, 100],
    });
  });
});

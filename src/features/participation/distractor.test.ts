import { describe, expect, it } from "vitest";

import {
  createDistractorValues,
  expectedDistractorOrder,
  isDistractorOrderCorrect,
} from "./distractor";

describe("participant distractor", () => {
  it("creates a stable set of eight distinct two-digit values", () => {
    const first = createDistractorValues("participant-session");
    const second = createDistractorValues("participant-session");

    expect(first).toEqual(second);
    expect(first).toHaveLength(8);
    expect(new Set(first).size).toBe(8);
    expect(first.every((value) => value >= 10 && value <= 99)).toBe(true);
  });

  it("derives the descending answer without mutating the displayed values", () => {
    const displayed = [24, 91, 50, 23];

    expect(expectedDistractorOrder(displayed)).toEqual([91, 50, 24, 23]);
    expect(displayed).toEqual([24, 91, 50, 23]);
  });

  it("accepts only the complete expected order", () => {
    const expected = [91, 50, 24, 23];

    expect(isDistractorOrderCorrect([91, 50, 24, 23], expected)).toBe(true);
    expect(isDistractorOrderCorrect([91, 50, 23, 24], expected)).toBe(false);
    expect(isDistractorOrderCorrect([91, 50], expected)).toBe(false);
  });
});

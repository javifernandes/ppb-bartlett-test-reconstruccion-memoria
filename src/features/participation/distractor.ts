export const createDistractorValues = (seed: string) => {
  let state = [...seed].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const values = new Set<number>();

  while (values.size < 8) {
    state = (state * 1664525 + 1013904223) >>> 0;
    values.add(10 + (state % 90));
  }

  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  return shuffled;
};

export const expectedDistractorOrder = (values: readonly number[]) =>
  [...values].sort((left, right) => right - left);

export const isDistractorOrderCorrect = (
  selectedValues: readonly number[],
  expectedValues: readonly number[],
) =>
  selectedValues.length === expectedValues.length &&
  selectedValues.every((value, index) => value === expectedValues[index]);

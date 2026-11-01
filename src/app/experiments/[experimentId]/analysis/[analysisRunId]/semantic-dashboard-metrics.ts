export type Point = { id: string; x: number; y: number };

export const paretoFrontier = (points: Point[]) => {
  const bestAtTime = new Map<number, Point>();
  for (const point of points) {
    const current = bestAtTime.get(point.x);
    if (!current || point.y > current.y) bestAtTime.set(point.x, point);
  }

  let bestQuality = -Infinity;
  return [...bestAtTime.values()]
    .sort((left, right) => left.x - right.x)
    .filter((point) => {
      if (point.y <= bestQuality) return false;
      bestQuality = point.y;
      return true;
    });
};

const ranks = (values: number[]) => {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const result = Array<number>(values.length);
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) {
      end += 1;
    }
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      result[sorted[index].index] = rank;
    }
    start = end;
  }
  return result;
};

export const pearson = (pairs: Array<{ x: number; y: number }>) => {
  if (pairs.length < 3) return null;
  const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;
  const numerator = pairs.reduce(
    (sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY),
    0,
  );
  const denominator = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair.x - meanX) ** 2, 0) *
      pairs.reduce((sum, pair) => sum + (pair.y - meanY) ** 2, 0),
  );
  return denominator === 0 ? null : numerator / denominator;
};

export const spearman = (pairs: Array<{ x: number; y: number }>) => {
  if (pairs.length < 3) return null;
  const xRanks = ranks(pairs.map((pair) => pair.x));
  const yRanks = ranks(pairs.map((pair) => pair.y));
  return pearson(
    pairs.map((_, index) => ({ x: xRanks[index], y: yRanks[index] })),
  );
};

const articles = new Set([
  "a",
  "an",
  "the",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
]);

export const normalizeTerm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !articles.has(token))
    .join(" ");

const englishCanonicalForms: Record<string, Set<string>> = {
  mujer: new Set(["woman", "she"]),
  piedras: new Set(["rocks", "stones"]),
  gente: new Set(["people"]),
  rio: new Set(["river"]),
  pueblo: new Set(["town", "village"]),
  montana: new Set(["mountain", "mountains"]),
  pez: new Set(["fish"]),
  canasta: new Set(["basket"]),
  anciano: new Set(["old man"]),
  hojas: new Set(["leaves"]),
  puente: new Set(["bridge"]),
  casa: new Set(["house"]),
  plumas: new Set(["feathers"]),
};

export const isTrivialEntityMapping = (
  canonical: string,
  observed: string,
  language: "es" | "en",
) => {
  const normalizedCanonical = normalizeTerm(canonical);
  const normalizedObserved = normalizeTerm(observed);
  if (!normalizedCanonical || !normalizedObserved) return true;
  if (normalizedCanonical === normalizedObserved) return true;
  if (language === "es" && normalizedObserved === "ella") return true;
  return (
    language === "en" &&
    englishCanonicalForms[normalizedCanonical]?.has(normalizedObserved) === true
  );
};

export const topOverlap = <T extends { localId?: string; id: string }>(
  left: T[],
  right: T[],
) => {
  const leftIds = new Set(left.map((item) => item.localId ?? item.id));
  const shared = right.filter((item) => leftIds.has(item.localId ?? item.id));
  const union = new Set([
    ...leftIds,
    ...right.map((item) => item.localId ?? item.id),
  ]);
  return {
    shared,
    count: shared.length,
    jaccard: union.size === 0 ? null : shared.length / union.size,
  };
};

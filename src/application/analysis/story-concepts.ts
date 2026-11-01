const ignoredWords = new Set([
  "al",
  "and",
  "ante",
  "antes",
  "con",
  "cuando",
  "de",
  "del",
  "después",
  "donde",
  "el",
  "en",
  "entonces",
  "esa",
  "ese",
  "esta",
  "este",
  "from",
  "hacia",
  "hasta",
  "into",
  "junto",
  "la",
  "las",
  "luego",
  "los",
  "más",
  "pero",
  "por",
  "porque",
  "que",
  "se",
  "sin",
  "sobre",
  "the",
  "una",
  "uno",
  "with",
  "y",
]);

const words = (text: string) =>
  Array.from(text.matchAll(/[\p{L}\p{N}]+/gu), (match) => match[0]);

export const inferConceptAnchors = (text: string): string[] => {
  const candidates = words(text).filter(
    (word) =>
      word.length >= 4 && !ignoredWords.has(word.toLocaleLowerCase("es")),
  );
  const unique = [
    ...new Set(candidates.map((word) => word.toLocaleLowerCase("es"))),
  ];

  return unique.slice(0, 8).map((normalized) => {
    const original = candidates.find(
      (word) => word.toLocaleLowerCase("es") === normalized,
    );
    return original ?? normalized;
  });
};

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const argumentValue = (name) =>
  process.argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);

const englishPath = argumentValue("english");
const referencePath = argumentValue("reference");
if (!englishPath || !referencePath) {
  throw new Error(
    "Uso: node align-english-rubric.mjs --english=<v2-en.json> --reference=<v3-es.json>",
  );
}

const report = JSON.parse(await readFile(resolve(englishPath), "utf8"));
const referenceReport = JSON.parse(
  await readFile(resolve(referencePath), "utf8"),
);
if (
  report.rubric?.language !== "en" ||
  referenceReport.rubric?.language !== "es"
) {
  throw new Error("Se esperaba una rúbrica inglesa y una referencia española.");
}

const factsByUnit = [
  [
    ["A woman arrived at a village.", "a woman arrived at a village"],
    ["The woman's arrival occurred at dawn.", "At dawn, a woman arrived"],
    ["The village was by the river.", "a village by the river"],
    ["The woman was carrying a basket.", "carrying a basket"],
    [
      "The basket was covered with leaves.",
      "a basket covered with blue leaves",
    ],
    ["The leaves covering the basket were blue.", "blue leaves"],
  ],
  [
    [
      "The woman said she had come from the mountains.",
      "She said she had come from the mountains",
    ],
    ["The woman was looking for a house.", "was looking for the house"],
    [
      "The stones sang in that house during the rain.",
      "the house where the stones sang during the rain",
    ],
  ],
  [
    ["An old man warned the woman.", "An old man warned her"],
    [
      "The old man told her not to cross the bridge.",
      "not to cross the bridge",
    ],
    [
      "The old man told her to wait until canoes had passed.",
      "until three canoes had passed",
    ],
    ["The indicated number of canoes was three.", "three canoes"],
    [
      "The old man justified the warning by saying the river was still dreaming.",
      "because the river was still dreaming",
    ],
  ],
  [
    ["The woman waited.", "The woman waited"],
    ["The woman saw canoes pass.", "she saw only two"],
    ["The number of canoes she saw was two.", "only two"],
  ],
  [
    [
      "The woman left the basket on the riverbank.",
      "she left the basket on the riverbank",
    ],
    ["The woman crossed the bridge.", "crossed"],
  ],
  [
    ["The woman reached the other side.", "she reached the other side"],
    [
      "The woman heard a whistle inside the basket.",
      "she heard a whistle coming from inside the basket",
    ],
  ],
  [
    ["The woman opened the basket.", "she opened it"],
    [
      "The woman found a fish inside the basket.",
      "she found a small fish with white feathers",
    ],
    ["The fish was small.", "a small fish"],
    ["The fish had feathers.", "fish with white feathers"],
    ["The fish's feathers were white.", "white feathers"],
  ],
  [
    ["The fish spoke the old man's name.", "The fish spoke the old man's name"],
    ["After speaking the name, the fish became still.", "then became still"],
  ],
  [
    ["It began to rain.", "began to rain"],
    ["The rain began at night.", "That night"],
  ],
  [
    [
      "The stones were heard singing from the village.",
      "From the village, the people could hear the stones singing",
    ],
    ["The woman did not return.", "the woman did not return"],
  ],
  [
    [
      "They found the basket.",
      "they found the empty basket beneath the bridge",
    ],
    ["The basket was found the next morning.", "The next morning"],
    ["The basket was empty.", "the empty basket"],
    ["The basket was found beneath the bridge.", "beneath the bridge"],
  ],
];

const referenceFacts = new Map(
  referenceReport.rubric.narrativeUnits
    .flatMap((unit) => unit.facts)
    .map((fact) => [fact.localId, fact]),
);
let factIndex = 0;
const narrativeUnits = report.rubric.narrativeUnits.map((unit, unitIndex) => ({
  ...unit,
  facts: factsByUnit[unitIndex].map(([statement, storyExcerpt]) => {
    factIndex += 1;
    const localId = `f${String(factIndex).padStart(2, "0")}`;
    const reference = referenceFacts.get(localId);
    if (!reference) throw new Error(`Falta la referencia ${localId}.`);
    if (!unit.text.includes(storyExcerpt)) {
      throw new Error(`${localId} no tiene evidencia literal: ${storyExcerpt}`);
    }
    return {
      id: `en-${localId}`,
      localId,
      unitId: unit.id,
      statement,
      storyExcerpt,
      importance: reference.importance,
      kind: reference.kind,
      dependencies: reference.dependencies,
    };
  }),
}));

const aligned = {
  ...report,
  generatedAt: new Date().toISOString(),
  alignment: {
    version: "cross-language-fact-alignment-1",
    reference: resolve(referencePath),
    note: "La versión inglesa usa los mismos 36 hechos, importancia y dependencias que la española.",
  },
  rubric: {
    ...report.rubric,
    version: "atomic-facts-v2-cross-language-aligned-1",
    narrativeUnits,
  },
};
const resultsDirectory = resolve(here, "../story-preparation-v2/results");
await mkdir(resultsDirectory, { recursive: true });
const outputPath = resolve(
  resultsDirectory,
  `rubric-en-aligned-${new Date().toISOString().replaceAll(":", "-")}.json`,
);
await writeFile(outputPath, `${JSON.stringify(aligned, null, 2)}\n`);
console.log(`Rúbrica inglesa alineada (${factIndex} hechos): ${outputPath}`);

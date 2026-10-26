import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cases, story, storyUnits } from "./dataset.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");

const loadLocalEnvironment = async () => {
  try {
    const contents = await readFile(resolve(projectRoot, ".env.local"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
};

const RUBRIC_VERSION = "fixed-units-orthogonal-transformations-v2";

const SYSTEM_PROMPT = `Sos codificador de respuestas para una investigación sobre memoria reconstructiva. La historia ya fue segmentada por investigadores en unidades fijas. No agregues, elimines, unas ni subdividas unidades.

Para cada unidad decidí solamente si fue recordada:
- recalled true: la reconstrucción conserva el evento, estado o relación central de la unidad, aunque omita detalles o sustituya elementos.
- recalled false: no hay evidencia del núcleo de la unidad, o la reconstrucción afirma explícitamente lo contrario.

La decisión de recuerdo y las transformaciones son dimensiones independientes. Una unidad puede estar recordada y además contener una sustitución, generalización o racionalización. No marques una unidad como no recordada solamente porque fue transformada.

Después registrá transformaciones sólo cuando haya evidencia:
- substitution: se reemplaza una entidad, propiedad, acción, cantidad, polaridad o relación por otra.
- generalization: un elemento específico se recuerda mediante una categoría más amplia, sin contradecirlo.
- contradiction: se niega o invierte explícitamente un evento, estado o relación original.
- rationalization: se introduce una explicación causal, motivación o interpretación más familiar que no estaba en el original.
- accentuation: un detalle recibe énfasis desproporcionado respecto del original.

Finalmente identificá intrusiones: proposiciones de la reconstrucción sin respaldo en ninguna unidad original. No cuentes como intrusión una paráfrasis, una generalización razonable ni el mismo fragmento ya explicado como sustitución o racionalización.

Reglas críticas:
- La coincidencia de palabras no basta: atendé a quién hizo qué, cantidades y negaciones.
- Cada unitId debe aparecer exactamente una vez en unitAssessments.
- recallExcerpt debe ser una cita literal de la reconstrucción o null.
- Las explicaciones deben ser breves y en castellano.
- Ante ambigüedad bajá confidence; no inventes una categoría intermedia.
- Respondé exclusivamente un objeto JSON.

Forma esperada:
{"unitAssessments":[{"unitId":"U01","recalled":true,"recallExcerpt":"cita literal o null","confidence":0.0,"explanation":"breve"}],"transformations":[{"kind":"substitution","unitId":"U01","storyExcerpt":"cita literal","recallExcerpt":"cita literal","confidence":0.0,"explanation":"breve"}],"intrusions":[{"recallExcerpt":"cita literal","confidence":0.0,"explanation":"breve"}]}`;

const parseArguments = () => {
  const requestedCase = process.argv.find((argument) =>
    argument.startsWith("--case="),
  );
  return {
    caseId: requestedCase?.slice("--case=".length),
  };
};

const validateOutput = (output, recall) => {
  if (!output || typeof output !== "object") {
    throw new Error("El modelo no devolvió un objeto.");
  }
  if (!Array.isArray(output.unitAssessments)) {
    throw new Error("Falta unitAssessments.");
  }
  const expectedIds = new Set(storyUnits.map((unit) => unit.id));
  const receivedIds = output.unitAssessments.map((item) => item.unitId);
  if (
    receivedIds.length !== expectedIds.size ||
    new Set(receivedIds).size !== expectedIds.size ||
    receivedIds.some((id) => !expectedIds.has(id))
  ) {
    throw new Error(
      "unitAssessments no contiene exactamente las unidades fijas.",
    );
  }
  for (const assessment of output.unitAssessments) {
    if (typeof assessment.recalled !== "boolean") {
      throw new Error(`Decisión inválida para ${assessment.unitId}.`);
    }
    if (
      assessment.recallExcerpt !== null &&
      !recall.includes(assessment.recallExcerpt)
    ) {
      throw new Error(`Evidencia no literal para ${assessment.unitId}.`);
    }
  }
  for (const collection of [output.transformations, output.intrusions]) {
    if (!Array.isArray(collection)) throw new Error("Salida incompleta.");
    for (const item of collection) {
      if (item.recallExcerpt !== null && !recall.includes(item.recallExcerpt)) {
        throw new Error(
          "Una transformación o intrusión tiene evidencia no literal.",
        );
      }
    }
  }
  return output;
};

const analyze = async (testCase) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Falta DEEPSEEK_API_KEY en .env.local.");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            story,
            fixedUnits: storyUnits,
            recall: testCase.recall,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`DeepSeek respondió HTTP ${response.status}.`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek devolvió una respuesta vacía.");
  const parsedOutput = JSON.parse(content);
  let output;
  try {
    output = validateOutput(parsedOutput, testCase.recall);
  } catch (error) {
    error.modelOutput = parsedOutput;
    throw error;
  }
  return {
    output,
    usage: payload.usage ?? null,
    model,
  };
};

const transformationKey = ({ kind, unitId }) => `${kind}:${unitId ?? "none"}`;

const score = (testCase, output) => {
  const expectedTransformations = new Set(
    testCase.expected.transformations.map(transformationKey),
  );
  const contradictedUnits = new Set(
    testCase.expected.transformations
      .filter((transformation) => transformation.kind === "contradiction")
      .map((transformation) => transformation.unitId),
  );
  const actualRecall = Object.fromEntries(
    output.unitAssessments.map((item) => [item.unitId, item.recalled]),
  );
  const unitResults = Object.entries(testCase.expected.statuses).map(
    ([unitId, expectedStatus]) => {
      const expected =
        expectedStatus !== "omitted" && !contradictedUnits.has(unitId);
      return {
        unitId,
        expected,
        expectedStatus,
        actual: actualRecall[unitId],
        matches: expected === actualRecall[unitId],
      };
    },
  );
  const actualTransformations = new Set(
    output.transformations.map(transformationKey),
  );
  const transformationTruePositives = [...actualTransformations].filter((key) =>
    expectedTransformations.has(key),
  ).length;
  return {
    unitRecallAccuracy:
      unitResults.filter((result) => result.matches).length /
      unitResults.length,
    unitErrors: unitResults.filter((result) => !result.matches),
    transformationPrecision:
      actualTransformations.size === 0
        ? expectedTransformations.size === 0
          ? 1
          : 0
        : transformationTruePositives / actualTransformations.size,
    transformationRecall:
      expectedTransformations.size === 0
        ? actualTransformations.size === 0
          ? 1
          : 0
        : transformationTruePositives / expectedTransformations.size,
    expectedTransformations: [...expectedTransformations],
    actualTransformations: [...actualTransformations],
    expectedIntrusionCount: testCase.expected.intrusionCount,
    actualIntrusionCount: output.intrusions.length,
    intrusionCountMatches:
      testCase.expected.intrusionCount === output.intrusions.length,
  };
};

await loadLocalEnvironment();
const { caseId } = parseArguments();
const selectedCases = caseId
  ? cases.filter((testCase) => testCase.id === caseId)
  : cases;
if (selectedCases.length === 0) throw new Error(`Caso desconocido: ${caseId}`);

const results = [];
for (const testCase of selectedCases) {
  process.stdout.write(`Analizando ${testCase.id}... `);
  try {
    const analysis = await analyze(testCase);
    const evaluation = score(testCase, analysis.output);
    results.push({
      id: testCase.id,
      description: testCase.description,
      ...analysis,
      evaluation,
    });
    console.log(
      `${Math.round(evaluation.unitRecallAccuracy * 100)} % recuerdo`,
    );
  } catch (error) {
    results.push({
      id: testCase.id,
      description: testCase.description,
      error: error instanceof Error ? error.message : String(error),
      modelOutput: error?.modelOutput ?? null,
    });
    console.log("ERROR");
  }
}

const successful = results.filter((result) => result.evaluation);
const summary = {
  generatedAt: new Date().toISOString(),
  rubricVersion: RUBRIC_VERSION,
  cases: results.length,
  successfulCases: successful.length,
  meanUnitRecallAccuracy:
    successful.length === 0
      ? null
      : successful.reduce(
          (total, result) => total + result.evaluation.unitRecallAccuracy,
          0,
        ) / successful.length,
  intrusionCountAccuracy:
    successful.length === 0
      ? null
      : successful.filter((result) => result.evaluation.intrusionCountMatches)
          .length / successful.length,
};

const report = { summary, story, storyUnits, results };
const resultsDirectory = resolve(here, "results");
await mkdir(resultsDirectory, { recursive: true });
const outputPath = resolve(
  resultsDirectory,
  `${new Date().toISOString().replaceAll(":", "-")}.json`,
);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `\nExactitud media por unidad: ${
    summary.meanUnitRecallAccuracy === null
      ? "—"
      : `${Math.round(summary.meanUnitRecallAccuracy * 100)} %`
  }`,
);
console.log(`Reporte: ${outputPath}`);

if (results.some((result) => result.error)) process.exitCode = 1;

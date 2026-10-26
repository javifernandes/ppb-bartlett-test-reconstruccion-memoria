import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { transformationCases } from "./transformation-dataset.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");

const loadLocalEnvironment = async () => {
  try {
    const contents = await readFile(resolve(projectRoot, ".env.local"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
};

const SYSTEM_PROMPT = `Clasificá pares mínimos de una historia original y su reconstrucción. Tomá dos decisiones independientes para cada par.

meaningPreserved:
- true si sobrevive el evento, estado o relación nuclear, incluso cuando cambie un participante, objeto, cantidad o explicación.
- false si el núcleo está ausente, negado o invertido.

kind debe ser exactamente una categoría:
- equivalent: paráfrasis, sinónimo contextual o cambio gramatical que conserva la información relevante.
- generalization: reemplazo por una categoría genuinamente más amplia y menos específica.
- substitution: reemplazo por otra entidad, acción, cantidad o interpretación concreta. Incluye la convencionalización cultural, como canoa por bote.
- contradiction: negación o inversión explícita del evento, relación o polaridad original.
- rationalization: agregado o reemplazo que introduce una causa, motivación o explicación familiar ausente en el original.

Reglas:
- No confundas una paráfrasis con una sustitución.
- No llames generalización a un término coordinado: flechas por rifles es sustitución; flechas por armas es generalización.
- Si hay explicación causal nueva, preferí rationalization sobre substitution.
- Respondé únicamente JSON y devolvé exactamente un resultado por id.

Ejemplos de la independencia entre las dos decisiones:
- "Una canoa se acercó" → "Un automóvil se acercó": meaningPreserved true, substitution. Sobrevive el evento de acercamiento aunque cambie una entidad.
- "Había cinco hombres" → "Había diez hombres": meaningPreserved true, substitution. Sobrevive la presencia de hombres aunque cambie la cantidad.
- "No tenía flechas" → "No tenía rifles": meaningPreserved true, substitution. Sobrevive la carencia de un arma aunque cambie cuál.
- "Una canoa se acercó" → "La canoa no se acercó": meaningPreserved false, contradiction. La relación nuclear se niega.
- "No tenía flechas" → "Tenía flechas": meaningPreserved false, contradiction. La polaridad se invierte.
- "La herida no era de flecha" → "Recibió una bala": meaningPreserved true, rationalization. Sobrevive la herida y se agrega una causa concreta familiar.

Forma:
{"results":[{"id":"case-id","meaningPreserved":true,"kind":"equivalent","confidence":0.0,"explanation":"breve en castellano"}]}`;

await loadLocalEnvironment();
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
          cases: transformationCases.map(({ id, original, recalled }) => ({
            id,
            original,
            recalled,
          })),
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
const output = JSON.parse(content);
if (!Array.isArray(output.results)) throw new Error("Salida inválida.");

const allowedKinds = new Set([
  "equivalent",
  "generalization",
  "substitution",
  "contradiction",
  "rationalization",
]);
const actualById = new Map(output.results.map((result) => [result.id, result]));
const results = transformationCases.map((testCase) => {
  const actual = actualById.get(testCase.id);
  const valid =
    actual &&
    typeof actual.meaningPreserved === "boolean" &&
    allowedKinds.has(actual.kind);
  return {
    id: testCase.id,
    calibrationExample: testCase.calibrationExample ?? false,
    original: testCase.original,
    recalled: testCase.recalled,
    expected: testCase.expected,
    actual: valid ? actual : null,
    meaningMatches:
      valid && actual.meaningPreserved === testCase.expected.meaningPreserved,
    kindMatches: valid && actual.kind === testCase.expected.kind,
  };
});

const meaningAccuracy =
  results.filter((result) => result.meaningMatches).length / results.length;
const kindAccuracy =
  results.filter((result) => result.kindMatches).length / results.length;
const holdoutResults = results.filter((result) => !result.calibrationExample);
const holdoutMeaningAccuracy =
  holdoutResults.filter((result) => result.meaningMatches).length /
  holdoutResults.length;
const holdoutKindAccuracy =
  holdoutResults.filter((result) => result.kindMatches).length /
  holdoutResults.length;

console.log(`Modelo: ${model}`);
console.log(
  `Conservación de significado: ${Math.round(meaningAccuracy * 100)} %`,
);
console.log(
  `Clasificación de transformación: ${Math.round(kindAccuracy * 100)} %`,
);
console.log(
  `Holdout (${holdoutResults.length} pares): significado ${Math.round(
    holdoutMeaningAccuracy * 100,
  )} %, transformación ${Math.round(holdoutKindAccuracy * 100)} %`,
);
console.log("\nDesacuerdos:");
for (const result of results.filter(
  (item) => !item.meaningMatches || !item.kindMatches,
)) {
  console.log(
    `- ${result.id}: esperado ${JSON.stringify(result.expected)}, recibido ${JSON.stringify(
      result.actual
        ? {
            meaningPreserved: result.actual.meaningPreserved,
            kind: result.actual.kind,
          }
        : null,
    )}`,
  );
}

console.log("\nJSON:");
console.log(
  JSON.stringify(
    {
      model,
      usage: payload.usage ?? null,
      summary: {
        meaningAccuracy,
        kindAccuracy,
        holdoutCases: holdoutResults.length,
        holdoutMeaningAccuracy,
        holdoutKindAccuracy,
      },
      results,
    },
    null,
    2,
  ),
);

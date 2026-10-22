import type { RecallPhenomenon, RecallPhenomenonKind } from "./recall-analysis";

export type RecallAnalysisOutput = {
  retainedUnitsCount: number;
  omittedUnitsCount: number;
  intrusionCount: number;
  phenomena: RecallPhenomenon[];
};

export type RecallAnalysisModelResult = RecallAnalysisOutput & {
  provider: string;
  model: string;
  rubricVersion: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

const phenomenonKinds = new Set<RecallPhenomenonKind>([
  "retained",
  "omission",
  "intrusion",
  "substitution",
  "rationalization",
  "accentuation",
]);

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

const isExcerpt = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export const parseRecallAnalysisOutput = (
  value: unknown,
): RecallAnalysisOutput => {
  if (!value || typeof value !== "object") {
    throw new Error("El modelo no devolvió un objeto JSON.");
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isNonNegativeInteger(candidate.retainedUnitsCount) ||
    !isNonNegativeInteger(candidate.omittedUnitsCount) ||
    !isNonNegativeInteger(candidate.intrusionCount) ||
    !Array.isArray(candidate.phenomena)
  ) {
    throw new Error("La salida del modelo no respeta el schema esperado.");
  }

  const phenomena = candidate.phenomena.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("El modelo devolvió un fenómeno inválido.");
    }
    const phenomenon = item as Record<string, unknown>;
    if (
      typeof phenomenon.kind !== "string" ||
      !phenomenonKinds.has(phenomenon.kind as RecallPhenomenonKind) ||
      !isExcerpt(phenomenon.storyExcerpt) ||
      !isExcerpt(phenomenon.recallExcerpt) ||
      typeof phenomenon.explanation !== "string" ||
      phenomenon.explanation.trim().length === 0 ||
      typeof phenomenon.confidence !== "number" ||
      phenomenon.confidence < 0 ||
      phenomenon.confidence > 1
    ) {
      throw new Error("El modelo devolvió un fenómeno inválido.");
    }

    return {
      kind: phenomenon.kind as RecallPhenomenonKind,
      storyExcerpt: phenomenon.storyExcerpt,
      recallExcerpt: phenomenon.recallExcerpt,
      explanation: phenomenon.explanation.trim(),
      confidence: phenomenon.confidence,
    };
  });

  return {
    retainedUnitsCount: candidate.retainedUnitsCount,
    omittedUnitsCount: candidate.omittedUnitsCount,
    intrusionCount: candidate.intrusionCount,
    phenomena,
  };
};

const PROMPT_VERSION = "bartlett-v1";
const RUBRIC_VERSION = "bartlett-llm-v1";

const SYSTEM_PROMPT = `Sos asistente de investigación en psicología cognitiva. Compará una reconstrucción libre con la historia original usando la teoría de memoria reconstructiva de Bartlett.

Clasificá solamente fenómenos respaldados por evidencia textual:
- retained: una unidad narrativa relevante se conserva en la reconstrucción. Incluí evidencia literal de ambos textos.
- omission: una unidad narrativa relevante de la historia no aparece en la reconstrucción.
- intrusion: aparece información que no está respaldada por la historia.
- substitution: un elemento original fue reemplazado por otro concreto.
- rationalization: la reconstrucción agrega o modifica información para volverla más familiar, causal o coherente.
- accentuation: un detalle se vuelve desproporcionadamente central o enfático.

Dividí la historia en unidades narrativas con sentido, no necesariamente oraciones. retainedUnitsCount + omittedUnitsCount debe ser el total de esas unidades. intrusionCount debe coincidir con la cantidad de fenómenos intrusion.
Incluí un fenómeno retained por cada unidad contabilizada como retenida y un fenómeno omission por cada unidad contabilizada como omitida.

Respondé exclusivamente JSON con esta forma exacta:
{"retainedUnitsCount":0,"omittedUnitsCount":0,"intrusionCount":0,"phenomena":[{"kind":"omission","storyExcerpt":"cita exacta o null","recallExcerpt":"cita exacta o null","explanation":"explicación breve en castellano","confidence":0.0}]}

Las citas deben ser fragmentos literales del texto correspondiente. No inventes evidencia. Ante ambigüedad, bajá confidence u omití el fenómeno.`;

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export const analyzeRecallWithDeepSeek = async (
  story: string,
  recall: string,
): Promise<RecallAnalysisModelResult> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Falta configurar DEEPSEEK_API_KEY.");

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
          content: `HISTORIA ORIGINAL:\n${story}\n\nRECONSTRUCCIÓN:\n${recall}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek respondió HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as DeepSeekResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek devolvió una respuesta vacía.");

  const output = parseRecallAnalysisOutput(JSON.parse(content));
  for (const phenomenon of output.phenomena) {
    if (
      (phenomenon.storyExcerpt !== null &&
        !story.includes(phenomenon.storyExcerpt)) ||
      (phenomenon.recallExcerpt !== null &&
        !recall.includes(phenomenon.recallExcerpt))
    ) {
      throw new Error(
        "DeepSeek devolvió evidencia que no es una cita literal.",
      );
    }
  }

  return {
    ...output,
    provider: "deepseek",
    model,
    rubricVersion: RUBRIC_VERSION,
    promptVersion: PROMPT_VERSION,
    inputTokens: payload.usage?.prompt_tokens ?? null,
    outputTokens: payload.usage?.completion_tokens ?? null,
  };
};

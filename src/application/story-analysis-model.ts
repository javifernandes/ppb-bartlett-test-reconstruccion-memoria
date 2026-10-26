import { inferConceptAnchors } from "./story-concepts";

export type StoryAnalysisLanguage = "es" | "en";

export type StoryAnalysisUnit = {
  id: string;
  text: string;
  concepts?: string[];
};

export type StoryAnalysisRubric = {
  language: StoryAnalysisLanguage;
  version: string;
  units: StoryAnalysisUnit[];
};

const splitLocally = (story: string) =>
  story
    .split(/(?<=[.!?])\s+|\n+/)
    .map((text) => text.trim())
    .filter(Boolean);

export const prepareStoryLocally = (
  story: string,
  language: StoryAnalysisLanguage,
): StoryAnalysisRubric => ({
  language,
  version: "story-units-v1",
  units: splitLocally(story).map((text, index) => ({
    id: `${language}-u${String(index + 1).padStart(2, "0")}`,
    text,
    concepts: inferConceptAnchors(text),
  })),
});

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const parseUnits = (
  value: unknown,
  story: string,
  language: StoryAnalysisLanguage,
): StoryAnalysisRubric => {
  if (!value || typeof value !== "object") {
    throw new Error("El modelo no devolvió un objeto JSON.");
  }
  const candidate = value as { units?: unknown };
  if (!Array.isArray(candidate.units) || candidate.units.length === 0) {
    throw new Error("El modelo no devolvió unidades narrativas.");
  }

  const units = candidate.units.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("El modelo devolvió una unidad inválida.");
    }
    const { text, concepts: rawConcepts } = item as {
      text?: unknown;
      concepts?: unknown;
    };
    if (typeof text !== "string" || !text.trim() || !story.includes(text)) {
      throw new Error("Las unidades deben ser citas literales de la historia.");
    }
    const concepts = Array.isArray(rawConcepts)
      ? [
          ...new Set(
            rawConcepts.filter(
              (concept): concept is string =>
                typeof concept === "string" &&
                Boolean(concept.trim()) &&
                text.includes(concept),
            ),
          ),
        ].slice(0, 8)
      : inferConceptAnchors(text);
    return {
      id: `${language}-u${String(index + 1).padStart(2, "0")}`,
      text,
      concepts,
    };
  });

  return { language, version: "story-units-v1", units };
};

export const prepareStoryWithDeepSeek = async (
  story: string,
  language: StoryAnalysisLanguage,
): Promise<StoryAnalysisRubric> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Falta configurar DEEPSEEK_API_KEY.");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
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
        {
          role: "system",
          content: `Dividí una historia en unidades narrativas breves y significativas para un experimento de memoria reconstructiva. Cada unidad debe ser una cita literal, continua y no vacía de la historia. Para cada unidad, extraé entre 2 y 8 anclas conceptuales: sustantivos, entidades, cantidades, acciones o frases breves centrales que también sean citas literales y continuas dentro de esa unidad. Conservá el orden, no reformules y no inventes texto. Respondé exclusivamente JSON: {"units":[{"text":"cita literal","concepts":["ancla literal"]}]}`,
        },
        { role: "user", content: story },
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
  return parseUnits(JSON.parse(content), story, language);
};

export const prepareStory = (story: string, language: StoryAnalysisLanguage) =>
  process.env.RECALL_ANALYSIS_PROVIDER === "deepseek"
    ? prepareStoryWithDeepSeek(story, language)
    : Promise.resolve(prepareStoryLocally(story, language));

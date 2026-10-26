import fs from "node:fs";
import process from "node:process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const projectRef = process.argv[process.argv.indexOf("--project-ref") + 1];
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(
      (line) => line && !line.trim().startsWith("#") && line.includes("="),
    )
    .map((line) => {
      const separator = line.indexOf("=");
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, separator).trim(), value];
    }),
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
const deepSeekKey = env.DEEPSEEK_API_KEY;
const model = env.DEEPSEEK_MODEL || "deepseek-flash";
const urlProjectRef = new URL(supabaseUrl).hostname.split(".")[0];

if (!supabaseUrl || !secretKey)
  throw new Error("Faltan credenciales Supabase.");
if (apply && !deepSeekKey) throw new Error("Falta DEEPSEEK_API_KEY.");
if (apply && projectRef !== urlProjectRef) {
  throw new Error(
    `Para escribir, indicá --project-ref ${urlProjectRef} explícitamente.`,
  );
}
if (apply && /localhost|127\.0\.0\.1/.test(supabaseUrl)) {
  throw new Error("Este backfill está reservado para el proyecto remoto.");
}

const client = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const query = async (table, columns) => {
  const { data, error } = await client.from(table).select(columns);
  if (error) throw error;
  return data;
};

const deepSeekJson = async (system, user) => {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deepSeekKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok)
    throw new Error(`DeepSeek respondió HTTP ${response.status}.`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek devolvió una respuesta vacía.");
  return { value: JSON.parse(content), usage: payload.usage ?? {} };
};

const prepareRubric = async (story, language) => {
  const { value } = await deepSeekJson(
    'Dividí una historia en unidades narrativas breves y significativas para un experimento de memoria reconstructiva. Cada unidad debe ser una cita literal, continua y no vacía de la historia. Para cada unidad, extraé entre 2 y 8 anclas conceptuales: sustantivos, entidades, cantidades, acciones o frases breves centrales que también sean citas literales y continuas dentro de esa unidad. Conservá el orden, no reformules y no inventes texto. Respondé exclusivamente JSON: {"units":[{"text":"cita literal","concepts":["ancla literal"]}]}',
    story,
  );
  if (!Array.isArray(value.units) || value.units.length === 0) {
    throw new Error("DeepSeek no devolvió unidades narrativas.");
  }
  const units = value.units.map((unit, index) => {
    if (typeof unit?.text !== "string" || !story.includes(unit.text)) {
      throw new Error("Una unidad no es una cita literal de la historia.");
    }
    const concepts = Array.isArray(unit.concepts)
      ? [...new Set(unit.concepts)].filter(
          (concept) =>
            typeof concept === "string" && unit.text.includes(concept),
        )
      : [];
    return {
      id: `${language}-u${String(index + 1).padStart(2, "0")}`,
      text: unit.text,
      concepts: concepts.slice(0, 8),
    };
  });
  return { language, version: "story-units-v1", units };
};

const phenomenonKinds = new Set([
  "retained",
  "omission",
  "intrusion",
  "substitution",
  "rationalization",
  "accentuation",
]);
const presences = new Set(["full", "trace", "absent"]);

const analyzeRecall = async (story, recall, units) => {
  const { value, usage } = await deepSeekJson(
    `Sos asistente de investigación en psicología cognitiva. Compará una reconstrucción libre con la historia original usando la teoría de memoria reconstructiva de Bartlett.

Clasificá solamente fenómenos respaldados por evidencia textual: retained, omission, intrusion, substitution, rationalization y accentuation.
Evaluá todas las unidades exactamente una vez en unitAssessments: full conserva la idea central y sus relaciones; trace conserva algún concepto pero no la idea completa; absent no tiene evidencia suficiente. retainedUnitsCount cuenta full; omittedUnitsCount cuenta trace + absent; intrusionCount coincide con los fenómenos intrusion.

Respondé exclusivamente JSON con esta forma: {"retainedUnitsCount":0,"omittedUnitsCount":0,"intrusionCount":0,"unitAssessments":[{"unitId":"es-u01","presence":"full","recallExcerpt":"cita exacta o null","confidence":0.0}],"phenomena":[{"kind":"omission","storyExcerpt":"cita exacta o null","recallExcerpt":"cita exacta o null","explanation":"explicación breve en castellano","confidence":0.0}]}. Las citas deben ser literales.`,
    `HISTORIA ORIGINAL:\n${story}\n\nUNIDADES PREPARADAS:\n${JSON.stringify(units)}\n\nRECONSTRUCCIÓN:\n${recall}`,
  );
  if (
    !Number.isInteger(value.retainedUnitsCount) ||
    !Number.isInteger(value.omittedUnitsCount) ||
    !Number.isInteger(value.intrusionCount) ||
    !Array.isArray(value.unitAssessments) ||
    !Array.isArray(value.phenomena)
  ) {
    throw new Error("La salida de análisis no respeta el schema esperado.");
  }
  const expectedIds = new Set(units.map((unit) => unit.id));
  if (
    value.unitAssessments.length !== units.length ||
    value.unitAssessments.some(
      (assessment) =>
        !expectedIds.delete(assessment.unitId) ||
        !presences.has(assessment.presence),
    ) ||
    expectedIds.size > 0
  ) {
    throw new Error("DeepSeek no evaluó exactamente las unidades preparadas.");
  }
  for (const phenomenon of value.phenomena) {
    if (!phenomenonKinds.has(phenomenon.kind)) {
      throw new Error("DeepSeek devolvió un fenómeno inválido.");
    }
    if (
      phenomenon.storyExcerpt != null &&
      !story.includes(phenomenon.storyExcerpt)
    ) {
      phenomenon.storyExcerpt = null;
    }
    if (
      phenomenon.recallExcerpt != null &&
      !recall.includes(phenomenon.recallExcerpt)
    ) {
      phenomenon.recallExcerpt = null;
    }
  }
  return { ...value, usage };
};

const experiments = await query(
  "experiments",
  "id,title,status,story,primary_language,alternate_language,alternate_story,analysis_run_id,analysis_rubrics,analysis_prepared_at",
);
const sessions = await query(
  "participant_sessions",
  "id,experiment_id,status,content_language,recall_text",
);
const runs = await query("analysis_runs", "id,experiment_id,status");
const analyses = await query(
  "recall_analyses",
  "id,experiment_id,session_id,run_id",
);

const targets = experiments.filter(
  (experiment) =>
    experiment.status === "published" || experiment.status === "closed",
);
console.log(`${apply ? "APPLY" : "DRY RUN"}: ${targets.length} experimentos`);

for (const experiment of targets) {
  const submitted = sessions.filter(
    (session) =>
      session.experiment_id === experiment.id && session.status === "submitted",
  );
  const existingRun = runs.find((run) => run.id === experiment.analysis_run_id);
  const analyzedIds = new Set(
    analyses
      .filter((analysis) => analysis.run_id === experiment.analysis_run_id)
      .map((analysis) => analysis.session_id),
  );
  console.log(
    `- ${experiment.title}: ${experiment.analysis_rubrics ? "rúbrica existente" : "preparar rúbrica"}, ${existingRun ? "corrida existente" : "crear corrida"}, ${submitted.filter((session) => !analyzedIds.has(session.id)).length} respuestas pendientes`,
  );
  if (!apply) continue;

  const rubrics = experiment.analysis_rubrics?.length
    ? experiment.analysis_rubrics
    : [
        await prepareRubric(experiment.story, experiment.primary_language),
        ...(experiment.alternate_language && experiment.alternate_story
          ? [
              await prepareRubric(
                experiment.alternate_story,
                experiment.alternate_language,
              ),
            ]
          : []),
      ];
  const runId = experiment.analysis_run_id || randomUUID();
  const preparedAt =
    experiment.analysis_prepared_at || new Date().toISOString();

  if (!existingRun) {
    const { error } = await client.from("analysis_runs").upsert({
      id: runId,
      experiment_id: experiment.id,
      status: experiment.status === "closed" ? "completed" : "running",
      analyzer_version: `deepseek:${model}`,
      created_at: preparedAt,
    });
    if (error) throw error;
  }
  const { error: experimentError } = await client
    .from("experiments")
    .update({
      analysis_run_id: runId,
      analysis_rubrics: rubrics,
      analysis_prepared_at: preparedAt,
    })
    .eq("id", experiment.id);
  if (experimentError) throw experimentError;

  const currentAnalyses = await query(
    "recall_analyses",
    "id,session_id,run_id",
  );
  for (const session of submitted) {
    if (
      currentAnalyses.some(
        (analysis) =>
          analysis.run_id === runId && analysis.session_id === session.id,
      )
    ) {
      continue;
    }
    const rubric = rubrics.find(
      (candidate) => candidate.language === session.content_language,
    );
    if (!rubric || !session.recall_text) continue;
    const sourceStory =
      session.content_language === experiment.alternate_language &&
      experiment.alternate_story
        ? experiment.alternate_story
        : experiment.story;
    const result = await analyzeRecall(
      sourceStory,
      session.recall_text,
      rubric.units,
    );
    const { error } = await client.from("recall_analyses").insert({
      id: randomUUID(),
      run_id: runId,
      session_id: session.id,
      experiment_id: experiment.id,
      status: "completed",
      rubric_version: "bartlett-llm-v1",
      analyzer_provider: "deepseek",
      analyzer_model: model,
      prompt_version: "bartlett-v1",
      input_tokens: result.usage.prompt_tokens ?? null,
      output_tokens: result.usage.completion_tokens ?? null,
      retained_units_count: result.retainedUnitsCount,
      omitted_units_count: result.omittedUnitsCount,
      intrusion_count: result.intrusionCount,
      phenomena: result.phenomena,
      unit_assessments: result.unitAssessments,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    console.log(`  ✓ respuesta ${session.id.slice(0, 8)} analizada`);
  }
}

console.log(
  apply ? "Backfill terminado." : "Sin cambios. Usá --apply para ejecutar.",
);

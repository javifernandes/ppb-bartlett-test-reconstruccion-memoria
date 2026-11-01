import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { analyzeSemanticFrames } from "../evals/analysis-comparison/batch-v3.mjs";
import { summarizeParticipantV3 } from "../evals/analysis-comparison/metrics-v3.mjs";

const argumentValue = (name) =>
  process.argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);

const apply = process.argv.includes("--apply");
const promoteLive = process.argv.includes("--promote-live");
const promoteReporting = process.argv.includes("--promote-reporting");
const help = process.argv.includes("--help") || process.argv.includes("-h");
const experimentId = argumentValue("experiment-id");
const requestedRunId = argumentValue("run-id");
const rubricPath = argumentValue("rubric");
const projectRef = argumentValue("project-ref");

if (help) {
  console.log(`Uso:
  pnpm backfill:semantic-analysis -- --experiment-id=<uuid> [opciones]

Por omisión hace una inspección read-only. No llama al LLM ni escribe en Supabase.

Opciones:
  --rubric=<archivo(s)>     Carga una o más rúbricas V3.1, separadas por coma.
  --run-id=<uuid>          Reanuda una corrida V3.1 existente.
  --apply                  Ejecuta el análisis y persiste una corrida nueva.
  --project-ref=<ref>      Confirmación obligatoria del proyecto al usar --apply.
  --promote-live           Envía los nuevos submits a V3 antes del backfill.
  --promote-reporting      Muestra V3 sólo si cubre todas las respuestas.
  --help, -h               Muestra esta ayuda.

La corrida V1 nunca se sobrescribe. Se recomienda ejecutar primero sin --apply,
luego promover live, completar el backfill y promover reporting.`);
  process.exit(0);
}

if (!experimentId) {
  throw new Error("Indicá --experiment-id=<uuid>.");
}
if ((promoteLive || promoteReporting) && !apply) {
  throw new Error("Las promociones requieren --apply.");
}

const loadEnvironment = async () => {
  const contents = await readFile(resolve(".env.local"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
};

const loadRubrics = async (experiment) => {
  if (rubricPath) {
    const reports = await Promise.all(
      rubricPath
        .split(",")
        .map((path) => path.trim())
        .filter(Boolean)
        .map(async (path) => JSON.parse(await readFile(resolve(path), "utf8"))),
    );
    const rubrics = reports.flatMap((report) =>
      Array.isArray(report)
        ? report
        : Array.isArray(report.rubrics)
          ? report.rubrics
          : report.rubric
            ? [report.rubric]
            : [],
    );
    if (rubrics.length > 0) return rubrics;
    throw new Error("Los archivos no contienen rubric ni rubrics.");
  }
  if (Array.isArray(experiment.semantic_analysis_rubrics)) {
    return experiment.semantic_analysis_rubrics;
  }
  throw new Error(
    "Falta --rubric=<json> y el experimento no tiene semantic_analysis_rubrics.",
  );
};

await loadEnvironment();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
if (!supabaseUrl || !secretKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
}
if (apply && !process.env.DEEPSEEK_API_KEY) {
  throw new Error("Falta DEEPSEEK_API_KEY.");
}

const urlProjectRef = new URL(supabaseUrl).hostname.split(".")[0];
if (apply && projectRef !== urlProjectRef) {
  throw new Error(
    `Para escribir, confirmá --project-ref=${urlProjectRef} explícitamente.`,
  );
}
if (apply && /localhost|127\.0\.0\.1/.test(supabaseUrl)) {
  throw new Error(
    "Este backfill remoto no se ejecuta contra Supabase local; usá el flujo de pruebas local.",
  );
}

const client = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const one = async (table, columns, column, value) => {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data;
};
const many = async (table, columns, column, value) => {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq(column, value);
  if (error) throw error;
  return data;
};

const experiment = await one(
  "experiments",
  "id,title,status,primary_language,alternate_language,semantic_analysis_rubrics,semantic_analysis_prepared_at,analysis_run_id,live_analysis_run_id,reporting_analysis_run_id",
  "id",
  experimentId,
);
if (!experiment) throw new Error("El experimento no existe.");
if (!["published", "closed"].includes(experiment.status)) {
  throw new Error("El experimento debe estar publicado o cerrado.");
}

const sessions = (
  await many(
    "participant_sessions",
    "id,content_language,recall_text,submitted_at",
    "experiment_id",
    experimentId,
  )
).filter((session) => session.recall_text && session.submitted_at);
const rubrics = await loadRubrics(experiment);
const rubricByLanguage = new Map(
  rubrics.map((rubric) => [rubric.language, rubric]),
);
const missingLanguages = [
  ...new Set(
    sessions
      .map((session) => session.content_language)
      .filter((language) => !rubricByLanguage.has(language)),
  ),
];
if (missingLanguages.length > 0) {
  throw new Error(`Faltan rúbricas V3.1 para: ${missingLanguages.join(", ")}.`);
}

const existingRun = requestedRunId
  ? await one(
      "analysis_runs",
      "id,status,schema_version,source_response_count",
      "id",
      requestedRunId,
    )
  : null;
if (requestedRunId && !existingRun) {
  throw new Error(`No existe la corrida ${requestedRunId}.`);
}
if (existingRun && existingRun.schema_version !== "semantic-frames-v3.1") {
  throw new Error("La corrida indicada no es V3.1.");
}
const runId = existingRun?.id ?? requestedRunId ?? randomUUID();
const current = await many("recall_analyses", "session_id", "run_id", runId);
const completedSessionIds = new Set(
  current.map((analysis) => analysis.session_id),
);
const pending = sessions.filter(
  (session) => !completedSessionIds.has(session.id),
);

const semanticPhenomena = (rubric, assessment) => {
  const facts = rubric.narrativeUnits.flatMap((unit) => unit.facts);
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const phenomena = [];
  const add = (component, excerpt, label) => {
    phenomena.push({
      kind:
        component.status === "omitted"
          ? "omission"
          : component.status === "transformed"
            ? "substitution"
            : "retained",
      storyExcerpt: excerpt,
      recallExcerpt: component.evidence,
      explanation:
        component.status === "omitted"
          ? `No se conserva ${label}.`
          : component.status === "transformed"
            ? `${label} aparece transformado como ${component.observedValue ?? "otra forma"}.`
            : `Se conserva ${label}.`,
      confidence: component.confidence,
    });
  };
  for (const evaluated of assessment.factAssessments) {
    const fact = byId.get(evaluated.factId);
    if (!fact) continue;
    add(
      evaluated.predicate,
      fact.frame.predicate.sourceExcerpt ?? fact.storyExcerpt ?? fact.statement,
      `la acción «${fact.frame.predicate.label}»`,
    );
    const slots = new Map(
      evaluated.slots.map((component) => [component.slotId, component]),
    );
    for (const slot of fact.frame.slots) {
      const component = slots.get(slot.slotId);
      if (!component || component.status === "preserved") continue;
      add(
        component,
        slot.sourceExcerpt ?? fact.storyExcerpt ?? fact.statement,
        `${slot.role}=${slot.expected}`,
      );
    }
  }
  for (const intrusion of assessment.intrusions) {
    phenomena.push({
      kind: "intrusion",
      storyExcerpt: null,
      recallExcerpt: intrusion.evidence,
      explanation: intrusion.explanation,
      confidence: intrusion.confidence,
    });
  }
  return phenomena;
};

console.log(`${apply ? "APPLY" : "DRY RUN"}: ${experiment.title}`);
console.log(`Corrida: ${runId}${existingRun ? " (reanudar)" : " (nueva)"}`);
console.log(`Rúbricas: ${[...rubricByLanguage.keys()].join(", ")}`);
console.log(
  `Respuestas: ${sessions.length}; completas: ${completedSessionIds.size}; pendientes: ${pending.length}`,
);

if (!apply) {
  console.log("Sin cambios. Agregá --apply y --project-ref para ejecutar.");
  process.exit(0);
}

const now = new Date().toISOString();
if (!existingRun) {
  const { error } = await client.from("analysis_runs").insert({
    id: runId,
    experiment_id: experimentId,
    status: "running",
    analyzer_version: `deepseek:${model}`,
    schema_version: "semantic-frames-v3.1",
    rubric_snapshot: rubrics,
    completed_at: null,
    source_response_count: sessions.length,
    created_at: now,
  });
  if (error) throw error;
  const { error: experimentError } = await client
    .from("experiments")
    .update({
      semantic_analysis_rubrics: rubrics,
      semantic_analysis_prepared_at: now,
    })
    .eq("id", experimentId);
  if (experimentError) throw experimentError;
}

// A live run remains open: future submissions append analyses to it.
const { error: runningError } = await client
  .from("analysis_runs")
  .update({ status: "running", completed_at: null })
  .eq("id", runId);
if (runningError) throw runningError;

if (promoteLive) {
  const { error } = await client
    .from("experiments")
    .update({ live_analysis_run_id: runId })
    .eq("id", experimentId);
  if (error) throw error;
  console.log("V3 promovida como corrida live; los nuevos submits ya usan V3.");
}

// Existing V3 rows may predate inline-compatible phenomena. Refreshing these
// is deterministic and does not call the LLM.
const existingAnalyses = await many(
  "recall_analyses",
  "id,session_id,semantic_assessment",
  "run_id",
  runId,
);
for (const analysis of existingAnalyses) {
  if (!analysis.semantic_assessment) continue;
  const session = sessions.find(
    (candidate) => candidate.id === analysis.session_id,
  );
  const rubric = session && rubricByLanguage.get(session.content_language);
  if (!rubric) continue;
  const { error } = await client
    .from("recall_analyses")
    .update({
      phenomena: semanticPhenomena(rubric, analysis.semantic_assessment),
    })
    .eq("id", analysis.id);
  if (error) throw error;
}

const failures = [];
for (const [index, session] of pending.entries()) {
  const rubric = rubricByLanguage.get(session.content_language);
  process.stdout.write(
    `[${index + 1}/${pending.length}] ${session.id.slice(0, 8)} (${session.content_language})... `,
  );
  try {
    const result = await analyzeSemanticFrames(rubric, session.recall_text);
    const summary = summarizeParticipantV3(
      rubric,
      result.output.factAssessments,
    );
    const { error } = await client.from("recall_analyses").insert({
      id: randomUUID(),
      run_id: runId,
      session_id: session.id,
      experiment_id: experimentId,
      status: "completed",
      rubric_version: rubric.version,
      analyzer_provider: "deepseek",
      analyzer_model: result.model,
      prompt_version: "semantic-frame-assessment-v3.1",
      input_tokens: result.usage?.prompt_tokens ?? null,
      output_tokens: result.usage?.completion_tokens ?? null,
      retained_units_count: summary.facts.preserved,
      omitted_units_count: summary.facts.omitted,
      intrusion_count: result.output.intrusions.length,
      phenomena: semanticPhenomena(rubric, result.output),
      unit_assessments: [],
      semantic_assessment: result.output,
      semantic_summary: summary,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    console.log("ok");
  } catch (error) {
    failures.push({
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log("ERROR");
    console.error(failures.at(-1));
  }
}

const finalAnalyses = await many(
  "recall_analyses",
  "session_id",
  "run_id",
  runId,
);
const complete =
  failures.length === 0 && finalAnalyses.length === sessions.length;
const { error: finishError } = await client
  .from("analysis_runs")
  .update({
    status: "running",
    completed_at: null,
    source_response_count: sessions.length,
  })
  .eq("id", runId);
if (finishError) throw finishError;

if (promoteReporting) {
  if (!complete) {
    throw new Error("No se puede promover reporting con cobertura incompleta.");
  }
  const { error } = await client
    .from("experiments")
    .update({ reporting_analysis_run_id: runId })
    .eq("id", experimentId);
  if (error) throw error;
  console.log("V3 promovida para reporting. V1 queda intacta para rollback.");
}

console.log(
  complete
    ? `Backfill V3.1 completo: ${runId}`
    : `Backfill incompleto: ${failures.length} errores. Reanudá con --run-id=${runId}.`,
);

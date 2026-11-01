import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

if (!args.input) {
  throw new Error("Uso: node render-v3-report.mjs --input=<resultado-v3.json>");
}

const inputPath = resolve(args.input);
const data = JSON.parse(await readFile(inputPath, "utf8"));
const outputPath = resolve(
  args.output ??
    `${dirname(inputPath)}/${basename(inputPath, extname(inputPath))}.html`,
);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const percent = (value) =>
  value == null ? "—" : `${Math.round(value * 100)}%`;

const statusLabel = {
  preserved: "Preservado",
  partial: "Parcial",
  transformed: "Transformado",
  omitted: "Omitido",
};

const importanceLabel = {
  backbone: "Estructura principal",
  supporting: "Secundario",
  detail: "Detalle",
};

const roleLabel = {
  agent: "agente",
  patient: "receptor",
  theme: "elemento",
  destination: "destino",
  source: "origen",
  location: "lugar",
  time: "tiempo",
  attribute: "atributo",
  relation_target: "relación",
  manner: "modo",
  quantity: "cantidad",
};

const normalizeEntityForm = (value) =>
  value
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token && !["el", "la", "los", "las", "un", "una"].includes(token),
    )
    .join(" ");

const facts = data.rubric.narrativeUnits.flatMap((unit) =>
  unit.facts.map((fact) => ({ ...fact, unitText: unit.text })),
);
const factById = new Map(facts.map((fact) => [fact.id, fact]));
const participantById = new Map(
  data.cohort.participants.map((participant) => [participant.id, participant]),
);

const analyses = data.analyses.map((item) => ({
  ...item,
  assessments: new Map(
    item.analysis.output.factAssessments.map((assessment) => [
      assessment.factId,
      assessment,
    ]),
  ),
}));

const entityMappings = data.analyses.flatMap((item) =>
  (item.analysis.output.entityMappings ?? [])
    .filter(
      (mapping) =>
        normalizeEntityForm(mapping.canonicalEntity) !==
        normalizeEntityForm(mapping.observedForm),
    )
    .map((mapping) => ({
      words: item.words,
      ...mapping,
    })),
);

const reviewItems = [];
for (const item of analyses) {
  for (const assessment of item.analysis.output.factAssessments) {
    const fact = factById.get(assessment.factId);
    const components = [
      {
        type: "predicate",
        label: `predicado · ${fact.frame.predicate.label}`,
        ...assessment.predicate,
      },
      ...assessment.slots.map((slotAssessment) => {
        const slot = fact.frame.slots.find(
          (candidate) => candidate.slotId === slotAssessment.slotId,
        );
        return {
          type: "slot",
          label: `${roleLabel[slot.role] ?? slot.role} · ${slot.expected}`,
          ...slotAssessment,
        };
      }),
    ];
    for (const component of components) {
      if (
        component.anchored !== false &&
        (component.needsReview || component.confidence < 0.75)
      ) {
        reviewItems.push({
          words: item.words,
          fact,
          component,
        });
      }
    }
  }
}

const profileRows = data.analyses
  .map((item) => {
    const profile = participantById.get(item.id);
    const backbone = profile.byImportance.backbone.components.presenceRate;
    const secondary =
      (profile.byImportance.supporting.components.preserved +
        profile.byImportance.supporting.components.transformed +
        profile.byImportance.detail.components.preserved +
        profile.byImportance.detail.components.transformed) /
      (profile.byImportance.supporting.components.total +
        profile.byImportance.detail.components.total);
    return `
      <tr>
        <td><strong>${item.words} palabras</strong></td>
        <td>${percent(profile.facts.presenceRate)}</td>
        <td>${percent(profile.facts.exactRate)}</td>
        <td>${percent(profile.components.presenceRate)}</td>
        <td>${percent(profile.components.fidelityRate)}</td>
        <td class="bar-cell"><span>${percent(backbone)}</span><i style="--value:${backbone}"></i></td>
        <td class="bar-cell"><span>${percent(secondary)}</span><i style="--value:${secondary}"></i></td>
      </tr>`;
  })
  .join("");

const factCards = facts
  .map((fact) => {
    const perResponse = analyses.map((item) => ({
      words: item.words,
      assessment: item.assessments.get(fact.id),
    }));
    const counts = Object.fromEntries(
      ["preserved", "partial", "transformed", "omitted"].map((status) => [
        status,
        perResponse.filter(({ assessment }) => assessment.status === status)
          .length,
      ]),
    );
    const presence =
      (counts.preserved + counts.partial + counts.transformed) /
      perResponse.length;
    const responseDetails = perResponse
      .map(({ words, assessment }) => {
        const components = [
          {
            title: `Predicado · ${fact.frame.predicate.label}`,
            ...assessment.predicate,
          },
          ...assessment.slots.map((slotAssessment) => {
            const slot = fact.frame.slots.find(
              (candidate) => candidate.slotId === slotAssessment.slotId,
            );
            return {
              title: `${roleLabel[slot.role] ?? slot.role} · ${slot.expected}`,
              ...slotAssessment,
            };
          }),
        ]
          .map(
            (component) => `
              <li>
                <span class="dot ${component.status}"></span>
                <strong>${escapeHtml(component.title)}</strong>
                <span>${component.anchored === false ? "No evaluado: falta el predicado" : `${statusLabel[component.status]} · ${percent(component.confidence)}`}</span>
                ${component.evidence ? `<q>${escapeHtml(component.evidence)}</q>` : ""}
              </li>`,
          )
          .join("");
        return `
          <details class="response-detail">
            <summary>
              <strong>${words} palabras</strong>
              <span class="pill ${assessment.status}">${statusLabel[assessment.status]}</span>
            </summary>
            <ul>${components}</ul>
          </details>`;
      })
      .join("");

    return `
      <details class="fact-card">
        <summary>
          <div>
            <span class="eyebrow">${escapeHtml(fact.id)} · ${importanceLabel[fact.importance]}</span>
            <strong>${escapeHtml(fact.statement)}</strong>
          </div>
          <div class="fact-summary">
            <b>${percent(presence)} presente</b>
            <span class="mini-count preserved">${counts.preserved}</span>
            <span class="mini-count partial">${counts.partial}</span>
            <span class="mini-count transformed">${counts.transformed}</span>
            <span class="mini-count omitted">${counts.omitted}</span>
          </div>
        </summary>
        <p class="source">${escapeHtml(fact.unitText)}</p>
        <div class="responses">${responseDetails}</div>
      </details>`;
  })
  .join("");

const reviewCards = reviewItems
  .sort((left, right) => left.component.confidence - right.component.confidence)
  .map(
    ({ words, fact, component }) => `
      <article class="review-card">
        <div>
          <span class="eyebrow">${words} palabras · ${escapeHtml(fact.id)}</span>
          <strong>${escapeHtml(fact.statement)}</strong>
          <span>${escapeHtml(component.label)}</span>
        </div>
        <div>
          <span class="pill ${component.status}">${statusLabel[component.status]}</span>
          <b>${percent(component.confidence)}</b>
        </div>
        ${component.evidence ? `<q>${escapeHtml(component.evidence)}</q>` : "<em>Sin evidencia localizada</em>"}
        ${component.observedValue ? `<small>Interpretado como: ${escapeHtml(component.observedValue)}</small>` : ""}
      </article>`,
  )
  .join("");

const entityMappingCards = entityMappings
  .map(
    (mapping) => `
      <article class="mapping-card">
        <span class="eyebrow">${mapping.words} palabras</span>
        <strong>${escapeHtml(mapping.canonicalEntity)} → ${escapeHtml(mapping.observedForm)}</strong>
        <span>${mapping.relation === "equivalent_relabeling" ? "Reformulación equivalente" : "Cambio de identidad"} · ${percent(mapping.confidence)}</span>
        <q>${escapeHtml(mapping.evidence)}</q>
        <small>${escapeHtml(mapping.explanation)}</small>
      </article>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Piloto V3.1 · análisis por componentes</title>
  <style>
    :root { color-scheme: dark; --bg:#121513; --panel:#1b201d; --panel2:#222824; --line:#39423d; --text:#edf1ee; --muted:#aab2ad; --green:#35d0a0; --yellow:#f1b82d; --orange:#f08c46; --red:#f26b6b; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:16px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    main { width:min(1500px,calc(100% - 40px)); margin:0 auto; padding:44px 0 80px; }
    h1 { margin:0 0 6px; font-size:clamp(32px,5vw,58px); letter-spacing:-.04em; }
    h2 { margin:48px 0 8px; font-size:28px; }
    .lead,.section-note { color:var(--muted); margin:0 0 24px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
    .metric { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:20px; }
    .metric span { display:block; color:var(--muted); }
    .metric strong { display:block; font-size:34px; margin-top:6px; }
    .metric small { color:var(--muted); }
    .legend { display:flex; flex-wrap:wrap; gap:14px; margin:18px 0; color:var(--muted); }
    .legend span { display:flex; align-items:center; gap:7px; }
    .dot { width:10px; height:10px; border-radius:50%; display:inline-block; flex:none; }
    .preserved { --status:var(--green); }.partial { --status:var(--yellow); }.transformed { --status:var(--orange); }.omitted { --status:var(--red); }
    .dot,.mini-count,.pill { background:var(--status); }
    .table-wrap { overflow:auto; border:1px solid var(--line); border-radius:16px; background:var(--panel); }
    table { width:100%; border-collapse:collapse; min-width:900px; }
    th,td { padding:15px 17px; border-bottom:1px solid var(--line); text-align:left; white-space:nowrap; }
    th { color:var(--muted); font-size:13px; text-transform:uppercase; letter-spacing:.06em; }
    tr:last-child td { border-bottom:0; }
    .bar-cell { min-width:150px; }.bar-cell span { display:inline-block; width:42px; }
    .bar-cell i { display:inline-block; width:80px; height:7px; border-radius:9px; background:linear-gradient(90deg,var(--green) calc(var(--value) * 100%),#414843 0); }
    .review-list,.mapping-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .review-card { background:#241e1a; border:1px solid #604b37; border-radius:14px; padding:16px; display:grid; grid-template-columns:1fr auto; gap:8px 18px; }
    .review-card div:first-child { display:flex; flex-direction:column; gap:4px; }.review-card div:nth-child(2) { display:flex; gap:10px; align-items:flex-start; }
    .review-card q,.review-card em,.review-card small { grid-column:1/-1; color:var(--muted); }
    .mapping-card { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:5px; }
    .mapping-card strong { font-size:20px; }.mapping-card q,.mapping-card small { color:var(--muted); }
    .eyebrow { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.07em; }
    .pill { display:inline-flex; color:#0d1713; padding:4px 9px; border-radius:999px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
    .facts { display:grid; gap:9px; }
    details { background:var(--panel); border:1px solid var(--line); border-radius:14px; }
    summary { cursor:pointer; list-style:none; } summary::-webkit-details-marker { display:none; }
    .fact-card>summary { padding:16px 18px; display:flex; justify-content:space-between; align-items:center; gap:24px; }
    .fact-card>summary>div:first-child { display:flex; flex-direction:column; gap:4px; }
    .fact-summary { display:flex; align-items:center; gap:8px; color:var(--muted); }
    .fact-summary b { color:var(--text); margin-right:5px; }
    .mini-count { color:#101512; width:24px; height:24px; display:grid; place-items:center; border-radius:50%; font-size:12px; font-weight:800; }
    .source { color:var(--muted); background:var(--panel2); padding:14px 18px; margin:0; border-block:1px solid var(--line); }
    .responses { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; padding:12px; }
    .response-detail { background:var(--panel2); }.response-detail summary { padding:12px; display:flex; justify-content:space-between; gap:8px; align-items:center; }
    .response-detail ul { margin:0; padding:0 12px 12px; list-style:none; display:grid; gap:10px; }
    .response-detail li { display:grid; grid-template-columns:auto 1fr; gap:2px 8px; color:var(--muted); font-size:13px; }
    .response-detail li strong { color:var(--text); }.response-detail li span:not(.dot) { grid-column:2; }.response-detail q { grid-column:2; }
    @media (max-width:1000px) { .cards { grid-template-columns:repeat(2,1fr); }.review-list,.mapping-list { grid-template-columns:1fr; }.responses { grid-template-columns:1fr 1fr; } }
    @media (max-width:620px) { main { width:min(100% - 22px,1500px); padding-top:24px; }.cards { grid-template-columns:1fr; }.responses { grid-template-columns:1fr; }.fact-card>summary { align-items:flex-start; flex-direction:column; }.fact-summary { flex-wrap:wrap; } }
  </style>
</head>
<body>
<main>
  <span class="eyebrow">Evaluación local · ${escapeHtml(data.promptVersion)}</span>
  <h1>Piloto V3.1 · análisis por componentes</h1>
  <p class="lead">La unidad de análisis ya no es solamente una oración: cada hecho se descompone en predicado y participantes semánticos.</p>

  <section class="cards">
    <article class="metric"><span>Respuestas piloto</span><strong>${data.cohort.participantCount}</strong><small>${facts.length} hechos por respuesta</small></article>
    <article class="metric"><span>Hechos presentes</span><strong>${percent(data.cohort.facts.presenceRate)}</strong><small>incluye preservados, parciales y transformados</small></article>
    <article class="metric"><span>Hechos exactos</span><strong>${percent(data.cohort.facts.exactRate)}</strong><small>predicado y todos sus componentes preservados</small></article>
    <article class="metric"><span>Fidelidad de componentes</span><strong>${percent(data.cohort.components.fidelityRate)}</strong><small>${percent(data.cohort.components.presenceRate)} presentes o transformados</small></article>
  </section>

  <h2>Perfiles de respuesta</h2>
  <p class="section-note">Permite ver respuestas que retienen la estructura principal pero pierden detalles, y viceversa.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Respuesta</th><th>Hechos presentes</th><th>Hechos exactos</th><th>Componentes presentes</th><th>Fidelidad</th><th>Estructura principal</th><th>Secundarios + detalles</th></tr></thead>
    <tbody>${profileRows}</tbody>
  </table></div>

  <h2>Reformulaciones globales</h2>
  <p class="section-note">Se detectan una sola vez por respuesta. No se repiten como supuestas transformaciones de cada hecho.</p>
  <div class="mapping-list">${entityMappingCards || "<p>No se detectaron reformulaciones globales.</p>"}</div>

  <h2>Revisión requerida <span class="pill partial">${reviewItems.length}</span></h2>
  <p class="section-note">Juicios con confianza menor a 75% o sin evidencia localizable. No deberían convertirse en conclusiones sin inspección.</p>
  <div class="review-list">${reviewCards || "<p>No hay casos marcados.</p>"}</div>

  <h2>Hechos y componentes</h2>
  <div class="legend">
    <span><i class="dot preserved"></i>Preservado</span><span><i class="dot partial"></i>Parcial</span><span><i class="dot transformed"></i>Transformado</span><span><i class="dot omitted"></i>Omitido</span>
  </div>
  <p class="section-note">Cada fila resume el hecho en las cinco respuestas. Abrila para inspeccionar predicado, roles y evidencia.</p>
  <div class="facts">${factCards}</div>
</main>
</body>
</html>`;

await writeFile(outputPath, html);
console.log(outputPath);

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

if (!args.input || !args.output) {
  throw new Error(
    "Uso: node render-v3-dashboard.mjs --input=<resultado-v3.json> --output=<dashboard.html>",
  );
}

const data = JSON.parse(await readFile(resolve(args.input), "utf8"));
const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) rows.push([...row, field]);
  const [rawHeaders, ...values] = rows;
  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "") : header,
  );
  return values
    .filter((value) => value.some(Boolean))
    .map((value) =>
      Object.fromEntries(
        headers.map((header, index) => [header, value[index] ?? ""]),
      ),
    );
};
const sessions = args.csv
  ? parseCsv(await readFile(resolve(args.csv), "utf8"))
  : [];
const sessionById = new Map(
  sessions.map((session) => [session.id_sesion, session]),
);
const facts = data.rubric.narrativeUnits.flatMap((unit) => unit.facts);
const assessments = data.analyses.flatMap((analysis) =>
  analysis.analysis.output.factAssessments.map((assessment) => ({
    responseId: analysis.id,
    words: analysis.words,
    ...assessment,
  })),
);

const percent = (value) => Math.round(value * 100);
const importanceLabel = {
  backbone: "Estructura principal",
  supporting: "Secundario",
  detail: "Detalle",
};

const factStats = facts.map((fact) => {
  const values = assessments.filter(
    (assessment) => assessment.factId === fact.id,
  );
  const count = (status) =>
    values.filter((assessment) => assessment.status === status).length;
  const preserved = count("preserved");
  const partial = count("partial");
  const transformed = count("transformed");
  const omitted = count("omitted");
  return {
    id: fact.id,
    statement: fact.statement,
    importance: fact.importance,
    presence: (preserved + partial + transformed) / values.length,
    exact: preserved / values.length,
    transformed: transformed / values.length,
    omitted: omitted / values.length,
  };
});

const sumImportance = (participant, importance) =>
  participant.byImportance[importance].components;
const profiles = data.analyses.map((analysis) => {
  const participant = data.cohort.participants.find(
    (candidate) => candidate.id === analysis.id,
  );
  const supporting = sumImportance(participant, "supporting");
  const detail = sumImportance(participant, "detail");
  const session = sessionById.get(analysis.id);
  return {
    words: analysis.words,
    backbone: sumImportance(participant, "backbone").presenceRate,
    secondary:
      (supporting.preserved +
        supporting.transformed +
        detail.preserved +
        detail.transformed) /
      (supporting.total + detail.total),
    factPresence: participant.facts.presenceRate,
    exact: participant.facts.exactRate,
    fidelity: participant.components.fidelityRate,
    readingSeconds: Number(session?.duracion_lectura_segundos) || null,
    writingSeconds: Number(session?.duracion_reconstruccion_segundos) || null,
    totalSeconds: Number(session?.duracion_total_segundos) || null,
  };
});

const aggregateImportance = (importance) => {
  const values = data.cohort.participants.map(
    (participant) => participant.byImportance[importance].components,
  );
  const total = values.reduce((sum, value) => sum + value.total, 0);
  return (
    values.reduce(
      (sum, value) => sum + value.preserved + value.transformed,
      0,
    ) / total
  );
};

const normalizeEntity = (value) =>
  value
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token && !["el", "la", "los", "las", "un", "una"].includes(token),
    )
    .join(" ");

const mappings = new Map();
for (const analysis of data.analyses) {
  for (const mapping of analysis.analysis.output.entityMappings ?? []) {
    if (
      normalizeEntity(mapping.canonicalEntity) ===
      normalizeEntity(mapping.observedForm)
    ) {
      continue;
    }
    const key = `${mapping.canonicalEntity}|${mapping.observedForm}`;
    const current = mappings.get(key) ?? {
      canonical: mapping.canonicalEntity,
      observed: mapping.observedForm,
      relation: mapping.relation,
      count: 0,
    };
    current.count += 1;
    mappings.set(key, current);
  }
}

const rank = (key, direction = "desc") =>
  [...factStats]
    .sort((left, right) =>
      direction === "desc" ? right[key] - left[key] : left[key] - right[key],
    )
    .slice(0, 5);

const payload = {
  profiles,
  rankings: {
    remembered: rank("presence"),
    forgotten: rank("omitted"),
    transformed: rank("transformed"),
  },
  mappings: [...mappings.values()].sort(
    (left, right) => right.count - left.count,
  ),
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const rankingList = (items, metric) =>
  items
    .map(
      (item, index) => `
        <li>
          <div class="bvd-rank-label">
            <span>${index + 1}. ${escapeHtml(item.statement)}</span>
            <strong class="tabular-nums">${percent(item[metric])}%</strong>
          </div>
          <div class="progress" role="progressbar" aria-label="${escapeHtml(item.statement)}" aria-valuenow="${percent(item[metric])}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width:${percent(item[metric])}%"></div>
          </div>
          <small class="text-muted">${importanceLabel[item.importance]}</small>
        </li>`,
    )
    .join("");

const mappingRows = payload.mappings
  .map(
    (mapping) => `
      <tr>
        <td><strong>${escapeHtml(mapping.canonical)}</strong></td>
        <td>→ ${escapeHtml(mapping.observed)}</td>
        <td>${mapping.relation === "changed_identity" ? "Cambio de identidad" : "Reformulación equivalente"}</td>
        <td class="text-end">${mapping.count}</td>
      </tr>`,
  )
  .join("");

const fragment = `<div id="bartlett-v3-dashboard">
  <style>
    #bartlett-v3-dashboard { color:var(--foreground); display:grid; gap:28px; }
    #bartlett-v3-dashboard .bvd-heading { display:flex; justify-content:space-between; gap:20px; align-items:end; flex-wrap:wrap; }
    #bartlett-v3-dashboard .bvd-heading h1,
    #bartlett-v3-dashboard .bvd-heading p { margin:0; }
    #bartlett-v3-dashboard .bvd-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); }
    #bartlett-v3-dashboard .bvd-sections { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr); gap:28px; align-items:start; }
    #bartlett-v3-dashboard .bvd-section { min-width:0; }
    #bartlett-v3-dashboard .bvd-section h2 { margin:0 0 4px; }
    #bartlett-v3-dashboard .bvd-section > p { margin:0 0 14px; }
    #bartlett-v3-dashboard .bvd-plot { width:100%; min-height:340px; }
    #bartlett-v3-dashboard .bvd-time-plot { width:100%; min-height:390px; }
    #bartlett-v3-dashboard .bvd-plot svg { width:100%; display:block; }
    #bartlett-v3-dashboard .bvd-time-plot svg { width:100%; display:block; }
    #bartlett-v3-dashboard .bvd-rankings { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:26px; }
    #bartlett-v3-dashboard .bvd-ranking h3 { margin:0 0 12px; }
    #bartlett-v3-dashboard .bvd-ranking ol { list-style:none; padding:0; margin:0; display:grid; gap:16px; }
    #bartlett-v3-dashboard .bvd-rank-label { display:flex; justify-content:space-between; gap:12px; margin-bottom:5px; }
    #bartlett-v3-dashboard .bvd-rank-label span { max-width:80%; }
    #bartlett-v3-dashboard .bvd-ranking small { display:block; margin-top:4px; }
    #bartlett-v3-dashboard .bvd-importance { display:grid; gap:14px; }
    #bartlett-v3-dashboard .bvd-importance-row { display:grid; grid-template-columns:150px 1fr 44px; gap:12px; align-items:center; }
    #bartlett-v3-dashboard .bvd-importance-row .progress { margin:0; }
    #bartlett-v3-dashboard .bvd-note { margin-top:14px; }
    #bartlett-v3-dashboard .bvd-correlation { margin:12px 0 0; }
    @media (max-width:800px) {
      #bartlett-v3-dashboard .bvd-kpis,
      #bartlett-v3-dashboard .bvd-rankings { grid-template-columns:1fr; }
      #bartlett-v3-dashboard .bvd-sections { grid-template-columns:1fr; }
    }
    @media (max-width:460px) {
      #bartlett-v3-dashboard .bvd-importance-row { grid-template-columns:1fr 44px; }
      #bartlett-v3-dashboard .bvd-importance-row > span:first-child { grid-column:1/-1; }
    }
  </style>

  <header class="bvd-heading">
    <div>
      <h1>Memoria reconstructiva</h1>
      <p class="text-muted">Piloto V3.1 · 5 respuestas en español · 36 hechos por respuesta</p>
    </div>
    <span class="viz-badge">Vista descriptiva</span>
  </header>

  <section class="viz-grid bvd-kpis" aria-label="Resumen">
    <article class="card viz-stat">
      <span class="text-muted">Hechos presentes</span>
      <strong class="viz-stat-value tabular-nums">${percent(data.cohort.facts.presenceRate)}%</strong>
      <span class="text-muted">Preservados, parciales o transformados</span>
    </article>
    <article class="card viz-stat">
      <span class="text-muted">Hechos exactos</span>
      <strong class="viz-stat-value tabular-nums">${percent(data.cohort.facts.exactRate)}%</strong>
      <span class="text-muted">Sin transformación semántica</span>
    </article>
    <article class="card viz-stat">
      <span class="text-muted">Componentes fieles</span>
      <strong class="viz-stat-value tabular-nums">${percent(data.cohort.components.fidelityRate)}%</strong>
      <span class="text-muted">Predicados y roles preservados</span>
    </article>
  </section>

  <section class="bvd-sections">
    <div class="bvd-section">
      <h2>Perfiles de reconstrucción</h2>
      <p class="text-muted">Cada punto es una respuesta; la etiqueta indica su cantidad de palabras.</p>
      <div class="bvd-plot" role="img" aria-label="Dispersión entre retención de estructura principal y retención de datos secundarios"></div>
    </div>
    <div class="bvd-section">
      <h2>Jerarquía de retención</h2>
      <p class="text-muted">Presencia de componentes según su función narrativa.</p>
      <div class="bvd-importance">
        <div class="bvd-importance-row"><span>Estructura principal</span><div class="progress" role="progressbar" aria-valuenow="${percent(aggregateImportance("backbone"))}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${percent(aggregateImportance("backbone"))}%"></div></div><strong class="tabular-nums">${percent(aggregateImportance("backbone"))}%</strong></div>
        <div class="bvd-importance-row"><span>Información secundaria</span><div class="progress" role="progressbar" aria-valuenow="${percent(aggregateImportance("supporting"))}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${percent(aggregateImportance("supporting"))}%"></div></div><strong class="tabular-nums">${percent(aggregateImportance("supporting"))}%</strong></div>
        <div class="bvd-importance-row"><span>Detalles</span><div class="progress" role="progressbar" aria-valuenow="${percent(aggregateImportance("detail"))}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${percent(aggregateImportance("detail"))}%"></div></div><strong class="tabular-nums">${percent(aggregateImportance("detail"))}%</strong></div>
      </div>
      <p class="text-muted text-small bvd-note">El piloto sugiere una caída progresiva desde la estructura narrativa hacia los detalles.</p>
    </div>
  </section>

  <hr />

  <section class="bvd-section">
    <h2>Tiempo y calidad de reconstrucción</h2>
    <p class="text-muted">Exploración sobre las mismas cinco respuestas. Elegí qué tiempo y qué resultado comparar.</p>
    <div class="viz-controls">
      <label class="form-label" for="bvd-time-variable">Tiempo
        <select class="form-select" id="bvd-time-variable">
          <option value="readingSeconds">Lectura</option>
          <option value="writingSeconds">Escritura</option>
          <option value="totalSeconds">Total</option>
        </select>
      </label>
      <label class="form-label" for="bvd-quality-variable">Calidad
        <select class="form-select" id="bvd-quality-variable">
          <option value="backbone">Retención de estructura principal</option>
          <option value="factPresence">Hechos presentes</option>
          <option value="exact">Hechos exactos</option>
          <option value="fidelity">Fidelidad de componentes</option>
          <option value="words">Cantidad de palabras</option>
        </select>
      </label>
    </div>
    <p class="bvd-correlation" aria-live="polite"></p>
    <div class="bvd-time-plot" role="img" aria-label="Relación entre tiempo y calidad de la reconstrucción"></div>
    <p class="text-muted text-small">Con n=5, la correlación es solo una señal exploratoria: no permite afirmar causalidad ni significación estadística.</p>
  </section>

  <hr />

  <section class="bvd-section">
    <h2>Rankings de la historia</h2>
    <p class="text-muted">Top 5 sobre el piloto. Con solo cinco respuestas, cada caso equivale a 20 puntos porcentuales.</p>
    <div class="bvd-rankings">
      <div class="bvd-ranking"><h3>Más recordado</h3><ol>${rankingList(payload.rankings.remembered, "presence")}</ol></div>
      <div class="bvd-ranking"><h3>Más olvidado</h3><ol>${rankingList(payload.rankings.forgotten, "omitted")}</ol></div>
      <div class="bvd-ranking"><h3>Más transformado</h3><ol>${rankingList(payload.rankings.transformed, "transformed")}</ol></div>
    </div>
  </section>

  <hr />

  <section class="bvd-section">
    <h2>Reformulaciones de entidades</h2>
    <p class="text-muted">Variantes detectadas una sola vez por respuesta, sin repetirlas en cada hecho.</p>
    <div class="table-responsive">
      <table class="table table-sm">
        <thead><tr><th>Original</th><th>Recordado como</th><th>Lectura</th><th class="text-end">Casos</th></tr></thead>
        <tbody>${mappingRows || '<tr><td colspan="4">No se detectaron reformulaciones.</td></tr>'}</tbody>
      </table>
    </div>
  </section>

  <script>
    (() => {
      const root = document.getElementById("bartlett-v3-dashboard");
      const container = root.querySelector(".bvd-plot");
      const timeContainer = root.querySelector(".bvd-time-plot");
      const timeSelect = root.querySelector("#bvd-time-variable");
      const qualitySelect = root.querySelector("#bvd-quality-variable");
      const correlationLabel = root.querySelector(".bvd-correlation");
      const profiles = ${JSON.stringify(payload.profiles)};
      const draw = () => {
        const width = Math.max(320, container.clientWidth);
        const height = 340;
        const margin = { top: 24, right: 24, bottom: 58, left: 62 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const x = value => margin.left + value * plotWidth;
        const y = value => margin.top + (1 - value) * plotHeight;
        const ticks = [0, .25, .5, .75, 1];
        const grid = ticks.map(value => \`<line x1="\${x(0)}" y1="\${y(value)}" x2="\${x(1)}" y2="\${y(value)}" stroke="var(--border)" /><text x="\${margin.left - 10}" y="\${y(value) + 4}" text-anchor="end" fill="var(--muted-foreground)">\${Math.round(value * 100)}%</text>\`).join("");
        const xTicks = ticks.map(value => \`<text x="\${x(value)}" y="\${height - margin.bottom + 22}" text-anchor="middle" fill="var(--muted-foreground)">\${Math.round(value * 100)}%</text>\`).join("");
        const points = profiles.map((profile, index) => {
          const dx = index % 2 === 0 ? 9 : -9;
          const anchor = dx > 0 ? "start" : "end";
          return \`<g><circle cx="\${x(profile.backbone)}" cy="\${y(profile.secondary)}" r="7" fill="var(--viz-series-1)" tabindex="0"><title>\${profile.words} palabras: estructura \${Math.round(profile.backbone * 100)}%, secundarios \${Math.round(profile.secondary * 100)}%</title></circle><text x="\${x(profile.backbone) + dx}" y="\${y(profile.secondary) - 9}" text-anchor="\${anchor}" fill="var(--foreground)">\${profile.words} palabras</text></g>\`;
        }).join("");
        container.innerHTML = \`<svg viewBox="0 0 \${width} \${height}" aria-hidden="true"><rect data-chart-frame x="\${margin.left}" y="\${margin.top}" width="\${plotWidth}" height="\${plotHeight}" fill="none" stroke="var(--border)" />\${grid}\${xTicks}\${points}<text class="axis-title" data-axis="x" x="\${margin.left + plotWidth / 2}" y="\${height - 8}" text-anchor="middle" fill="var(--foreground)">Retención de estructura principal</text><text class="axis-title" data-axis="y" transform="translate(16 \${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle" fill="var(--foreground)">Secundarios y detalles</text></svg>\`;
      };
      const timeLabels = { readingSeconds:"Tiempo de lectura", writingSeconds:"Tiempo de escritura", totalSeconds:"Tiempo total" };
      const qualityLabels = { backbone:"Retención de estructura principal", factPresence:"Hechos presentes", exact:"Hechos exactos", fidelity:"Fidelidad de componentes", words:"Cantidad de palabras" };
      const correlation = (values, xKey, yKey) => {
        const meanX = values.reduce((sum, value) => sum + value[xKey], 0) / values.length;
        const meanY = values.reduce((sum, value) => sum + value[yKey], 0) / values.length;
        const numerator = values.reduce((sum, value) => sum + (value[xKey] - meanX) * (value[yKey] - meanY), 0);
        const denominator = Math.sqrt(values.reduce((sum, value) => sum + (value[xKey] - meanX) ** 2, 0) * values.reduce((sum, value) => sum + (value[yKey] - meanY) ** 2, 0));
        return denominator === 0 ? 0 : numerator / denominator;
      };
      const drawTime = () => {
        const xKey = timeSelect.value;
        const yKey = qualitySelect.value;
        const values = profiles.filter(profile => Number.isFinite(profile[xKey]) && Number.isFinite(profile[yKey]));
        const width = Math.max(320, timeContainer.clientWidth);
        const height = 390;
        const margin = { top: 28, right: 30, bottom: 64, left: 70 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const rawX = values.map(value => value[xKey]);
        const rawY = values.map(value => value[yKey]);
        const xPad = Math.max(5, (Math.max(...rawX) - Math.min(...rawX)) * .1);
        const yPad = Math.max(yKey === "words" ? 5 : .04, (Math.max(...rawY) - Math.min(...rawY)) * .12);
        const xDomain = [Math.max(0, Math.min(...rawX) - xPad), Math.max(...rawX) + xPad];
        const yDomain = [Math.max(0, Math.min(...rawY) - yPad), Math.max(...rawY) + yPad];
        const x = value => margin.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
        const y = value => margin.top + (1 - (value - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;
        const tickValues = domain => Array.from({length:5}, (_, index) => domain[0] + index * (domain[1] - domain[0]) / 4);
        const xTicks = tickValues(xDomain).map(value => \`<g><line x1="\${x(value)}" y1="\${margin.top}" x2="\${x(value)}" y2="\${margin.top + plotHeight}" stroke="var(--border)"/><text x="\${x(value)}" y="\${height - margin.bottom + 23}" text-anchor="middle" fill="var(--muted-foreground)">\${Math.round(value)}s</text></g>\`).join("");
        const yTicks = tickValues(yDomain).map(value => \`<g><line x1="\${margin.left}" y1="\${y(value)}" x2="\${margin.left + plotWidth}" y2="\${y(value)}" stroke="var(--border)"/><text x="\${margin.left - 10}" y="\${y(value) + 4}" text-anchor="end" fill="var(--muted-foreground)">\${yKey === "words" ? Math.round(value) : Math.round(value * 100) + "%"}</text></g>\`).join("");
        const meanX = rawX.reduce((sum, value) => sum + value, 0) / values.length;
        const meanY = rawY.reduce((sum, value) => sum + value, 0) / values.length;
        const slopeNumerator = values.reduce((sum, value) => sum + (value[xKey] - meanX) * (value[yKey] - meanY), 0);
        const slopeDenominator = values.reduce((sum, value) => sum + (value[xKey] - meanX) ** 2, 0);
        const slope = slopeDenominator === 0 ? 0 : slopeNumerator / slopeDenominator;
        const intercept = meanY - slope * meanX;
        const trend = \`<line x1="\${x(xDomain[0])}" y1="\${y(intercept + slope * xDomain[0])}" x2="\${x(xDomain[1])}" y2="\${y(intercept + slope * xDomain[1])}" stroke="var(--viz-series-2)" stroke-width="2" />\`;
        const points = values.map((profile, index) => {
          const dx = index % 2 === 0 ? 10 : -10;
          const anchor = dx > 0 ? "start" : "end";
          const quality = yKey === "words" ? profile[yKey] + " palabras" : Math.round(profile[yKey] * 100) + "%";
          return \`<g><circle cx="\${x(profile[xKey])}" cy="\${y(profile[yKey])}" r="7" fill="var(--viz-series-1)" tabindex="0"><title>\${profile.words} palabras: \${Math.round(profile[xKey])} s, \${quality}</title></circle><text x="\${x(profile[xKey]) + dx}" y="\${y(profile[yKey]) - 10}" text-anchor="\${anchor}" fill="var(--foreground)">\${profile.words} palabras</text></g>\`;
        }).join("");
        const r = correlation(values, xKey, yKey);
        correlationLabel.innerHTML = \`Correlación descriptiva: <strong class="tabular-nums">r = \${r.toFixed(2)}</strong> <span class="text-muted">(n = \${values.length})</span>\`;
        timeContainer.setAttribute("aria-label", \`\${timeLabels[xKey]} comparado con \${qualityLabels[yKey]}; correlación \${r.toFixed(2)}\`);
        timeContainer.innerHTML = \`<svg viewBox="0 0 \${width} \${height}" aria-hidden="true"><rect data-chart-frame x="\${margin.left}" y="\${margin.top}" width="\${plotWidth}" height="\${plotHeight}" fill="none" stroke="var(--border)"/>\${xTicks}\${yTicks}\${trend}\${points}<text class="axis-title" data-axis="x" x="\${margin.left + plotWidth / 2}" y="\${height - 10}" text-anchor="middle" fill="var(--foreground)">\${timeLabels[xKey]} (segundos)</text><text class="axis-title" data-axis="y" transform="translate(18 \${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle" fill="var(--foreground)">\${qualityLabels[yKey]}</text></svg>\`;
      };
      draw();
      drawTime();
      const observer = new ResizeObserver(() => { draw(); drawTime(); });
      observer.observe(container);
      observer.observe(timeContainer);
      timeSelect.addEventListener("change", drawTime);
      qualitySelect.addEventListener("change", drawTime);
    })();
  </script>
</div>`;

await writeFile(resolve(args.output), fragment);
console.log(resolve(args.output));

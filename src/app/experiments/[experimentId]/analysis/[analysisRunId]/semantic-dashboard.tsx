"use client";

import {
  Badge,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useState } from "react";
import {
  isTrivialEntityMapping,
  paretoFrontier,
  pearson,
  spearman,
  topOverlap,
} from "./semantic-dashboard-metrics";

type Language = "es" | "en";
type Importance = "backbone" | "supporting" | "detail";
type FactStatus = "preserved" | "partial" | "transformed" | "omitted";

type Fact = {
  id: string;
  localId?: string;
  statement: string;
  importance: Importance;
  frame?: {
    predicate?: { label?: string };
    slots?: Array<{ slotId: string; role?: string; expected?: string }>;
  };
};

type Rubric = {
  language: Language;
  narrativeUnits: Array<{ facts: Fact[] }>;
};

type FactAssessment = {
  factId: string;
  status?: FactStatus;
  predicate?: ComponentAssessment;
  slots?: ComponentAssessment[];
};

type ComponentAssessment = {
  slotId?: string;
  status?: "preserved" | "transformed" | "omitted";
  observedValue?: string | null;
};

type SemanticAssessment = {
  factAssessments?: FactAssessment[];
  entityMappings?: Array<{
    canonicalEntity?: string;
    observedForm?: string;
    relation?: string;
  }>;
};

type RateSummary = {
  total?: number;
  preserved?: number;
  partial?: number;
  transformed?: number;
  omitted?: number;
  presenceRate?: number | null;
  exactRate?: number | null;
};

type SemanticSummary = {
  facts?: RateSummary;
  byImportance?: Partial<Record<Importance, { facts?: RateSummary }>>;
};

export type SemanticDashboardAnalysis = {
  sessionId: string;
  language: Language;
  semanticAssessment: unknown;
  semanticSummary: unknown;
  readingSeconds?: number;
  recallSeconds?: number;
  totalSeconds?: number;
};

type QualityMetric = "backbonePresence" | "backboneExact" | "overallExact";
type TimeMetric = "reading" | "recall" | "total";

const percentage = (value?: number | null) =>
  value == null ? "—" : `${Math.round(value * 100)} %`;

const average = (values: number[]) =>
  values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;

const deriveStatus = (assessment: FactAssessment): FactStatus => {
  if (assessment.status) return assessment.status;
  if (assessment.predicate?.status === "omitted") return "omitted";
  const components = [assessment.predicate, ...(assessment.slots ?? [])];
  if (components.some((component) => component?.status === "transformed")) {
    return "transformed";
  }
  if (components.some((component) => component?.status === "omitted")) {
    return "partial";
  }
  return "preserved";
};

const metricValue = (summary: SemanticSummary, metric: QualityMetric) => {
  if (metric === "backbonePresence") {
    return summary.byImportance?.backbone?.facts?.presenceRate ?? null;
  }
  if (metric === "backboneExact") {
    return summary.byImportance?.backbone?.facts?.exactRate ?? null;
  }
  return summary.facts?.exactRate ?? null;
};

const timeValue = (analysis: SemanticDashboardAnalysis, metric: TimeMetric) =>
  metric === "reading"
    ? analysis.readingSeconds
    : metric === "recall"
      ? analysis.recallSeconds
      : analysis.totalSeconds;

const ScatterPlot = ({
  points,
  emptyLabel,
  frontierLabel,
}: {
  points: Array<{ id: string; x: number; y: number }>;
  emptyLabel: string;
  frontierLabel: string;
}) => {
  if (points.length === 0) {
    return (
      <Stack align="center" justify="center" h={280}>
        <Text c="dimmed">{emptyLabel}</Text>
      </Stack>
    );
  }
  const width = 720;
  const height = 310;
  const margin = { top: 20, right: 24, bottom: 42, left: 50 };
  const maximumX = Math.max(...points.map((point) => point.x), 1);
  const x = (value: number) =>
    margin.left + (value / maximumX) * (width - margin.left - margin.right);
  const y = (value: number) =>
    height - margin.bottom - value * (height - margin.top - margin.bottom);
  const frontier = paretoFrontier(points);
  const frontierIds = new Set(frontier.map((point) => point.id));
  const frontierPath = frontier
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.x)} ${y(point.y)}`,
    )
    .join(" ");

  return (
    <Stack gap="xs">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gráfico de tiempo y calidad"
        style={{ width: "100%", display: "block" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--mantine-color-dark-4)"
              strokeDasharray="4 6"
            />
            <text
              x={margin.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill="var(--mantine-color-dimmed)"
              fontSize="12"
            >
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={height - margin.bottom}
          y2={height - margin.bottom}
          stroke="var(--mantine-color-dark-2)"
        />
        {frontier.length > 1 && (
          <path
            d={frontierPath}
            fill="none"
            stroke="var(--mantine-color-yellow-5)"
            strokeWidth="3"
            strokeDasharray="7 6"
          />
        )}
        {points.map((point) => (
          <g key={point.id}>
            <circle
              cx={x(point.x)}
              cy={y(point.y)}
              r={frontierIds.has(point.id) ? 8 : 7}
              fill={
                frontierIds.has(point.id)
                  ? "var(--mantine-color-yellow-5)"
                  : "var(--mantine-color-teal-5)"
              }
              opacity="0.85"
            >
              <title>{`${Math.round(point.x)} s · ${Math.round(point.y * 100)} %`}</title>
            </circle>
          </g>
        ))}
        <text
          x={(margin.left + width - margin.right) / 2}
          y={height - 10}
          textAnchor="middle"
          fill="var(--mantine-color-dimmed)"
          fontSize="13"
        >
          0–{Math.round(maximumX)} s
        </text>
      </svg>
      <Group gap="xs">
        <span
          aria-hidden
          style={{
            width: 24,
            borderTop: "3px dashed var(--mantine-color-yellow-5)",
          }}
        />
        <Text size="xs" c="dimmed">
          {frontierLabel}
        </Text>
      </Group>
    </Stack>
  );
};

export const SemanticDashboard = ({
  rubrics,
  analyses,
  locale,
}: {
  rubrics: Rubric[];
  analyses: SemanticDashboardAnalysis[];
  locale: Language;
}) => {
  const copy =
    locale === "es"
      ? {
          title: "Memoria semántica",
          description:
            "Qué partes de la historia se conservaron, cuáles cambiaron y cómo se relacionan con los tiempos.",
          backbone: "Estructura principal",
          supporting: "Información de apoyo",
          detail: "Detalles",
          exact: "recuerdo exacto",
          rankings: "Hechos más recordados y más omitidos",
          remembered: "Más recordados",
          omitted: "Más omitidos",
          timeTitle: "Tiempo y calidad del recuerdo",
          timeDescription:
            "Cada punto es una respuesta. La asociación es descriptiva y no implica causalidad.",
          frontier:
            "Frontera observada: mejor resultado alcanzado con ese tiempo o menos.",
          efficiency: "Eficiencia observada",
          efficiencyDescription:
            "La respuesta más rápida que alcanzó al menos 70 % en esta métrica tardó",
          efficiencyUnavailable:
            "Ninguna respuesta alcanzó todavía el umbral descriptivo de 70 %.",
          atypical: "registros con tiempos atípicos excluidos",
          timeReading: "Tiempo de lectura",
          timeRecall: "Tiempo de reconstrucción",
          timeTotal: "Tiempo total",
          qualityBackbonePresence: "Presencia de estructura principal",
          qualityBackboneExact: "Estructura principal exacta",
          qualityOverallExact: "Recuerdo exacto total",
          correlation: "Correlación",
          insufficient: "Se necesitan al menos tres respuestas comparables.",
          noData: "No hay datos para esta combinación.",
          responses: "respuestas",
          languageComparison: "Omisiones entre idiomas",
          languageComparisonDescription:
            "Compara el orden de olvido de los mismos hechos. Es exploratorio: idioma y grupo de participantes están confundidos.",
          rankConcordance: "Concordancia de ranking",
          topOverlap: "Coincidencias en el top 5",
          sharedOmissions: "Omisiones compartidas",
          comparableFacts: "hechos comparables",
          transformations: "Transformaciones recurrentes",
          transformationsDescription:
            "Cambios que aparecieron en al menos dos personas. Cada cambio cuenta como máximo una vez por respuesta y requiere interpretación humana.",
          entityChanges: "Personajes y entidades",
          componentChanges: "Acciones, relaciones y atributos",
          noTransformations:
            "No hay transformaciones recurrentes con este filtro.",
        }
      : {
          title: "Semantic memory",
          description:
            "Which parts of the story survived, which changed, and how they relate to completion times.",
          backbone: "Narrative backbone",
          supporting: "Supporting information",
          detail: "Details",
          exact: "exact recall",
          rankings: "Most remembered and most omitted facts",
          remembered: "Most remembered",
          omitted: "Most omitted",
          timeTitle: "Time and recall quality",
          timeDescription:
            "Each point is one response. The association is descriptive and does not imply causation.",
          frontier:
            "Observed frontier: best result reached with that amount of time or less.",
          efficiency: "Observed efficiency",
          efficiencyDescription:
            "The fastest response that reached at least 70% on this metric took",
          efficiencyUnavailable:
            "No response has reached the descriptive 70% threshold yet.",
          atypical: "records with atypical times excluded",
          timeReading: "Reading time",
          timeRecall: "Recall time",
          timeTotal: "Total time",
          qualityBackbonePresence: "Narrative backbone presence",
          qualityBackboneExact: "Exact narrative backbone",
          qualityOverallExact: "Overall exact recall",
          correlation: "Correlation",
          insufficient: "At least three comparable responses are required.",
          noData: "No data is available for this combination.",
          responses: "responses",
          languageComparison: "Omissions across languages",
          languageComparisonDescription:
            "Compares how the same facts rank by omission. This is exploratory: language and participant group are confounded.",
          rankConcordance: "Rank concordance",
          topOverlap: "Top-5 overlap",
          sharedOmissions: "Shared omissions",
          comparableFacts: "comparable facts",
          transformations: "Recurring transformations",
          transformationsDescription:
            "Changes found in at least two people. Each change counts at most once per response and requires human interpretation.",
          entityChanges: "Characters and entities",
          componentChanges: "Actions, relations, and attributes",
          noTransformations:
            "There are no recurring transformations under this filter.",
        };
  const availableLanguages = rubrics
    .map((rubric) => rubric.language)
    .filter((language) =>
      analyses.some((analysis) => analysis.language === language),
    );
  const [language, setLanguage] = useState<Language>(
    availableLanguages[0] ?? rubrics[0]?.language ?? "es",
  );
  const [timeMetric, setTimeMetric] = useState<TimeMetric>("reading");
  const [qualityMetric, setQualityMetric] =
    useState<QualityMetric>("backbonePresence");
  const rubric = rubrics.find((candidate) => candidate.language === language);
  const languageAnalyses = analyses.filter(
    (analysis) => analysis.language === language,
  );
  const facts = rubric?.narrativeUnits.flatMap((unit) => unit.facts) ?? [];
  const summaries = languageAnalyses.map(
    (analysis) => analysis.semanticSummary as SemanticSummary,
  );
  const importanceCards = (["backbone", "supporting", "detail"] as const).map(
    (importance) => {
      const presence = average(
        summaries.flatMap((summary) => {
          const value = summary.byImportance?.[importance]?.facts?.presenceRate;
          return value == null ? [] : [value];
        }),
      );
      const exact = average(
        summaries.flatMap((summary) => {
          const value = summary.byImportance?.[importance]?.facts?.exactRate;
          return value == null ? [] : [value];
        }),
      );
      return { importance, presence, exact };
    },
  );
  const factStats = facts.map((fact) => {
    const statuses = languageAnalyses.flatMap((analysis) => {
      const assessment = analysis.semanticAssessment as SemanticAssessment;
      const match = assessment.factAssessments?.find(
        (candidate) => candidate.factId === fact.id,
      );
      return match ? [deriveStatus(match)] : [];
    });
    const present = statuses.filter((status) => status !== "omitted").length;
    return {
      ...fact,
      total: statuses.length,
      presenceRate: statuses.length === 0 ? 0 : present / statuses.length,
    };
  });
  const remembered = [...factStats]
    .filter((fact) => fact.total > 0)
    .sort((left, right) => right.presenceRate - left.presenceRate)
    .slice(0, 5);
  const omitted = [...factStats]
    .filter((fact) => fact.total > 0)
    .sort((left, right) => left.presenceRate - right.presenceRate)
    .slice(0, 5);
  const rawPoints = languageAnalyses.flatMap((analysis) => {
    const x = timeValue(analysis, timeMetric);
    const y = metricValue(
      analysis.semanticSummary as SemanticSummary,
      qualityMetric,
    );
    return x == null || y == null ? [] : [{ id: analysis.sessionId, x, y }];
  });
  const maximumTime =
    timeMetric === "reading" ? 600 : timeMetric === "recall" ? 1800 : 2400;
  const minimumTime = timeMetric === "total" ? 10 : 5;
  const points = rawPoints.filter(
    (point) => point.x >= minimumTime && point.x <= maximumTime,
  );
  const excludedPointCount = rawPoints.length - points.length;
  const coefficient = pearson(points);
  const efficientThresholdPoint = paretoFrontier(points).find(
    (point) => point.y >= 0.7,
  );

  const statsForLanguage = (candidateLanguage: Language) => {
    const candidateRubric = rubrics.find(
      (candidate) => candidate.language === candidateLanguage,
    );
    const candidateAnalyses = analyses.filter(
      (analysis) => analysis.language === candidateLanguage,
    );
    return (
      candidateRubric?.narrativeUnits.flatMap((unit) => unit.facts) ?? []
    ).map((fact) => {
      const statuses = candidateAnalyses.flatMap((analysis) => {
        const assessment = analysis.semanticAssessment as SemanticAssessment;
        const match = assessment.factAssessments?.find(
          (candidate) => candidate.factId === fact.id,
        );
        return match ? [deriveStatus(match)] : [];
      });
      const present = statuses.filter((status) => status !== "omitted").length;
      return {
        ...fact,
        total: statuses.length,
        presenceRate: statuses.length === 0 ? 0 : present / statuses.length,
      };
    });
  };
  const spanishStats = statsForLanguage("es");
  const englishStats = statsForLanguage("en");
  const crossLanguagePairs = spanishStats.flatMap((spanishFact) => {
    const englishFact = englishStats.find(
      (candidate) =>
        (candidate.localId ?? candidate.id) ===
        (spanishFact.localId ?? spanishFact.id),
    );
    return englishFact
      ? [{ x: 1 - spanishFact.presenceRate, y: 1 - englishFact.presenceRate }]
      : [];
  });
  const omissionConcordance = spearman(crossLanguagePairs);
  const spanishTopOmissions = [...spanishStats]
    .filter((fact) => fact.total > 0)
    .sort((left, right) => left.presenceRate - right.presenceRate)
    .slice(0, 5);
  const englishTopOmissions = [...englishStats]
    .filter((fact) => fact.total > 0)
    .sort((left, right) => left.presenceRate - right.presenceRate)
    .slice(0, 5);
  const omissionOverlap = topOverlap(spanishTopOmissions, englishTopOmissions);
  const localizedSharedOmissions = omissionOverlap.shared.map((sharedFact) => {
    const localId = sharedFact.localId ?? sharedFact.id;
    return (
      (language === "es" ? spanishTopOmissions : englishTopOmissions).find(
        (candidate) => (candidate.localId ?? candidate.id) === localId,
      ) ?? sharedFact
    );
  });

  type TransformationRow = {
    from: string;
    to: string;
    count: number;
    kind: "entity" | "component";
  };
  const transformationCounts = new Map<string, TransformationRow>();
  const addTransformation = (
    sessionKeys: Set<string>,
    row: Omit<TransformationRow, "count">,
  ) => {
    const key = `${row.kind}|${row.from.toLocaleLowerCase()}|${row.to.toLocaleLowerCase()}`;
    if (sessionKeys.has(key)) return;
    sessionKeys.add(key);
    const current = transformationCounts.get(key) ?? { ...row, count: 0 };
    current.count += 1;
    transformationCounts.set(key, current);
  };

  for (const analysis of languageAnalyses) {
    const assessment = analysis.semanticAssessment as SemanticAssessment;
    const sessionKeys = new Set<string>();
    for (const mapping of assessment.entityMappings ?? []) {
      const from = mapping.canonicalEntity?.trim();
      const to = mapping.observedForm?.trim();
      if (!from || !to || isTrivialEntityMapping(from, to, language)) continue;
      addTransformation(sessionKeys, { from, to, kind: "entity" });
    }
    for (const factAssessment of assessment.factAssessments ?? []) {
      const fact = facts.find(
        (candidate) => candidate.id === factAssessment.factId,
      );
      if (!fact) continue;
      if (
        factAssessment.predicate?.status === "transformed" &&
        factAssessment.predicate.observedValue
      ) {
        addTransformation(sessionKeys, {
          from: fact.frame?.predicate?.label ?? fact.statement,
          to: factAssessment.predicate.observedValue,
          kind: "component",
        });
      }
      for (const slotAssessment of factAssessment.slots ?? []) {
        if (
          slotAssessment.status !== "transformed" ||
          !slotAssessment.observedValue
        ) {
          continue;
        }
        const slot = fact.frame?.slots?.find(
          (candidate) => candidate.slotId === slotAssessment.slotId,
        );
        const from = slot?.expected?.trim();
        if (
          !from ||
          isTrivialEntityMapping(from, slotAssessment.observedValue, language)
        ) {
          continue;
        }
        addTransformation(sessionKeys, {
          from,
          to: slotAssessment.observedValue,
          kind: "component",
        });
      }
    }
  }
  const transformations = [...transformationCounts.values()]
    .filter((row) => row.count >= 2)
    .sort((left, right) => right.count - left.count);

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{copy.title}</Title>
          <Text c="dimmed">{copy.description}</Text>
        </div>
        {availableLanguages.length > 1 && (
          <SegmentedControl
            value={language}
            onChange={(value) => setLanguage(value as Language)}
            data={availableLanguages.map((value) => ({
              value,
              label: value === "es" ? "🇪🇸 Español" : "🇺🇸 English",
            }))}
          />
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {importanceCards.map((card) => (
          <Card key={card.importance} withBorder padding="lg">
            <Stack gap="xs">
              <Text c="dimmed" size="sm">
                {card.importance === "backbone"
                  ? copy.backbone
                  : card.importance === "supporting"
                    ? copy.supporting
                    : copy.detail}
              </Text>
              <Text size="xl" fw={700}>
                {percentage(card.presence)}
              </Text>
              <Progress value={(card.presence ?? 0) * 100} color="teal" />
              <Text size="sm" c="dimmed">
                {percentage(card.exact)} {copy.exact}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder padding="lg">
        <Stack gap="lg">
          <div>
            <Title order={3}>{copy.rankings}</Title>
            <Text c="dimmed" size="sm">
              {languageAnalyses.length} {copy.responses}
            </Text>
          </div>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {[
              { title: copy.remembered, rows: remembered, color: "teal" },
              { title: copy.omitted, rows: omitted, color: "red" },
            ].map((ranking) => (
              <Stack key={ranking.title} gap="sm">
                <Title order={4}>{ranking.title}</Title>
                <Table>
                  <Table.Tbody>
                    {ranking.rows.map((fact) => (
                      <Table.Tr key={fact.id}>
                        <Table.Td>
                          <Text size="sm">{fact.statement}</Text>
                        </Table.Td>
                        <Table.Td w={84} ta="right">
                          <Badge variant="light" color={ranking.color}>
                            {percentage(fact.presenceRate)}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      </Card>

      {spanishStats.length > 0 && englishStats.length > 0 && (
        <Card withBorder padding="lg">
          <Stack gap="lg">
            <div>
              <Title order={3}>{copy.languageComparison}</Title>
              <Text c="dimmed">{copy.languageComparisonDescription}</Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <div>
                <Text size="sm" c="dimmed">
                  {copy.rankConcordance}
                </Text>
                <Text size="xl" fw={700}>
                  {omissionConcordance == null
                    ? "—"
                    : `ρ = ${omissionConcordance.toFixed(2)}`}
                </Text>
                <Text size="xs" c="dimmed">
                  {crossLanguagePairs.length} {copy.comparableFacts}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  {copy.topOverlap}
                </Text>
                <Text size="xl" fw={700}>
                  {omissionOverlap.count}/5
                </Text>
                <Text size="xs" c="dimmed">
                  Jaccard {percentage(omissionOverlap.jaccard)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  {copy.sharedOmissions}
                </Text>
                <Stack gap={4} mt={4}>
                  {localizedSharedOmissions.map((fact) => (
                    <Text key={fact.id} size="sm">
                      • {fact.statement}
                    </Text>
                  ))}
                </Stack>
              </div>
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      <Card withBorder padding="lg">
        <Stack gap="lg">
          <div>
            <Title order={3}>{copy.transformations}</Title>
            <Text c="dimmed">{copy.transformationsDescription}</Text>
          </div>
          {transformations.length === 0 ? (
            <Text c="dimmed">{copy.noTransformations}</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {[
                {
                  kind: "entity" as const,
                  title: copy.entityChanges,
                  color: "violet",
                },
                {
                  kind: "component" as const,
                  title: copy.componentChanges,
                  color: "orange",
                },
              ].map((section) => {
                const rows = transformations
                  .filter((row) => row.kind === section.kind)
                  .slice(0, 8);
                return (
                  <Stack key={section.kind} gap="sm">
                    <Title order={4}>{section.title}</Title>
                    {rows.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        {copy.noTransformations}
                      </Text>
                    ) : (
                      <Table>
                        <Table.Tbody>
                          {rows.map((row) => (
                            <Table.Tr key={`${row.from}|${row.to}`}>
                              <Table.Td>
                                <Text size="sm">
                                  <Text component="span" fw={600}>
                                    {row.from}
                                  </Text>{" "}
                                  → {row.to}
                                </Text>
                              </Table.Td>
                              <Table.Td w={112} ta="right">
                                <Badge variant="light" color={section.color}>
                                  {row.count} ·{" "}
                                  {percentage(
                                    row.count / languageAnalyses.length,
                                  )}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Stack>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Stack gap="lg">
          <div>
            <Title order={3}>{copy.timeTitle}</Title>
            <Text c="dimmed">{copy.timeDescription}</Text>
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              value={timeMetric}
              onChange={(value) =>
                setTimeMetric((value ?? "reading") as TimeMetric)
              }
              data={[
                { value: "reading", label: copy.timeReading },
                { value: "recall", label: copy.timeRecall },
                { value: "total", label: copy.timeTotal },
              ]}
            />
            <Select
              value={qualityMetric}
              onChange={(value) =>
                setQualityMetric((value ?? "backbonePresence") as QualityMetric)
              }
              data={[
                {
                  value: "backbonePresence",
                  label: copy.qualityBackbonePresence,
                },
                { value: "backboneExact", label: copy.qualityBackboneExact },
                { value: "overallExact", label: copy.qualityOverallExact },
              ]}
            />
          </SimpleGrid>
          <ScatterPlot
            points={points}
            emptyLabel={copy.noData}
            frontierLabel={copy.frontier}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder padding="md">
              <Text size="sm" c="dimmed">
                {copy.efficiency}
              </Text>
              {efficientThresholdPoint ? (
                <>
                  <Text fw={700} size="xl">
                    {Math.round(efficientThresholdPoint.x)} s
                  </Text>
                  <Text size="sm" c="dimmed">
                    {copy.efficiencyDescription}{" "}
                    {Math.round(efficientThresholdPoint.x)} s.
                  </Text>
                </>
              ) : (
                <Text size="sm" c="dimmed" mt="xs">
                  {copy.efficiencyUnavailable}
                </Text>
              )}
            </Card>
            <Card withBorder padding="md">
              <Text size="sm" c="dimmed">
                {copy.correlation}
              </Text>
              <Text fw={700} size="xl">
                {coefficient == null ? "—" : `r = ${coefficient.toFixed(2)}`}
              </Text>
              <Text size="sm" c="dimmed">
                n = {points.length}
                {excludedPointCount > 0
                  ? ` · ${excludedPointCount} ${copy.atypical}`
                  : ""}
              </Text>
            </Card>
          </SimpleGrid>
          {coefficient == null && (
            <Text size="sm" c="dimmed">
              {copy.insufficient}
            </Text>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

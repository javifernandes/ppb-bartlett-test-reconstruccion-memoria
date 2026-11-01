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

type Language = "es" | "en";
type Importance = "backbone" | "supporting" | "detail";
type FactStatus = "preserved" | "partial" | "transformed" | "omitted";

type Fact = {
  id: string;
  statement: string;
  importance: Importance;
};

type Rubric = {
  language: Language;
  narrativeUnits: Array<{ facts: Fact[] }>;
};

type FactAssessment = {
  factId: string;
  status?: FactStatus;
  predicate?: { status?: "preserved" | "transformed" | "omitted" };
  slots?: Array<{ status?: "preserved" | "transformed" | "omitted" }>;
};

type SemanticAssessment = {
  factAssessments?: FactAssessment[];
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

const correlation = (points: Array<{ x: number; y: number }>) => {
  if (points.length < 3) return null;
  const meanX = average(points.map((point) => point.x)) ?? 0;
  const meanY = average(points.map((point) => point.y)) ?? 0;
  const numerator = points.reduce(
    (total, point) => total + (point.x - meanX) * (point.y - meanY),
    0,
  );
  const denominator = Math.sqrt(
    points.reduce((total, point) => total + (point.x - meanX) ** 2, 0) *
      points.reduce((total, point) => total + (point.y - meanY) ** 2, 0),
  );
  return denominator === 0 ? null : numerator / denominator;
};

const ScatterPlot = ({
  points,
  emptyLabel,
}: {
  points: Array<{ id: string; x: number; y: number }>;
  emptyLabel: string;
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

  return (
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
      {points.map((point) => (
        <g key={point.id}>
          <circle
            cx={x(point.x)}
            cy={y(point.y)}
            r="7"
            fill="var(--mantine-color-teal-5)"
            opacity="0.8"
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
  const points = languageAnalyses.flatMap((analysis) => {
    const x = timeValue(analysis, timeMetric);
    const y = metricValue(
      analysis.semanticSummary as SemanticSummary,
      qualityMetric,
    );
    return x == null || y == null ? [] : [{ id: analysis.sessionId, x, y }];
  });
  const coefficient = correlation(points);

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
          <ScatterPlot points={points} emptyLabel={copy.noData} />
          <Text size="sm" c="dimmed">
            {coefficient == null
              ? copy.insufficient
              : `${copy.correlation}: r = ${coefficient.toFixed(2)} · n = ${points.length}`}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
};

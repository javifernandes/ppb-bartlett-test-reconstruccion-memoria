"use client";

import {
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";

import { LanguageSelector, useI18n } from "@/app/i18n";
import { SemanticDashboard } from "@/app/experiments/[experimentId]/analysis/[analysisRunId]/semantic-dashboard";
import type { SemanticDashboardAnalysis } from "@/app/experiments/[experimentId]/analysis/[analysisRunId]/semantic-dashboard";
import {
  AnalysisRun,
  Experiment,
  ExperimentResultShare,
  ParticipantSession,
  RecallAnalysis,
} from "@/generated/client-entities";

const PublicExperimentShare = ExperimentResultShare.view(
  "PublicExperimentShare",
  { id: true, experiment: true, run: true, status: true, createdAt: true },
);
const PublicExperiment = Experiment.view("PublicResultsExperiment", {
  id: true,
  title: true,
  story: true,
  primaryLanguage: true,
  alternateLanguage: true,
  alternateStory: true,
});
const PublicRun = AnalysisRun.view("PublicResultsRun", {
  id: true,
  schemaVersion: true,
  rubricSnapshot: true,
  createdAt: true,
});
const PublicResponse = ParticipantSession.view("PublicResultsResponse", {
  id: true,
  contentLanguage: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  submittedAt: true,
  recallText: true,
  status: true,
});
const PublicAnalysis = RecallAnalysis.view("PublicResultsAnalysis", {
  id: true,
  run: true,
  session: true,
  phenomena: true,
  semanticAssessment: true,
  semanticSummary: true,
});

type Phenomenon = {
  kind: string;
  storyExcerpt: string | null;
  recallExcerpt: string | null;
  explanation: string;
  confidence: number;
};

const phenomenonNames: Record<string, string> = {
  retained: "Unidad retenida",
  omission: "Omisión candidata",
  intrusion: "Intrusión candidata",
  substitution: "Sustitución candidata",
  rationalization: "Racionalización posible",
  accentuation: "Acentuación posible",
};
const phenomenonColors: Record<string, string> = {
  retained: "green",
  omission: "red",
  intrusion: "grape",
  substitution: "orange",
  rationalization: "blue",
  accentuation: "teal",
};
const phenomenonBackgrounds: Record<string, string> = {
  retained: "rgba(64, 192, 87, 0.22)",
  omission: "rgba(250, 82, 82, 0.22)",
  intrusion: "rgba(190, 75, 219, 0.22)",
  substitution: "rgba(253, 126, 20, 0.24)",
  rationalization: "rgba(34, 139, 230, 0.22)",
  accentuation: "rgba(18, 184, 134, 0.22)",
};

const readPhenomena = (value: unknown): Phenomenon[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Phenomenon =>
          typeof item === "object" &&
          item !== null &&
          "kind" in item &&
          "explanation" in item,
      )
    : [];
const countWords = (value: string) =>
  value.trim().match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
const secondsBetween = (from?: string | null, to?: string | null) =>
  from && to
    ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
    : undefined;
const formatSeconds = (value?: number) => {
  if (value === undefined) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes ? `${minutes} min ${seconds} s` : `${seconds} s`;
};

const AnnotatedText = ({
  text,
  phenomena,
  side,
  selected,
  onSelect,
}: {
  text: string;
  phenomena: Phenomenon[];
  side: "story" | "recall";
  selected: number[];
  onSelect: (indices: number[]) => void;
}) => {
  const candidates = phenomena
    .map((phenomenon, index) => {
      const excerpt =
        side === "story" ? phenomenon.storyExcerpt : phenomenon.recallExcerpt;
      const start = excerpt ? text.indexOf(excerpt) : -1;
      return excerpt && start >= 0
        ? { phenomenon, index, start, end: start + excerpt.length }
        : null;
    })
    .filter((candidate) => candidate !== null)
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...candidates.flatMap((candidate) => [candidate.start, candidate.end]),
    ]),
  ].sort((left, right) => left - right);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const fragment = text.slice(start, end);
    const active = candidates.filter(
      (candidate) => candidate.start <= start && candidate.end >= end,
    );
    if (!active.length)
      return <span key={`plain-${side}-${start}`}>{fragment}</span>;
    const indices = active.map((candidate) => candidate.index);
    const colors = active.map(
      ({ phenomenon }) =>
        phenomenonBackgrounds[phenomenon.kind] ?? "rgba(134, 142, 150, 0.22)",
    );
    return (
      <Box
        component="button"
        type="button"
        key={`${side}-${start}`}
        onClick={() => onSelect(indices)}
        style={{
          display: "inline",
          padding: "1px 2px",
          margin: "0 1px",
          color: "inherit",
          font: "inherit",
          lineHeight: "inherit",
          textAlign: "inherit",
          cursor: "pointer",
          border: 0,
          borderBottom: `2px solid var(--mantine-color-${phenomenonColors[active[0].phenomenon.kind] ?? "gray"}-6)`,
          borderRadius: 3,
          background:
            colors.length === 1
              ? colors[0]
              : `linear-gradient(135deg, ${colors.join(", ")})`,
          outline: indices.some((value) => selected.includes(value))
            ? "2px solid var(--mantine-color-gray-3)"
            : "none",
          outlineOffset: 2,
        }}
      >
        {fragment}
      </Box>
    );
  });
};

const PublicResultsPage = () => {
  const { locale, t } = useI18n();
  const { shareToken } = useParams<{ shareToken: string }>();
  const selectedResponseNumber = Number(useSearchParams().get("response"));
  const [selectedPhenomena, setSelectedPhenomena] = useState<number[]>([]);
  const share = useGraphQuery(
    ExperimentResultShare.all()
      .where((candidate) => candidate.id.eq(shareToken))
      .as(PublicExperimentShare)
      .one(),
  );
  const experimentId = share.data?.experiment.locator.id;
  const runId = share.data?.run.locator.id;
  const experiment = useGraphQuery(
    Experiment.all()
      .where((candidate) => candidate.id.eq(String(experimentId ?? "")))
      .as(PublicExperiment)
      .one(),
    { enabled: Boolean(experimentId) },
  );
  const run = useGraphQuery(
    AnalysisRun.all()
      .where((candidate) => candidate.id.eq(String(runId ?? "")))
      .as(PublicRun)
      .one(),
    { enabled: Boolean(runId) },
  );
  const responses = useGraphQuery(
    ParticipantSession.all()
      .where((session) =>
        session.experiment.eq(Experiment.refById(String(experimentId ?? ""))),
      )
      .where((session) => session.status.eq("submitted"))
      .as(PublicResponse)
      .orderBy((session) => session.submittedAt.asc()),
    { enabled: Boolean(experimentId) },
  );
  const analyses = useGraphQuery(
    RecallAnalysis.all()
      .where((analysis) =>
        analysis.run.eq(AnalysisRun.refById(String(runId ?? ""))),
      )
      .as(PublicAnalysis),
    { enabled: Boolean(runId) },
  );
  const analysisBySession = useMemo(
    () =>
      new Map(
        (analyses.data ?? []).map((analysis) => [
          String(analysis.session.locator.id),
          analysis,
        ]),
      ),
    [analyses.data],
  );
  const metrics = (responses.data ?? []).map((response) => ({
    ...response,
    wordCount: countWords(response.recallText ?? ""),
    readingSeconds: secondsBetween(
      response.startedAt,
      response.intervalStartedAt ?? response.recallingStartedAt,
    ),
    recallSeconds: secondsBetween(
      response.recallingStartedAt,
      response.submittedAt,
    ),
    totalSeconds: secondsBetween(response.startedAt, response.submittedAt),
    analysis: analysisBySession.get(response.id),
  }));
  const semanticAnalyses = metrics.flatMap((response) =>
    response.analysis?.semanticAssessment && response.analysis.semanticSummary
      ? [
          {
            sessionId: response.id,
            language: response.contentLanguage,
            semanticAssessment: response.analysis.semanticAssessment,
            semanticSummary: response.analysis.semanticSummary,
            readingSeconds: response.readingSeconds,
            recallSeconds: response.recallSeconds,
            totalSeconds: response.totalSeconds,
          } satisfies SemanticDashboardAnalysis,
        ]
      : [],
  );
  const selectedResponse =
    Number.isInteger(selectedResponseNumber) && selectedResponseNumber > 0
      ? metrics[selectedResponseNumber - 1]
      : undefined;
  const phenomena = readPhenomena(selectedResponse?.analysis?.phenomena);
  const selectedDetails = selectedPhenomena.flatMap((index) =>
    phenomena[index] ? [phenomena[index]] : [],
  );
  const story = selectedResponse
    ? selectedResponse.contentLanguage === experiment.data?.alternateLanguage &&
      experiment.data.alternateStory
      ? experiment.data.alternateStory
      : (experiment.data?.story ?? "")
    : "";
  const loading =
    share.isLoading ||
    experiment.isLoading ||
    run.isLoading ||
    responses.isLoading ||
    analyses.isLoading;

  if (loading)
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  if (
    share.isError ||
    experiment.isError ||
    run.isError ||
    responses.isError ||
    analyses.isError ||
    !share.data ||
    share.data.status !== "active" ||
    !experiment.data ||
    !run.data
  ) {
    return (
      <Center mih="100dvh" p="md">
        <Paper withBorder p="lg" maw={560} w="100%">
          <Title order={2}>{t("Estos resultados no están disponibles")}</Title>
          <Text c="dimmed" mt="sm">
            {t("El enlace puede haber sido desactivado o ser incorrecto.")}
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>{experiment.data.title}</Text>
          <LanguageSelector compact />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" py="xl">
          {selectedResponse ? (
            <Stack gap="xl">
              <Group justify="space-between">
                <div>
                  <Title order={1}>{t("Respuesta individual")}</Title>
                  <Text c="dimmed">
                    {t("Comparación anónima con la historia original.")}
                  </Text>
                </div>
                <Button
                  component={Link}
                  href={`/results/${shareToken}`}
                  variant="default"
                  leftSection={<IconArrowLeft size={17} />}
                >
                  {t("Volver a resultados")}
                </Button>
              </Group>
              <SimpleGrid cols={{ base: 1, lg: 3 }}>
                <Paper withBorder p="lg">
                  <Text size="sm" c="dimmed" fw={600} mb="md">
                    {t("Historia original")} · {countWords(story)}{" "}
                    {t("palabras")}
                  </Text>
                  <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                    <AnnotatedText
                      text={story}
                      phenomena={phenomena}
                      side="story"
                      selected={selectedPhenomena}
                      onSelect={setSelectedPhenomena}
                    />
                  </Text>
                </Paper>
                <Paper withBorder p="lg">
                  <Text size="sm" c="dimmed" fw={600} mb="md">
                    {t("Reconstrucción")} · {selectedResponse.wordCount}{" "}
                    {t("palabras")}
                  </Text>
                  <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                    <AnnotatedText
                      text={selectedResponse.recallText ?? ""}
                      phenomena={phenomena}
                      side="recall"
                      selected={selectedPhenomena}
                      onSelect={setSelectedPhenomena}
                    />
                  </Text>
                </Paper>
                <Paper withBorder p="lg" style={{ alignSelf: "start" }}>
                  <Title order={3}>{t("Detalle del fragmento")}</Title>
                  <Text size="sm" c="dimmed" mb="md">
                    {selectedDetails.length
                      ? t("Interpretaciones de la marca seleccionada.")
                      : t(
                          "Seleccioná una marca en los textos para inspeccionarla.",
                        )}
                  </Text>
                  <Stack gap="sm">
                    {selectedDetails.map((phenomenon, index) => (
                      <Paper
                        key={`${phenomenon.kind}-${index}`}
                        withBorder
                        p="sm"
                        style={{
                          background:
                            phenomenonBackgrounds[phenomenon.kind] ??
                            "rgba(134, 142, 150, 0.22)",
                        }}
                      >
                        <Badge
                          color={phenomenonColors[phenomenon.kind] ?? "gray"}
                        >
                          {t(
                            phenomenonNames[phenomenon.kind] ?? phenomenon.kind,
                          )}
                        </Badge>
                        <Text mt="sm">{phenomenon.explanation}</Text>
                        <Text size="xs" c="dimmed" mt="xs">
                          {t("Confianza")}{" "}
                          {Math.round(phenomenon.confidence * 100)} %
                        </Text>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              </SimpleGrid>
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Lectura")}
                  </Text>
                  <Text fw={700}>
                    {formatSeconds(selectedResponse.readingSeconds)}
                  </Text>
                </Card>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Distractor")}
                  </Text>
                  <Text fw={700}>
                    {formatSeconds(
                      secondsBetween(
                        selectedResponse.intervalStartedAt,
                        selectedResponse.recallingStartedAt,
                      ),
                    )}
                  </Text>
                </Card>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Reconstrucción")}
                  </Text>
                  <Text fw={700}>
                    {formatSeconds(selectedResponse.recallSeconds)}
                  </Text>
                </Card>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Total")}
                  </Text>
                  <Text fw={700}>
                    {formatSeconds(selectedResponse.totalSeconds)}
                  </Text>
                </Card>
              </SimpleGrid>
            </Stack>
          ) : (
            <Stack gap="xl">
              <div>
                <Group gap="sm" mb="xs">
                  <Title order={1}>{t("Resultados del experimento")}</Title>
                  <Badge variant="light">
                    {metrics.length} {t("respuestas")}
                  </Badge>
                </Group>
                <Text c="dimmed">
                  {t(
                    "Vista anónima de sólo lectura con estadísticas agregadas y respuestas individuales.",
                  )}
                </Text>
              </div>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Respuestas")}
                  </Text>
                  <Text size="xl" fw={700}>
                    {metrics.length}
                  </Text>
                </Card>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Español")}
                  </Text>
                  <Text size="xl" fw={700}>
                    {
                      metrics.filter((item) => item.contentLanguage === "es")
                        .length
                    }
                  </Text>
                </Card>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    {t("Inglés")}
                  </Text>
                  <Text size="xl" fw={700}>
                    {
                      metrics.filter((item) => item.contentLanguage === "en")
                        .length
                    }
                  </Text>
                </Card>
              </SimpleGrid>
              {run.data.schemaVersion === "semantic-frames-v3.1" && (
                <SemanticDashboard
                  rubrics={
                    run.data.rubricSnapshot as ComponentProps<
                      typeof SemanticDashboard
                    >["rubrics"]
                  }
                  analyses={semanticAnalyses}
                  locale={locale}
                />
              )}
              <Card withBorder padding="lg">
                <Title order={2} mb="xs">
                  {t("Respuestas individuales")}
                </Title>
                <Text c="dimmed" mb="md">
                  {t(
                    "Abrí una respuesta para explorar la comparación y sus marcas semánticas.",
                  )}
                </Text>
                <Table.ScrollContainer minWidth={700}>
                  <Table verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("Respuesta")}</Table.Th>
                        <Table.Th>{t("Idioma")}</Table.Th>
                        <Table.Th>{t("Palabras")}</Table.Th>
                        <Table.Th>{t("Lectura")}</Table.Th>
                        <Table.Th>{t("Reconstrucción")}</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {metrics.map((response, index) => (
                        <Table.Tr key={response.id}>
                          <Table.Td>
                            {t("Respuesta")} {index + 1}
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light">
                              {response.contentLanguage.toUpperCase()}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{response.wordCount}</Table.Td>
                          <Table.Td>
                            {formatSeconds(response.readingSeconds)}
                          </Table.Td>
                          <Table.Td>
                            {formatSeconds(response.recallSeconds)}
                          </Table.Td>
                          <Table.Td ta="right">
                            <Button
                              component={Link}
                              href={`/results/${shareToken}?response=${index + 1}`}
                              variant="subtle"
                              size="compact-sm"
                            >
                              {t("Ver detalle")}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            </Stack>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default PublicResultsPage;

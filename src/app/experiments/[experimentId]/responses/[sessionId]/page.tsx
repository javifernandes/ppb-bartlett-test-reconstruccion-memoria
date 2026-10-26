"use client";

import {
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import { IconChevronDown, IconSparkles } from "@tabler/icons-react";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
} from "@/generated/client-entities";
import { AdminHeader } from "@/app/admin-header";
import { useI18n } from "@/app/i18n";

const ResponseExperiment = Experiment.view("ResponseExperiment", {
  id: true,
  title: true,
  story: true,
  alternateLanguage: true,
  alternateStory: true,
});

const ResponseDetail = ParticipantSession.view("ResponseDetail", {
  id: true,
  experiment: true,
  contentLanguage: true,
  status: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  lastActivityAt: true,
  recallText: true,
  submittedAt: true,
  countryCode: true,
  browserLocale: true,
  timezone: true,
  deviceType: true,
  browser: true,
  operatingSystem: true,
  screenWidth: true,
  screenHeight: true,
});

const ResponseAnalysis = RecallAnalysis.view("ResponseAnalysis", {
  id: true,
  session: true,
  rubricVersion: true,
  retainedUnitsCount: true,
  omittedUnitsCount: true,
  intrusionCount: true,
  phenomena: true,
  createdAt: true,
});

type DisplayPhenomenon = {
  kind:
    | "retained"
    | "omission"
    | "intrusion"
    | "substitution"
    | "rationalization"
    | "accentuation";
  storyExcerpt: string | null;
  recallExcerpt: string | null;
  explanation: string;
  confidence: number;
};

const phenomenonLabels: Record<DisplayPhenomenon["kind"], string> = {
  retained: "Unidad retenida",
  omission: "Omisión candidata",
  intrusion: "Intrusión candidata",
  substitution: "Sustitución candidata",
  rationalization: "Racionalización posible",
  accentuation: "Acentuación posible",
};

const phenomenonColors: Record<DisplayPhenomenon["kind"], string> = {
  retained: "green",
  omission: "red",
  intrusion: "grape",
  substitution: "orange",
  rationalization: "blue",
  accentuation: "teal",
};

const phenomenonBackgrounds: Record<DisplayPhenomenon["kind"], string> = {
  retained: "rgba(64, 192, 87, 0.22)",
  omission: "rgba(250, 82, 82, 0.22)",
  intrusion: "rgba(190, 75, 219, 0.22)",
  substitution: "rgba(253, 126, 20, 0.24)",
  rationalization: "rgba(34, 139, 230, 0.22)",
  accentuation: "rgba(18, 184, 134, 0.22)",
};

const readPhenomena = (value: unknown): DisplayPhenomenon[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is DisplayPhenomenon =>
          typeof item === "object" &&
          item !== null &&
          "kind" in item &&
          "explanation" in item &&
          "confidence" in item,
      )
    : [];

const statusDetails = {
  reading: { label: "Leyendo", color: "blue" },
  interval: { label: "En intervalo", color: "yellow" },
  recalling: { label: "Reconstruyendo", color: "grape" },
  submitted: { label: "Completada", color: "teal" },
} as const;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-AR") : "—";

const durationBetween = (from?: string | null, to?: string | null) => {
  if (!from || !to) return "—";
  const totalSeconds = Math.max(
    0,
    Math.round((Date.parse(to) - Date.parse(from)) / 1000),
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
};

const secondsBetween = (from?: string | null, to?: string | null) =>
  from && to
    ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
    : 0;

const countWords = (value: string) =>
  value.trim().match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

const deviceLabels = {
  mobile: "Móvil",
  tablet: "Tablet",
  desktop: "Escritorio",
} as const;

const AnnotatedText = ({
  text,
  phenomena,
  side,
  selectedIndices,
  onSelect,
}: {
  text: string;
  phenomena: DisplayPhenomenon[];
  side: "story" | "recall";
  selectedIndices: number[];
  onSelect: (indices: number[]) => void;
}) => {
  const candidates = phenomena
    .map((phenomenon, index) => {
      const excerpt =
        side === "story" ? phenomenon.storyExcerpt : phenomenon.recallExcerpt;
      const start = excerpt ? text.indexOf(excerpt) : -1;
      return excerpt && start >= 0
        ? { phenomenon, index, excerpt, start, end: start + excerpt.length }
        : null;
    })
    .filter((candidate) => candidate !== null)
    .sort((left, right) => left.start - right.start || right.end - left.end);

  if (candidates.length === 0) return text;

  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...candidates.flatMap((candidate) => [candidate.start, candidate.end]),
    ]),
  ].sort((left, right) => left - right);

  return boundaries.slice(0, -1).map((start, boundaryIndex) => {
    const end = boundaries[boundaryIndex + 1];
    const fragment = text.slice(start, end);
    const active = candidates.filter(
      (candidate) => candidate.start <= start && candidate.end >= end,
    );
    if (active.length === 0) {
      return <span key={`${side}-plain-${start}`}>{fragment}</span>;
    }
    const indices = active.map((candidate) => candidate.index);
    const isSelected =
      indices.length === selectedIndices.length &&
      indices.every((index) => selectedIndices.includes(index));
    const colors = active.map(
      (candidate) => phenomenonBackgrounds[candidate.phenomenon.kind],
    );
    const background =
      colors.length === 1
        ? colors[0]
        : `linear-gradient(135deg, ${colors
            .map(
              (color, index) =>
                `${color} ${(index / colors.length) * 100}% ${((index + 1) / colors.length) * 100}%`,
            )
            .join(", ")})`;

    return (
      <Box
        component="button"
        type="button"
        key={`${side}-${start}-${end}`}
        onClick={() => onSelect(indices)}
        aria-label={active
          .map((candidate) => phenomenonLabels[candidate.phenomenon.kind])
          .join(", ")}
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
          borderBottom: `2px solid var(--mantine-color-${phenomenonColors[active[0].phenomenon.kind]}-6)`,
          borderRadius: 3,
          background,
          outline: isSelected
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

const ResponseDetailPage = () => {
  const { t } = useI18n();
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [selectedPhenomena, setSelectedPhenomena] = useState<number[]>([]);
  const { experimentId, sessionId } = useParams<{
    experimentId: string;
    sessionId: string;
  }>();
  const requestedRunId = useSearchParams().get("analysisRunId");
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.id.eq(experimentId))
        .as(ResponseExperiment)
        .one(),
    [experimentId],
  );
  const responseQuery = useMemo(
    () =>
      ParticipantSession.all()
        .where((session) => session.id.eq(sessionId))
        .as(ResponseDetail)
        .one(),
    [sessionId],
  );
  const experiment = useGraphQuery(experimentQuery);
  const response = useGraphQuery(responseQuery);
  const analysisQuery = useMemo(() => {
    let query = RecallAnalysis.all().where((analysis) =>
      analysis.session.eq(ParticipantSession.refById(sessionId)),
    );
    if (requestedRunId) {
      query = query.where((analysis) =>
        analysis.run.eq(AnalysisRun.refById(requestedRunId)),
      );
    }
    return query
      .as(ResponseAnalysis)
      .orderBy((analysis) => analysis.createdAt.desc())
      .first();
  }, [requestedRunId, sessionId]);
  const analysis = useGraphQuery(analysisQuery);
  const belongsToExperiment =
    response.data?.experiment.locator.id === experimentId;
  const sourceStory =
    response.data?.contentLanguage === experiment.data?.alternateLanguage &&
    experiment.data?.alternateStory
      ? experiment.data.alternateStory
      : (experiment.data?.story ?? "");
  const phenomena = useMemo(
    () => readPhenomena(analysis.data?.phenomena),
    [analysis.data?.phenomena],
  );
  const selected = selectedPhenomena.flatMap((index) =>
    phenomena[index] ? [phenomena[index]] : [],
  );
  const readingSeconds = secondsBetween(
    response.data?.startedAt,
    response.data?.intervalStartedAt ?? response.data?.recallingStartedAt,
  );
  const intervalSeconds = secondsBetween(
    response.data?.intervalStartedAt,
    response.data?.recallingStartedAt,
  );
  const recallingSeconds = secondsBetween(
    response.data?.recallingStartedAt,
    response.data?.submittedAt ?? response.data?.lastActivityAt,
  );
  const measuredSeconds = Math.max(
    1,
    readingSeconds + intervalSeconds + recallingSeconds,
  );

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AdminHeader
        section={
          experiment.data
            ? `${experiment.data.title} · ${t("Respuesta")}`
            : t("Respuesta individual")
        }
        backHref={
          requestedRunId
            ? `/experiments/${experimentId}/analysis/${requestedRunId}`
            : `/experiments/${experimentId}`
        }
      />

      <AppShell.Main>
        <Container size="xl" py="xl">
          <Stack gap="xl">
            {(experiment.isLoading ||
              response.isLoading ||
              analysis.isLoading) && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {(experiment.isError || response.isError || !belongsToExperiment) &&
              !experiment.isLoading &&
              !response.isLoading && (
                <Card withBorder>
                  <Title order={2}>
                    {t("No se encontró la participación")}
                  </Title>
                  <Text c="dimmed" mt="xs">
                    {t("Revisá que el enlace corresponda a este experimento.")}
                  </Text>
                </Card>
              )}

            {experiment.data && response.data && belongsToExperiment && (
              <>
                <div>
                  <Text c="dimmed" size="sm">
                    {experiment.data.title}
                  </Text>
                  <Group justify="space-between" align="flex-start" mt={4}>
                    <div>
                      <Title order={1}>{t("Respuesta individual")}</Title>
                      <Text c="dimmed" ff="monospace" size="sm">
                        {response.data.id}
                      </Text>
                    </div>
                    <Badge
                      size="lg"
                      variant="light"
                      color={statusDetails[response.data.status].color}
                    >
                      {t(statusDetails[response.data.status].label)}
                    </Badge>
                  </Group>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Tiempo total")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {durationBetween(
                        response.data.startedAt,
                        response.data.submittedAt ??
                          response.data.lastActivityAt,
                      )}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Lectura")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {durationBetween(
                        response.data.startedAt,
                        response.data.intervalStartedAt ??
                          response.data.recallingStartedAt,
                      )}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Reconstrucción")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {durationBetween(
                        response.data.recallingStartedAt,
                        response.data.submittedAt ??
                          response.data.lastActivityAt,
                      )}
                    </Text>
                  </Card>
                </SimpleGrid>

                <Card withBorder padding="md">
                  <Group justify="space-between" align="flex-end" mb="sm">
                    <div>
                      <Text fw={600}>{t("Recorrido")}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(response.data.startedAt)} →{" "}
                        {formatDate(response.data.submittedAt)}
                      </Text>
                    </div>
                    <Group gap="md" visibleFrom="sm">
                      <Text size="xs" c="dimmed">
                        {t("Lectura")}{" "}
                        {durationBetween(
                          response.data.startedAt,
                          response.data.intervalStartedAt ??
                            response.data.recallingStartedAt,
                        )}
                      </Text>
                      {intervalSeconds > 0 && (
                        <Text size="xs" c="dimmed">
                          {t("Intervalo")}{" "}
                          {durationBetween(
                            response.data.intervalStartedAt,
                            response.data.recallingStartedAt,
                          )}
                        </Text>
                      )}
                      <Text size="xs" c="dimmed">
                        {t("Reconstrucción")}{" "}
                        {durationBetween(
                          response.data.recallingStartedAt,
                          response.data.submittedAt ??
                            response.data.lastActivityAt,
                        )}
                      </Text>
                    </Group>
                  </Group>
                  <Group gap={3} wrap="nowrap" h={10}>
                    <Tooltip
                      label={`${t("Lectura")}: ${readingSeconds} s`}
                      withArrow
                    >
                      <Box
                        bg="blue.6"
                        h="100%"
                        style={{
                          width: `${Math.max(2, (readingSeconds / measuredSeconds) * 100)}%`,
                          borderRadius: 99,
                        }}
                      />
                    </Tooltip>
                    {intervalSeconds > 0 && (
                      <Tooltip
                        label={`${t("Intervalo")}: ${intervalSeconds} s`}
                        withArrow
                      >
                        <Box
                          bg="yellow.6"
                          h="100%"
                          style={{
                            width: `${Math.max(2, (intervalSeconds / measuredSeconds) * 100)}%`,
                            borderRadius: 99,
                          }}
                        />
                      </Tooltip>
                    )}
                    <Tooltip
                      label={`${t("Reconstrucción")}: ${recallingSeconds} s`}
                      withArrow
                    >
                      <Box
                        bg="grape.6"
                        h="100%"
                        style={{
                          width: `${Math.max(2, (recallingSeconds / measuredSeconds) * 100)}%`,
                          borderRadius: 99,
                        }}
                      />
                    </Tooltip>
                  </Group>
                </Card>

                <Card withBorder padding="md">
                  <Text fw={600} mb="sm">
                    {t("Contexto de participación")}
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("País")}
                      </Text>
                      <Text>{response.data.countryCode ?? "—"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("Idioma del navegador")}
                      </Text>
                      <Text>{response.data.browserLocale ?? "—"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("Zona horaria")}
                      </Text>
                      <Text>{response.data.timezone ?? "—"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("Dispositivo")}
                      </Text>
                      <Text>
                        {response.data.deviceType
                          ? t(deviceLabels[response.data.deviceType])
                          : "—"}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("Navegador")}
                      </Text>
                      <Text>{response.data.browser ?? "—"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("Sistema operativo")}
                      </Text>
                      <Text>{response.data.operatingSystem ?? "—"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        {t("Pantalla")}
                      </Text>
                      <Text>
                        {response.data.screenWidth && response.data.screenHeight
                          ? `${response.data.screenWidth} × ${response.data.screenHeight}`
                          : "—"}
                      </Text>
                    </div>
                  </SimpleGrid>
                </Card>

                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <Group justify="space-between" align="center">
                      <div>
                        <Title order={2}>{t("Comparación")}</Title>
                        <Text c="dimmed" size="sm">
                          {t(
                            "Historia original y reconstrucción de la persona.",
                          )}
                        </Text>
                      </div>
                      {analysis.data && (
                        <Button
                          variant={analysisVisible ? "light" : "default"}
                          leftSection={<IconSparkles size={17} />}
                          rightSection={
                            <IconChevronDown
                              size={16}
                              style={{
                                transform: analysisVisible
                                  ? "rotate(180deg)"
                                  : undefined,
                                transition: "transform 150ms ease",
                              }}
                            />
                          }
                          onClick={() => setAnalysisVisible((value) => !value)}
                        >
                          {analysisVisible
                            ? t("Ocultar análisis")
                            : t("Mostrar análisis")}
                        </Button>
                      )}
                    </Group>

                    {analysis.data && analysisVisible && (
                      <Group gap="xs">
                        {(
                          Object.keys(
                            phenomenonLabels,
                          ) as DisplayPhenomenon["kind"][]
                        ).map((kind) => {
                          const count = phenomena.filter(
                            (phenomenon) => phenomenon.kind === kind,
                          ).length;
                          return count > 0 ? (
                            <Badge
                              key={kind}
                              color={phenomenonColors[kind]}
                              variant="light"
                            >
                              {phenomenonLabels[kind]} · {count}
                            </Badge>
                          ) : null;
                        })}
                      </Group>
                    )}

                    <SimpleGrid cols={{ base: 1, lg: 3 }}>
                      <Paper withBorder p="md">
                        <Text size="sm" c="dimmed" fw={600} mb="sm">
                          {t("Historia original")} · {countWords(sourceStory)}{" "}
                          {t("palabras")}
                        </Text>
                        <Text
                          style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}
                        >
                          {analysisVisible ? (
                            <AnnotatedText
                              text={sourceStory}
                              phenomena={phenomena}
                              side="story"
                              selectedIndices={selectedPhenomena}
                              onSelect={setSelectedPhenomena}
                            />
                          ) : (
                            sourceStory
                          )}
                        </Text>
                      </Paper>
                      <Paper withBorder p="md">
                        <Text size="sm" c="dimmed" fw={600} mb="sm">
                          {t("Reconstrucción")} ·{" "}
                          {countWords(response.data.recallText ?? "")}{" "}
                          {t("palabras")}
                        </Text>
                        <Text
                          c={response.data.recallText ? undefined : "dimmed"}
                          style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}
                        >
                          {response.data.recallText ? (
                            analysisVisible ? (
                              <AnnotatedText
                                text={response.data.recallText}
                                phenomena={phenomena}
                                side="recall"
                                selectedIndices={selectedPhenomena}
                                onSelect={setSelectedPhenomena}
                              />
                            ) : (
                              response.data.recallText
                            )
                          ) : (
                            t("La persona todavía no envió una respuesta.")
                          )}
                        </Text>
                      </Paper>
                      {analysis.data && analysisVisible && (
                        <Paper
                          withBorder
                          p="md"
                          style={{
                            alignSelf: "start",
                            position: "sticky",
                            top: 80,
                          }}
                        >
                          <Stack gap="md">
                            <div>
                              <Text fw={650}>{t("Detalle del fragmento")}</Text>
                              <Text size="sm" c="dimmed">
                                {selected.length > 0
                                  ? t(
                                      "Este fragmento tiene las siguientes interpretaciones.",
                                    )
                                  : t(
                                      "Seleccioná una marca en los textos para inspeccionarla.",
                                    )}
                              </Text>
                            </div>

                            {selected.map((phenomenon, index) => (
                              <Paper
                                key={`${phenomenon.kind}-${index}`}
                                withBorder
                                p="sm"
                                style={{
                                  background:
                                    phenomenonBackgrounds[phenomenon.kind],
                                }}
                              >
                                <Group justify="space-between" mb="xs">
                                  <Badge
                                    color={phenomenonColors[phenomenon.kind]}
                                  >
                                    {phenomenonLabels[phenomenon.kind]}
                                  </Badge>
                                  <Text size="xs" c="dimmed">
                                    {t("Confianza")}{" "}
                                    {Math.round(phenomenon.confidence * 100)} %
                                  </Text>
                                </Group>
                                <Text size="sm">{phenomenon.explanation}</Text>
                                {(phenomenon.storyExcerpt ||
                                  phenomenon.recallExcerpt) && (
                                  <Text size="xs" c="dimmed" mt="xs">
                                    {[
                                      phenomenon.storyExcerpt,
                                      phenomenon.recallExcerpt,
                                    ]
                                      .filter(Boolean)
                                      .map((excerpt) => `“${excerpt}”`)
                                      .join(" → ")}
                                  </Text>
                                )}
                              </Paper>
                            ))}

                            <SimpleGrid cols={3} spacing="xs">
                              <div>
                                <Text size="xs" c="dimmed">
                                  {t("Retenidas")}
                                </Text>
                                <Text fw={700}>
                                  {analysis.data.retainedUnitsCount}
                                </Text>
                              </div>
                              <div>
                                <Text size="xs" c="dimmed">
                                  {t("Omisiones")}
                                </Text>
                                <Text fw={700}>
                                  {analysis.data.omittedUnitsCount}
                                </Text>
                              </div>
                              <div>
                                <Text size="xs" c="dimmed">
                                  {t("Intrusiones")}
                                </Text>
                                <Text fw={700}>
                                  {analysis.data.intrusionCount}
                                </Text>
                              </div>
                            </SimpleGrid>
                          </Stack>
                        </Paper>
                      )}
                    </SimpleGrid>

                    {!analysis.isLoading && !analysis.data && (
                      <Text size="sm" c="dimmed">
                        Esta respuesta todavía no tiene análisis automático.
                      </Text>
                    )}
                  </Stack>
                </Card>
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default ResponseDetailPage;

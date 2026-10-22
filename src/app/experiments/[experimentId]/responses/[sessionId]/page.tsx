"use client";

import {
  Accordion,
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
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

const ResponseExperiment = Experiment.view("ResponseExperiment", {
  id: true,
  title: true,
  story: true,
});

const ResponseDetail = ParticipantSession.view("ResponseDetail", {
  id: true,
  experiment: true,
  status: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  lastActivityAt: true,
  recallText: true,
  submittedAt: true,
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

const AnnotatedText = ({
  text,
  phenomena,
  side,
  selectedIndex,
  onSelect,
}: {
  text: string;
  phenomena: DisplayPhenomenon[];
  side: "story" | "recall";
  selectedIndex: number | null;
  onSelect: (index: number) => void;
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
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter(
      (candidate, index, all) =>
        !all.slice(0, index).some((previous) => previous.end > candidate.start),
    );

  if (candidates.length === 0) return text;

  const content = [];
  let cursor = 0;
  for (const candidate of candidates) {
    if (candidate.start > cursor) {
      content.push(text.slice(cursor, candidate.start));
    }
    content.push(
      <Box
        component="button"
        type="button"
        key={`${side}-${candidate.index}-${candidate.start}`}
        onClick={() => onSelect(candidate.index)}
        title={phenomenonLabels[candidate.phenomenon.kind]}
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
          borderBottom: `2px solid var(--mantine-color-${phenomenonColors[candidate.phenomenon.kind]}-6)`,
          borderRadius: 3,
          background: phenomenonBackgrounds[candidate.phenomenon.kind],
          outline:
            selectedIndex === candidate.index
              ? `2px solid var(--mantine-color-${phenomenonColors[candidate.phenomenon.kind]}-5)`
              : "none",
          outlineOffset: 2,
        }}
      >
        {candidate.excerpt}
      </Box>,
    );
    cursor = candidate.end;
  }
  if (cursor < text.length) content.push(text.slice(cursor));
  return content;
};

const ResponseDetailPage = () => {
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [selectedPhenomenon, setSelectedPhenomenon] = useState<number | null>(
    null,
  );
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
  const phenomena = useMemo(
    () => readPhenomena(analysis.data?.phenomena),
    [analysis.data?.phenomena],
  );
  const selected =
    selectedPhenomenon === null ? null : phenomena[selectedPhenomenon];
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
            ? `${experiment.data.title} · Respuesta`
            : "Respuesta individual"
        }
        backHref={
          requestedRunId
            ? `/experiments/${experimentId}/analysis/${requestedRunId}`
            : `/experiments/${experimentId}`
        }
      />

      <AppShell.Main>
        <Container size="md" py="xl">
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
                  <Title order={2}>No se encontró la participación</Title>
                  <Text c="dimmed" mt="xs">
                    Revisá que el enlace corresponda a este experimento.
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
                      <Title order={1}>Respuesta individual</Title>
                      <Text c="dimmed" ff="monospace" size="sm">
                        {response.data.id}
                      </Text>
                    </div>
                    <Badge
                      size="lg"
                      variant="light"
                      color={statusDetails[response.data.status].color}
                    >
                      {statusDetails[response.data.status].label}
                    </Badge>
                  </Group>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Tiempo total
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
                      Lectura
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
                      Reconstrucción
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
                      <Text fw={600}>Recorrido</Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(response.data.startedAt)} →{" "}
                        {formatDate(response.data.submittedAt)}
                      </Text>
                    </div>
                    <Group gap="md" visibleFrom="sm">
                      <Text size="xs" c="dimmed">
                        Lectura{" "}
                        {durationBetween(
                          response.data.startedAt,
                          response.data.intervalStartedAt ??
                            response.data.recallingStartedAt,
                        )}
                      </Text>
                      {intervalSeconds > 0 && (
                        <Text size="xs" c="dimmed">
                          Intervalo{" "}
                          {durationBetween(
                            response.data.intervalStartedAt,
                            response.data.recallingStartedAt,
                          )}
                        </Text>
                      )}
                      <Text size="xs" c="dimmed">
                        Reconstrucción{" "}
                        {durationBetween(
                          response.data.recallingStartedAt,
                          response.data.submittedAt ??
                            response.data.lastActivityAt,
                        )}
                      </Text>
                    </Group>
                  </Group>
                  <Group gap={3} wrap="nowrap" h={10}>
                    <Box
                      title={`Lectura: ${readingSeconds} s`}
                      bg="blue.6"
                      h="100%"
                      style={{
                        width: `${Math.max(2, (readingSeconds / measuredSeconds) * 100)}%`,
                        borderRadius: 99,
                      }}
                    />
                    {intervalSeconds > 0 && (
                      <Box
                        title={`Intervalo: ${intervalSeconds} s`}
                        bg="yellow.6"
                        h="100%"
                        style={{
                          width: `${Math.max(2, (intervalSeconds / measuredSeconds) * 100)}%`,
                          borderRadius: 99,
                        }}
                      />
                    )}
                    <Box
                      title={`Reconstrucción: ${recallingSeconds} s`}
                      bg="grape.6"
                      h="100%"
                      style={{
                        width: `${Math.max(2, (recallingSeconds / measuredSeconds) * 100)}%`,
                        borderRadius: 99,
                      }}
                    />
                  </Group>
                </Card>

                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <Group justify="space-between" align="center">
                      <div>
                        <Title order={2}>Comparación</Title>
                        <Text c="dimmed" size="sm">
                          Historia original y reconstrucción de la persona.
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
                            ? "Ocultar análisis"
                            : "Mostrar análisis"}
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

                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <Paper withBorder p="md">
                        <Text size="sm" c="dimmed" fw={600} mb="sm">
                          Historia original ·{" "}
                          {countWords(experiment.data.story)} palabras
                        </Text>
                        <Text
                          style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}
                        >
                          {analysisVisible ? (
                            <AnnotatedText
                              text={experiment.data.story}
                              phenomena={phenomena}
                              side="story"
                              selectedIndex={selectedPhenomenon}
                              onSelect={setSelectedPhenomenon}
                            />
                          ) : (
                            experiment.data.story
                          )}
                        </Text>
                      </Paper>
                      <Paper withBorder p="md">
                        <Text size="sm" c="dimmed" fw={600} mb="sm">
                          Reconstrucción ·{" "}
                          {countWords(response.data.recallText ?? "")} palabras
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
                                selectedIndex={selectedPhenomenon}
                                onSelect={setSelectedPhenomenon}
                              />
                            ) : (
                              response.data.recallText
                            )
                          ) : (
                            "La persona todavía no envió una respuesta."
                          )}
                        </Text>
                      </Paper>
                    </SimpleGrid>

                    <Collapse
                      expanded={Boolean(analysis.data && analysisVisible)}
                    >
                      <Divider my="md" />
                      <Stack gap="md">
                        <Group justify="space-between">
                          <div>
                            <Text fw={600}>Análisis asistido</Text>
                            <Text size="sm" c="dimmed">
                              Seleccioná una marca en los textos para
                              inspeccionarla.
                            </Text>
                          </div>
                          <Text size="xs" c="dimmed">
                            {analysis.data?.rubricVersion}
                          </Text>
                        </Group>

                        {selected && (
                          <Paper
                            withBorder
                            p="md"
                            style={{
                              background: phenomenonBackgrounds[selected.kind],
                            }}
                          >
                            <Group justify="space-between" mb="xs">
                              <Badge color={phenomenonColors[selected.kind]}>
                                {phenomenonLabels[selected.kind]}
                              </Badge>
                              <Text size="sm" c="dimmed">
                                Confianza{" "}
                                {Math.round(selected.confidence * 100)} %
                              </Text>
                            </Group>
                            <Text>{selected.explanation}</Text>
                            {(selected.storyExcerpt ||
                              selected.recallExcerpt) && (
                              <Text size="sm" c="dimmed" mt="xs">
                                {[selected.storyExcerpt, selected.recallExcerpt]
                                  .filter(Boolean)
                                  .map((excerpt) => `“${excerpt}”`)
                                  .join(" → ")}
                              </Text>
                            )}
                          </Paper>
                        )}

                        <SimpleGrid cols={{ base: 3 }}>
                          <div>
                            <Text size="xs" c="dimmed">
                              Retenidas
                            </Text>
                            <Text fw={700}>
                              {analysis.data?.retainedUnitsCount}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">
                              Omisiones
                            </Text>
                            <Text fw={700}>
                              {analysis.data?.omittedUnitsCount}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">
                              Intrusiones
                            </Text>
                            <Text fw={700}>
                              {analysis.data?.intrusionCount}
                            </Text>
                          </div>
                        </SimpleGrid>

                        {phenomena.length > 0 && (
                          <Accordion variant="contained" multiple>
                            {(
                              Object.keys(
                                phenomenonLabels,
                              ) as DisplayPhenomenon["kind"][]
                            ).map((kind) => {
                              const grouped = phenomena
                                .map((phenomenon, index) => ({
                                  phenomenon,
                                  index,
                                }))
                                .filter(
                                  ({ phenomenon }) => phenomenon.kind === kind,
                                );
                              if (grouped.length === 0) return null;

                              return (
                                <Accordion.Item key={kind} value={kind}>
                                  <Accordion.Control>
                                    <Group gap="xs">
                                      <Badge
                                        color={phenomenonColors[kind]}
                                        variant="light"
                                      >
                                        {grouped.length}
                                      </Badge>
                                      <Text fw={600} size="sm">
                                        {phenomenonLabels[kind]}
                                      </Text>
                                    </Group>
                                  </Accordion.Control>
                                  <Accordion.Panel>
                                    <Box
                                      mah={320}
                                      style={{ overflowY: "auto" }}
                                    >
                                      {grouped.map(({ phenomenon, index }) => {
                                        const excerpt =
                                          phenomenon.storyExcerpt ??
                                          phenomenon.recallExcerpt ??
                                          "Sin fragmento asociado";
                                        return (
                                          <UnstyledButton
                                            key={`${kind}-${index}`}
                                            onClick={() =>
                                              setSelectedPhenomenon(index)
                                            }
                                            w="100%"
                                            px="sm"
                                            py="xs"
                                            style={{
                                              borderBottom:
                                                "1px solid var(--mantine-color-dark-4)",
                                              background:
                                                selectedPhenomenon === index
                                                  ? phenomenonBackgrounds[kind]
                                                  : undefined,
                                            }}
                                          >
                                            <Group
                                              justify="space-between"
                                              wrap="nowrap"
                                              gap="md"
                                            >
                                              <Text
                                                size="sm"
                                                lineClamp={1}
                                                style={{ flex: 1 }}
                                              >
                                                “{excerpt}”
                                              </Text>
                                              <Text
                                                size="xs"
                                                c="dimmed"
                                                style={{ flexShrink: 0 }}
                                              >
                                                {Math.round(
                                                  phenomenon.confidence * 100,
                                                )}
                                                %
                                              </Text>
                                            </Group>
                                          </UnstyledButton>
                                        );
                                      })}
                                    </Box>
                                  </Accordion.Panel>
                                </Accordion.Item>
                              );
                            })}
                          </Accordion>
                        )}
                      </Stack>
                    </Collapse>

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

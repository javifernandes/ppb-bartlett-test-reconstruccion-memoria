"use client";

import {
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import {
  IconArrowLeft,
  IconChevronRight,
  IconFlask,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
} from "@/generated/client-entities";

const AnalysisExperiment = Experiment.view("AnalysisExperiment", {
  id: true,
  title: true,
  story: true,
  status: true,
});

const AnalysisRunDetail = AnalysisRun.view("AnalysisRunDetail", {
  id: true,
  experiment: true,
  status: true,
  analyzerVersion: true,
  createdAt: true,
});

const AnalyzedResponse = ParticipantSession.view("AnalyzedResponse", {
  id: true,
  status: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  submittedAt: true,
  recallText: true,
});

const RecallAnalysisRow = RecallAnalysis.view("RecallAnalysisRow", {
  id: true,
  run: true,
  session: true,
  retainedUnitsCount: true,
  omittedUnitsCount: true,
  intrusionCount: true,
  phenomena: true,
});

const countWords = (value: string) =>
  value.trim().match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

const secondsBetween = (from?: string | null, to?: string | null) =>
  from && to
    ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
    : undefined;

const average = (values: number[]) =>
  values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;

const formatSeconds = (value: number) => {
  const rounded = Math.round(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
};

const AnalysisPage = () => {
  const { experimentId, analysisRunId } = useParams<{
    experimentId: string;
    analysisRunId: string;
  }>();
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.id.eq(experimentId))
        .as(AnalysisExperiment)
        .one(),
    [experimentId],
  );
  const runQuery = useMemo(
    () =>
      AnalysisRun.all()
        .where((run) => run.id.eq(analysisRunId))
        .as(AnalysisRunDetail)
        .one(),
    [analysisRunId],
  );
  const responsesQuery = useMemo(
    () =>
      ParticipantSession.all()
        .where((session) =>
          session.experiment.eq(Experiment.refById(experimentId)),
        )
        .where((session) => session.status.eq("submitted"))
        .as(AnalyzedResponse)
        .orderBy((session) => session.submittedAt.asc()),
    [experimentId],
  );
  const experiment = useGraphQuery(experimentQuery);
  const run = useGraphQuery(runQuery);
  const responses = useGraphQuery(responsesQuery);
  const recallAnalysesQuery = useMemo(
    () =>
      RecallAnalysis.all()
        .where((analysis) =>
          analysis.run.eq(AnalysisRun.refById(analysisRunId)),
        )
        .as(RecallAnalysisRow),
    [analysisRunId],
  );
  const recallAnalyses = useGraphQuery(recallAnalysesQuery);
  const validRun = run.data?.experiment.locator.id === experimentId;
  const storyWordCount = countWords(experiment.data?.story ?? "");
  const responseMetrics = (responses.data ?? []).map((response) => {
    const semanticAnalysis = recallAnalyses.data?.find(
      (analysis) => analysis.session.locator.id === response.id,
    );
    const wordCount = countWords(response.recallText ?? "");
    return {
      ...response,
      wordCount,
      relativeLength:
        storyWordCount > 0 ? (wordCount / storyWordCount) * 100 : 0,
      readingSeconds: secondsBetween(
        response.startedAt,
        response.intervalStartedAt ?? response.recallingStartedAt,
      ),
      recallSeconds: secondsBetween(
        response.recallingStartedAt,
        response.submittedAt,
      ),
      totalSeconds: secondsBetween(response.startedAt, response.submittedAt),
      semanticAnalysis,
    };
  });
  const wordCounts = responseMetrics.map((response) => response.wordCount);
  const readingTimes = responseMetrics.flatMap((response) =>
    response.readingSeconds === undefined ? [] : [response.readingSeconds],
  );
  const recallTimes = responseMetrics.flatMap((response) =>
    response.recallSeconds === undefined ? [] : [response.recallSeconds],
  );
  const semanticAnalyses = recallAnalyses.data ?? [];
  const loading =
    experiment.isLoading ||
    run.isLoading ||
    responses.isLoading ||
    recallAnalyses.isLoading;
  const invalid =
    experiment.isError ||
    run.isError ||
    responses.isError ||
    recallAnalyses.isError ||
    !validRun;

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header px="md">
        <Group h="100%" gap="sm">
          <IconFlask size={24} />
          <Text fw={600}>Prueba de Bartlett</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg" py="xl">
          <Stack gap="xl">
            <Button
              component={Link}
              href={`/experiments/${experimentId}`}
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              w="fit-content"
            >
              Volver al experimento
            </Button>

            {loading && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {invalid && !loading && (
              <Card withBorder>
                <Title order={2}>No se pudo cargar el análisis</Title>
                <Text c="dimmed" mt="xs">
                  Revisá que corresponda a este experimento.
                </Text>
              </Card>
            )}

            {experiment.data && run.data && validRun && !invalid && (
              <>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text c="dimmed" size="sm">
                      {experiment.data.title}
                    </Text>
                    <Title order={1}>Análisis descriptivo</Title>
                    <Text c="dimmed">
                      Calculado el{" "}
                      {new Date(run.data.createdAt).toLocaleString("es-AR")}
                    </Text>
                  </div>
                  <Badge variant="light" color="teal" size="lg">
                    {run.data.status === "completed_with_errors"
                      ? "Completado con errores"
                      : run.data.status === "running"
                        ? "En curso"
                        : "Completado"}
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Respuestas
                    </Text>
                    <Text size="xl" fw={700}>
                      {responseMetrics.length}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Palabras de la historia
                    </Text>
                    <Text size="xl" fw={700}>
                      {storyWordCount}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Promedio de palabras
                    </Text>
                    <Text size="xl" fw={700}>
                      {wordCounts.length > 0
                        ? average(wordCounts).toFixed(1)
                        : "—"}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Extensión relativa promedio
                    </Text>
                    <Text size="xl" fw={700}>
                      {storyWordCount > 0 && wordCounts.length > 0
                        ? `${((average(wordCounts) / storyWordCount) * 100).toFixed(1)} %`
                        : "—"}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Lectura promedio
                    </Text>
                    <Text size="xl" fw={700}>
                      {readingTimes.length > 0
                        ? formatSeconds(average(readingTimes))
                        : "—"}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Reconstrucción promedio
                    </Text>
                    <Text size="xl" fw={700}>
                      {recallTimes.length > 0
                        ? formatSeconds(average(recallTimes))
                        : "—"}
                    </Text>
                  </Card>
                </SimpleGrid>

                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <div>
                      <Title order={2}>Fenómenos detectados</Title>
                      <Text c="dimmed">
                        Detección automática con evidencia textual. Las
                        interpretaciones requieren revisión humana.
                      </Text>
                    </div>
                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                      <div>
                        <Text size="sm" c="dimmed">
                          Unidades retenidas
                        </Text>
                        <Text size="xl" fw={700}>
                          {semanticAnalyses.reduce(
                            (total, analysis) =>
                              total + analysis.retainedUnitsCount,
                            0,
                          )}
                        </Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">
                          Omisiones candidatas
                        </Text>
                        <Text size="xl" fw={700}>
                          {semanticAnalyses.reduce(
                            (total, analysis) =>
                              total + analysis.omittedUnitsCount,
                            0,
                          )}
                        </Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">
                          Intrusiones candidatas
                        </Text>
                        <Text size="xl" fw={700}>
                          {semanticAnalyses.reduce(
                            (total, analysis) =>
                              total + analysis.intrusionCount,
                            0,
                          )}
                        </Text>
                      </div>
                    </SimpleGrid>
                  </Stack>
                </Card>

                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <div>
                      <Title order={2}>Respuestas analizadas</Title>
                      <Text c="dimmed">
                        Seleccioná una respuesta para compararla con la historia
                        original.
                      </Text>
                    </div>
                    {responseMetrics.length === 0 ? (
                      <Text c="dimmed">
                        No hay respuestas completas para analizar.
                      </Text>
                    ) : (
                      <Table.ScrollContainer minWidth={760}>
                        <Table verticalSpacing="sm" highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Respuesta</Table.Th>
                              <Table.Th>Palabras</Table.Th>
                              <Table.Th>Extensión relativa</Table.Th>
                              <Table.Th>Lectura</Table.Th>
                              <Table.Th>Reconstrucción</Table.Th>
                              <Table.Th>Tiempo total</Table.Th>
                              <Table.Th>Omisiones</Table.Th>
                              <Table.Th>Intrusiones</Table.Th>
                              <Table.Th />
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {responseMetrics.map((response, index) => (
                              <Table.Tr key={response.id}>
                                <Table.Td>Respuesta {index + 1}</Table.Td>
                                <Table.Td>{response.wordCount}</Table.Td>
                                <Table.Td>
                                  {response.relativeLength.toFixed(1)} %
                                </Table.Td>
                                <Table.Td>
                                  {response.readingSeconds === undefined
                                    ? "—"
                                    : formatSeconds(response.readingSeconds)}
                                </Table.Td>
                                <Table.Td>
                                  {response.recallSeconds === undefined
                                    ? "—"
                                    : formatSeconds(response.recallSeconds)}
                                </Table.Td>
                                <Table.Td>
                                  {response.totalSeconds === undefined
                                    ? "—"
                                    : formatSeconds(response.totalSeconds)}
                                </Table.Td>
                                <Table.Td>
                                  {response.semanticAnalysis
                                    ?.omittedUnitsCount ?? "—"}
                                </Table.Td>
                                <Table.Td>
                                  {response.semanticAnalysis?.intrusionCount ??
                                    "—"}
                                </Table.Td>
                                <Table.Td>
                                  <Button
                                    component={Link}
                                    href={`/experiments/${experimentId}/responses/${response.id}`}
                                    variant="subtle"
                                    size="compact-sm"
                                    rightSection={
                                      <IconChevronRight size={16} />
                                    }
                                  >
                                    Comparar
                                  </Button>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
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

export default AnalysisPage;

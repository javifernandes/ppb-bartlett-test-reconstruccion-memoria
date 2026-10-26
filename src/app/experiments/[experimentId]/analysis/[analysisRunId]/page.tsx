"use client";

import {
  AppShell,
  Badge,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
} from "@/generated/client-entities";
import { AdminHeader } from "@/app/admin-header";
import { useI18n } from "@/app/i18n";
import { createId } from "@/lib/create-id";
import { MemoryMap } from "./memory-map";
import { ExperimentWorkspaceTabs } from "../../workspace-tabs";

const AnalysisExperiment = Experiment.view("AnalysisExperiment", {
  id: true,
  title: true,
  story: true,
  primaryLanguage: true,
  alternateLanguage: true,
  alternateStory: true,
  analysisRubrics: true,
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
  contentLanguage: true,
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
  unitAssessments: true,
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
  const { locale, t } = useI18n();
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
  const analyzeRecall = useOperation(RecallAnalysis.domain.analyze);
  const scheduledAnalysisIds = useRef(new Set<string>());
  const validRun = run.data?.experiment.locator.id === experimentId;
  const primaryStoryWordCount = countWords(experiment.data?.story ?? "");
  const responseMetrics = (responses.data ?? []).map((response) => {
    const semanticAnalysis = recallAnalyses.data?.find(
      (analysis) => analysis.session.locator.id === response.id,
    );
    const wordCount = countWords(response.recallText ?? "");
    const storyWordCount = countWords(
      response.contentLanguage === experiment.data?.alternateLanguage &&
        experiment.data?.alternateStory
        ? experiment.data.alternateStory
        : (experiment.data?.story ?? ""),
    );
    return {
      ...response,
      wordCount,
      storyWordCount,
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
  const storyWordCounts = [
    ...new Set(responseMetrics.map((response) => response.storyWordCount)),
  ];
  const readingTimes = responseMetrics.flatMap((response) =>
    response.readingSeconds === undefined ? [] : [response.readingSeconds],
  );
  const recallTimes = responseMetrics.flatMap((response) =>
    response.recallSeconds === undefined ? [] : [response.recallSeconds],
  );
  const semanticAnalyses = useMemo(
    () => recallAnalyses.data ?? [],
    [recallAnalyses.data],
  );
  useEffect(() => {
    if (
      run.data?.status !== "running" ||
      responses.isLoading ||
      recallAnalyses.isLoading ||
      responses.isError ||
      recallAnalyses.isError
    ) {
      return;
    }

    const analyzedSessionIds = new Set(
      semanticAnalyses.map((analysis) => String(analysis.session.locator.id)),
    );
    for (const response of responses.data ?? []) {
      if (
        analyzedSessionIds.has(response.id) ||
        scheduledAnalysisIds.current.has(response.id)
      ) {
        continue;
      }

      scheduledAnalysisIds.current.add(response.id);
      void analyzeRecall
        .executeAsync({
          id: createId(),
          run: AnalysisRun.refById(analysisRunId),
          session: ParticipantSession.refById(response.id),
          experiment: Experiment.refById(experimentId),
          createdAt: new Date().toISOString(),
        })
        .then((result) => {
          if (!result.ok) scheduledAnalysisIds.current.delete(response.id);
        });
    }
  }, [
    analysisRunId,
    analyzeRecall,
    experimentId,
    recallAnalyses.isError,
    recallAnalyses.isLoading,
    responses.data,
    responses.isError,
    responses.isLoading,
    run.data?.status,
    semanticAnalyses,
  ]);
  const primaryResponseIds = new Set(
    (responses.data ?? [])
      .filter(
        (response) =>
          response.contentLanguage === experiment.data?.primaryLanguage,
      )
      .map((response) => response.id),
  );
  const primaryAnalyses = semanticAnalyses.filter((analysis) =>
    primaryResponseIds.has(String(analysis.session.locator.id)),
  );
  const primaryRubric = (
    experiment.data?.analysisRubrics as
      | Array<{
          language: "es" | "en";
          units: Array<{ id: string; text: string; concepts?: string[] }>;
        }>
      | null
      | undefined
  )?.find((rubric) => rubric.language === experiment.data?.primaryLanguage);
  const memoryUnits = (primaryRubric?.units ?? []).map((unit) => {
    const assessments = primaryAnalyses.flatMap((analysis) => {
      const values = analysis.unitAssessments as
        | Array<{
            unitId: string;
            presence: "full" | "trace" | "absent";
          }>
        | undefined;
      return values?.filter((value) => value.unitId === unit.id) ?? [];
    });
    return {
      ...unit,
      fullCount: assessments.filter((value) => value.presence === "full")
        .length,
      traceCount: assessments.filter((value) => value.presence === "trace")
        .length,
      absentCount: assessments.filter((value) => value.presence === "absent")
        .length,
      transformations: [],
    };
  });
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
      <AdminHeader
        section={
          experiment.data
            ? `${experiment.data.title} · ${t("Análisis")}`
            : t("Análisis")
        }
        backHref={`/experiments/${experimentId}`}
      />

      <AppShell.Main>
        <Container size="lg" py="xl">
          <Stack gap="xl">
            {loading && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {invalid && !loading && (
              <Card withBorder>
                <Title order={2}>{t("No se pudo cargar el análisis")}</Title>
                <Text c="dimmed" mt="xs">
                  {t("Revisá que corresponda a este experimento.")}
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
                    <Title order={1}>{t("Análisis descriptivo")}</Title>
                    <Text c="dimmed">
                      Calculado el{" "}
                      {new Date(run.data.createdAt).toLocaleString(
                        locale === "es" ? "es-AR" : "en-US",
                      )}
                    </Text>
                    <Text c="dimmed" size="sm" mt={4}>
                      {semanticAnalyses.length} {t("de")}{" "}
                      {responseMetrics.length} {t("respuestas analizadas")}
                    </Text>
                  </div>
                  <Stack align="flex-end" gap="sm">
                    <Badge variant="light" color="teal" size="lg">
                      {run.data.status === "completed_with_errors"
                        ? t("Completado con errores")
                        : run.data.status === "running"
                          ? t("En curso")
                          : t("Completado")}
                    </Badge>
                  </Stack>
                </Group>

                <ExperimentWorkspaceTabs
                  experimentId={experimentId}
                  current="analysis"
                  isDraft={false}
                  analysisHref={`/experiments/${experimentId}/analysis/${analysisRunId}`}
                />

                <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Respuestas")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {responseMetrics.length}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Palabras de la historia")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {responseMetrics.length > 0
                        ? storyWordCounts.join(" / ")
                        : primaryStoryWordCount}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Promedio de palabras")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {wordCounts.length > 0
                        ? average(wordCounts).toFixed(1)
                        : "—"}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Extensión relativa promedio")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {responseMetrics.length > 0
                        ? `${average(responseMetrics.map((response) => response.relativeLength)).toFixed(1)} %`
                        : "—"}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Lectura promedio")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {readingTimes.length > 0
                        ? formatSeconds(average(readingTimes))
                        : "—"}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      {t("Reconstrucción promedio")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {recallTimes.length > 0
                        ? formatSeconds(average(recallTimes))
                        : "—"}
                    </Text>
                  </Card>
                </SimpleGrid>

                {responseMetrics.length === 0 ? (
                  <Card withBorder padding="xl">
                    <Stack align="center" gap="xs" py="xl" ta="center">
                      <Title order={2}>{t("Aún no hay respuestas")}</Title>
                      <Text c="dimmed" maw={560}>
                        {t(
                          "El mapa de recuerdo y los fenómenos aparecerán cuando una persona complete el experimento.",
                        )}
                      </Text>
                    </Stack>
                  </Card>
                ) : semanticAnalyses.length === 0 ? (
                  <Card withBorder padding="xl">
                    <Stack align="center" gap="xs" py="xl" ta="center">
                      <Title order={2}>
                        {t("Las respuestas todavía se están analizando")}
                      </Title>
                      <Text c="dimmed">
                        {t(
                          "Los resultados aparecerán cuando termine el análisis automático.",
                        )}
                      </Text>
                    </Stack>
                  </Card>
                ) : (
                  <>
                    {primaryRubric && (
                      <MemoryMap
                        story={experiment.data.story}
                        units={memoryUnits}
                        responseCount={primaryAnalyses.length}
                      />
                    )}

                    <Card withBorder padding="lg">
                      <Stack gap="md">
                        <div>
                          <Title order={2}>{t("Fenómenos detectados")}</Title>
                          <Text c="dimmed">
                            {t(
                              "Detección automática con evidencia textual. Las interpretaciones requieren revisión humana.",
                            )}
                          </Text>
                        </div>
                        <SimpleGrid cols={{ base: 1, sm: 3 }}>
                          <div>
                            <Text size="sm" c="dimmed">
                              {t("Unidades retenidas")}
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
                              {t("Omisiones candidatas")}
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
                              {t("Intrusiones candidatas")}
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
                  </>
                )}
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default AnalysisPage;

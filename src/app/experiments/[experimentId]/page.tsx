"use client";

import {
  Accordion,
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import {
  IconChartBar,
  IconChevronRight,
  IconCopy,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconLock,
  IconRefresh,
  IconRocket,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
} from "@/generated/client-entities";
import { AdminHeader } from "@/app/admin-header";

const ExperimentWorkspace = Experiment.view("ExperimentWorkspace", {
  id: true,
  title: true,
  participantTitle: true,
  introduction: true,
  consentText: true,
  story: true,
  recallInstructions: true,
  intervalSeconds: true,
  distractorEnabled: true,
  status: true,
  createdAt: true,
  publishedAt: true,
  publicToken: true,
});

const ParticipantSessionRow = ParticipantSession.view("ParticipantSessionRow", {
  id: true,
  status: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  lastActivityAt: true,
  recallText: true,
  submittedAt: true,
});

const AnalysisRunRow = AnalysisRun.view("AnalysisRunRow", {
  id: true,
  status: true,
  analyzerVersion: true,
  createdAt: true,
});

const sessionStatus = {
  reading: { label: "Leyendo", color: "blue" },
  interval: { label: "En intervalo", color: "yellow" },
  recalling: { label: "Reconstruyendo", color: "grape" },
  submitted: { label: "Completada", color: "teal" },
} as const;

const elapsedSeconds = (from?: string | null, to?: string | null) => {
  if (!from || !to) return "";
  return String(
    Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000)),
  );
};

const ExperimentWorkspacePage = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const router = useRouter();
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.id.eq(experimentId))
        .as(ExperimentWorkspace)
        .one(),
    [experimentId],
  );
  const experiment = useGraphQuery(experimentQuery);
  const sessionsQuery = useMemo(
    () =>
      ParticipantSession.all()
        .where((session) =>
          session.experiment.eq(Experiment.refById(experimentId)),
        )
        .as(ParticipantSessionRow)
        .orderBy((session) => session.startedAt.desc()),
    [experimentId],
  );
  const sessions = useGraphQuery(sessionsQuery);
  const analysisRunsQuery = useMemo(
    () =>
      AnalysisRun.all()
        .where((run) => run.experiment.eq(Experiment.refById(experimentId)))
        .as(AnalysisRunRow)
        .orderBy((run) => run.createdAt.desc()),
    [experimentId],
  );
  const analysisRuns = useGraphQuery(analysisRunsQuery);
  const updateDraft = useOperation(Experiment.domain.updateDraft);
  const publish = useOperation(Experiment.domain.publish);
  const close = useOperation(Experiment.domain.close);
  const startAnalysis = useOperation(AnalysisRun.domain.start);
  const analyzeRecall = useOperation(RecallAnalysis.domain.analyze);
  const finishAnalysis = useOperation(AnalysisRun.domain.finish);
  const [publishOpened, publishModal] = useDisclosure(false);
  const [closeOpened, closeModal] = useDisclosure(false);
  const form = useForm({
    initialValues: {
      title: "",
      participantTitle: "",
      introduction: "",
      consentText: "",
      story: "",
      recallInstructions: "",
      intervalSeconds: 0,
      distractorEnabled: false,
    },
    validate: {
      title: (value) => (value.trim() ? null : "Ingresá un nombre."),
      participantTitle: (value) =>
        value.trim() ? null : "Ingresá el título visible.",
      introduction: (value) =>
        value.trim() ? null : "Ingresá una introducción.",
      consentText: (value) =>
        value.trim() ? null : "Ingresá el consentimiento.",
      story: (value) => (value.trim() ? null : "Ingresá la historia."),
      recallInstructions: (value) =>
        value.trim() ? null : "Ingresá las instrucciones.",
    },
  });

  useEffect(() => {
    if (experiment.data) {
      form.setValues({
        title: experiment.data.title,
        participantTitle: experiment.data.participantTitle,
        introduction: experiment.data.introduction,
        consentText: experiment.data.consentText,
        story: experiment.data.story,
        recallInstructions: experiment.data.recallInstructions,
        intervalSeconds: experiment.data.intervalSeconds,
        distractorEnabled: experiment.data.distractorEnabled,
      });
      form.resetDirty();
    }
    // The entity id is the boundary for resetting this editing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.data?.id]);

  const handleSave = form.onSubmit(async (values) => {
    const result = await updateDraft.executeAsync({
      experiment: Experiment.refById(experimentId),
      title: values.title,
      participantTitle: values.participantTitle,
      introduction: values.introduction,
      consentText: values.consentText,
      story: values.story,
      recallInstructions: values.recallInstructions,
      intervalSeconds: values.intervalSeconds,
      distractorEnabled: values.distractorEnabled,
    });

    if (result.ok) {
      form.resetDirty(values);
      notifications.show({
        title: "Cambios guardados",
        message: result.value.title,
        color: "teal",
      });
      return;
    }

    notifications.show({
      title: "No se pudieron guardar los cambios",
      message: result.message,
      color: "red",
    });
  });

  const handlePublish = async () => {
    const result = await publish.executeAsync({
      experiment: Experiment.refById(experimentId),
      publishedAt: new Date().toISOString(),
      publicToken: crypto.randomUUID(),
    });

    if (result.ok) {
      publishModal.close();
      notifications.show({
        title: "Experimento publicado",
        message: "El experimento quedó bloqueado para edición.",
        color: "teal",
      });
      return;
    }

    notifications.show({
      title: "No se pudo publicar",
      message: result.message,
      color: "red",
    });
  };

  const copyPublicLink = async (publicToken: string) => {
    const url = `${window.location.origin}/p/${publicToken}`;
    await navigator.clipboard.writeText(url);
    notifications.show({
      title: "Enlace copiado",
      message: "Ya podés compartirlo con participantes.",
      color: "teal",
    });
  };

  const handleClose = async () => {
    const result = await close.executeAsync({
      experiment: Experiment.refById(experimentId),
    });

    if (result.ok) {
      closeModal.close();
      notifications.show({
        title: "Recepción cerrada",
        message: "El experimento ya no acepta nuevas respuestas.",
        color: "teal",
      });
      return;
    }

    notifications.show({
      title: "No se pudo cerrar el experimento",
      message: result.message,
      color: "red",
    });
  };

  const exportResponses = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = (sessions.data ?? [])
      .filter((session) => session.status === "submitted")
      .map((session) =>
        [
          session.id,
          session.status,
          session.startedAt,
          session.intervalStartedAt ?? "",
          session.recallingStartedAt ?? "",
          session.submittedAt ?? "",
          session.lastActivityAt,
          elapsedSeconds(session.startedAt, session.submittedAt),
          elapsedSeconds(session.startedAt, session.intervalStartedAt),
          elapsedSeconds(session.recallingStartedAt, session.submittedAt),
          session.recallText ?? "",
        ]
          .map(quote)
          .join(","),
      );
    const csv = [
      "id_sesion,estado,inicio,inicio_intervalo,inicio_reconstruccion,envio,ultima_actividad,duracion_total_segundos,duracion_lectura_segundos,duracion_reconstruccion_segundos,reconstruccion",
      ...rows,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${experiment.data?.title ?? "respuestas"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalysis = async (createNew = false) => {
    const existingRun = analysisRuns.data?.[0];
    if (existingRun && !createNew) {
      router.push(`/experiments/${experimentId}/analysis/${existingRun.id}`);
      return;
    }

    const id = crypto.randomUUID();
    const result = await startAnalysis.executeAsync({
      id,
      experiment: Experiment.refById(experimentId),
      createdAt: new Date().toISOString(),
    });

    if (result.ok) {
      let hasErrors = false;
      const completedSessions = (sessions.data ?? []).filter(
        (session) => session.status === "submitted",
      );
      for (const session of completedSessions) {
        const recallResult = await analyzeRecall.executeAsync({
          id: crypto.randomUUID(),
          run: AnalysisRun.refById(id),
          session: ParticipantSession.refById(session.id),
          experiment: Experiment.refById(experimentId),
          createdAt: new Date().toISOString(),
        });
        if (!recallResult.ok) hasErrors = true;
      }
      const finished = await finishAnalysis.executeAsync({
        run: AnalysisRun.refById(id),
        hasErrors,
      });
      if (!finished.ok) {
        notifications.show({
          title: "El análisis quedó incompleto",
          message: finished.message,
          color: "red",
        });
        return;
      }
      router.push(`/experiments/${experimentId}/analysis/${id}`);
      return;
    }

    notifications.show({
      title: "No se pudo iniciar el análisis",
      message: result.message,
      color: "red",
    });
  };

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AdminHeader
        section={experiment.data?.title ?? "Experimento"}
        backHref="/"
      />

      <AppShell.Main>
        <Container size="md" py="xl">
          <Stack gap="xl">
            {experiment.isLoading && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {experiment.isError && (
              <Card withBorder>
                <Text c="red">No se pudo cargar el experimento.</Text>
              </Card>
            )}

            {experiment.data && (
              <>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <div>
                    <Title order={1}>{experiment.data.title}</Title>
                    <Text c="dimmed">Configuración del experimento</Text>
                  </div>
                  <Group>
                    <Badge
                      variant="light"
                      color={
                        experiment.data.status === "published" ? "teal" : "gray"
                      }
                    >
                      {experiment.data.status === "published"
                        ? "Publicado"
                        : experiment.data.status === "closed"
                          ? "Cerrado"
                          : "Borrador"}
                    </Badge>
                    <Button
                      component={Link}
                      href={`/experiments/${experimentId}/preview`}
                      variant="default"
                      leftSection={<IconEye size={18} />}
                    >
                      Vista previa
                    </Button>
                    {experiment.data.status === "draft" && (
                      <Button
                        leftSection={<IconRocket size={18} />}
                        onClick={publishModal.open}
                        disabled={form.isDirty()}
                      >
                        Publicar
                      </Button>
                    )}
                    {experiment.data.status === "published" && (
                      <Button
                        color="red"
                        variant="light"
                        leftSection={<IconLock size={18} />}
                        onClick={closeModal.open}
                      >
                        Cerrar recepción
                      </Button>
                    )}
                    {experiment.data.status === "closed" && (
                      <>
                        {analysisRuns.data?.length ? (
                          <Button
                            leftSection={<IconChartBar size={18} />}
                            onClick={() => void handleAnalysis()}
                          >
                            Ver último análisis
                          </Button>
                        ) : null}
                        <Button
                          variant={
                            analysisRuns.data?.length ? "light" : "filled"
                          }
                          leftSection={
                            analysisRuns.data?.length ? (
                              <IconRefresh size={18} />
                            ) : (
                              <IconChartBar size={18} />
                            )
                          }
                          loading={
                            startAnalysis.isExecuting ||
                            analyzeRecall.isExecuting ||
                            finishAnalysis.isExecuting
                          }
                          onClick={() =>
                            void handleAnalysis(
                              Boolean(analysisRuns.data?.length),
                            )
                          }
                        >
                          {analysisRuns.data?.length
                            ? "Analizar nuevamente"
                            : "Analizar resultados"}
                        </Button>
                      </>
                    )}
                  </Group>
                </Group>

                {experiment.data.status === "published" &&
                  experiment.data.publicToken && (
                    <Card withBorder padding="lg">
                      <Stack gap="sm">
                        <Text fw={600}>Enlace para participantes</Text>
                        <Group align="flex-end">
                          <TextInput
                            aria-label="Enlace para participantes"
                            value={`/p/${experiment.data.publicToken}`}
                            readOnly
                            style={{ flex: 1 }}
                          />
                          <Button
                            variant="default"
                            leftSection={<IconCopy size={18} />}
                            onClick={() =>
                              void copyPublicLink(
                                experiment.data.publicToken as string,
                              )
                            }
                          >
                            Copiar
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  )}

                <Card withBorder padding="lg">
                  <form onSubmit={handleSave}>
                    <Stack gap="lg">
                      <TextInput
                        label="Nombre del experimento"
                        description="Sólo lo ven los administradores."
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("title")}
                      />
                      <Textarea
                        label="Historia"
                        description="El texto se mostrará a los participantes durante la etapa de lectura."
                        minRows={12}
                        autosize
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("story")}
                      />
                      <NumberInput
                        label="Intervalo antes de reconstruir"
                        description="Duración en segundos. Usá 0 para pasar directamente."
                        min={0}
                        max={3600}
                        suffix=" s"
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("intervalSeconds")}
                      />
                      <Switch
                        label="Usar distractor durante el intervalo"
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("distractorEnabled", {
                          type: "checkbox",
                        })}
                      />
                      <Accordion variant="contained">
                        <Accordion.Item value="participant-copy">
                          <Accordion.Control>
                            Textos e instrucciones
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Stack gap="lg">
                              <TextInput
                                label="Título para participantes"
                                description="Por defecto puede ser igual al nombre del experimento."
                                required
                                disabled={experiment.data.status !== "draft"}
                                {...form.getInputProps("participantTitle")}
                              />
                              <Textarea
                                label="Introducción"
                                minRows={3}
                                autosize
                                required
                                disabled={experiment.data.status !== "draft"}
                                {...form.getInputProps("introduction")}
                              />
                              <Textarea
                                label="Consentimiento"
                                minRows={3}
                                autosize
                                required
                                disabled={experiment.data.status !== "draft"}
                                {...form.getInputProps("consentText")}
                              />
                              <Textarea
                                label="Instrucciones de reconstrucción"
                                minRows={3}
                                autosize
                                required
                                disabled={experiment.data.status !== "draft"}
                                {...form.getInputProps("recallInstructions")}
                              />
                            </Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      </Accordion>
                      <Group justify="flex-end">
                        {experiment.data.status === "draft" && (
                          <Button
                            type="submit"
                            leftSection={<IconDeviceFloppy size={18} />}
                            loading={updateDraft.isExecuting}
                            disabled={!form.isDirty()}
                          >
                            Guardar cambios
                          </Button>
                        )}
                      </Group>
                    </Stack>
                  </form>
                </Card>

                {experiment.data.status !== "draft" && (
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={2}>Respuestas</Title>
                      <Button
                        variant="default"
                        leftSection={<IconDownload size={18} />}
                        disabled={
                          !sessions.data?.some(
                            (session) => session.status === "submitted",
                          )
                        }
                        onClick={exportResponses}
                      >
                        Descargar CSV
                      </Button>
                    </Group>
                    <SimpleGrid cols={{ base: 1, xs: 3 }}>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          Iniciadas
                        </Text>
                        <Text size="xl" fw={700}>
                          {sessions.data?.length ?? 0}
                        </Text>
                      </Card>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          En curso
                        </Text>
                        <Text size="xl" fw={700}>
                          {sessions.data?.filter(
                            (session) => session.status !== "submitted",
                          ).length ?? 0}
                        </Text>
                      </Card>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          Completadas
                        </Text>
                        <Text size="xl" fw={700}>
                          {sessions.data?.filter(
                            (session) => session.status === "submitted",
                          ).length ?? 0}
                        </Text>
                      </Card>
                    </SimpleGrid>
                    {sessions.isLoading && <Loader size="sm" />}
                    {sessions.isError && (
                      <Card withBorder>
                        <Text c="red">
                          No se pudieron cargar las respuestas.
                        </Text>
                      </Card>
                    )}
                    {sessions.data?.length === 0 && (
                      <Card withBorder>
                        <Text c="dimmed">Todavía no hay participaciones.</Text>
                      </Card>
                    )}
                    {sessions.data?.map((session) => (
                      <Card
                        key={session.id}
                        component={Link}
                        href={`/experiments/${experimentId}/responses/${session.id}`}
                        withBorder
                        padding="lg"
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Stack gap={4} style={{ minWidth: 0 }}>
                            <Group gap="xs">
                              <Badge
                                variant="light"
                                color={sessionStatus[session.status].color}
                              >
                                {sessionStatus[session.status].label}
                              </Badge>
                              <Text size="sm" c="dimmed">
                                {new Date(session.startedAt).toLocaleString(
                                  "es-AR",
                                )}
                              </Text>
                            </Group>
                            <Text
                              lineClamp={2}
                              c={session.recallText ? undefined : "dimmed"}
                            >
                              {session.recallText ??
                                "Todavía no envió una respuesta."}
                            </Text>
                          </Stack>
                          <IconChevronRight size={20} />
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>

      <Modal
        opened={publishOpened}
        onClose={publishModal.close}
        title="Publicar experimento"
        centered
      >
        <Stack>
          <Text>
            Al publicar, el experimento quedará bloqueado para que todas las
            personas reciban exactamente la misma experiencia.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={publishModal.close}>
              Cancelar
            </Button>
            <Button
              leftSection={<IconRocket size={18} />}
              loading={publish.isExecuting}
              onClick={() => void handlePublish()}
            >
              Confirmar publicación
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={closeOpened}
        onClose={closeModal.close}
        title="Cerrar recepción"
        centered
      >
        <Stack>
          <Text>
            No se podrán iniciar nuevas participaciones ni enviar respuestas
            pendientes.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal.close}>
              Cancelar
            </Button>
            <Button
              color="red"
              leftSection={<IconLock size={18} />}
              loading={close.isExecuting}
              onClick={() => void handleClose()}
            >
              Cerrar recepción
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
};

export default ExperimentWorkspacePage;

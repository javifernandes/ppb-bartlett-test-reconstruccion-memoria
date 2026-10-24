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
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Table,
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
  IconLanguage,
  IconQrcode,
  IconRefresh,
  IconRocket,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { AdminHeader } from "@/app/admin-header";
import { useI18n } from "@/app/i18n";
import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
} from "@/generated/client-entities";
import { createId } from "@/lib/create-id";

const ExperimentWorkspace = Experiment.view("ExperimentWorkspace", {
  id: true,
  title: true,
  participantTitle: true,
  introduction: true,
  consentText: true,
  story: true,
  recallInstructions: true,
  primaryLanguage: true,
  alternateLanguage: true,
  alternateParticipantTitle: true,
  alternateIntroduction: true,
  alternateConsentText: true,
  alternateStory: true,
  alternateRecallInstructions: true,
  intervalSeconds: true,
  distractorEnabled: true,
  status: true,
  createdAt: true,
  publishedAt: true,
  publicToken: true,
});

const ParticipantSessionRow = ParticipantSession.view("ParticipantSessionRow", {
  id: true,
  contentLanguage: true,
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

const elapsedNumber = (from?: string | null, to?: string | null) => {
  const value = elapsedSeconds(from, to);
  return value ? Number(value) : undefined;
};

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainder} s` : `${remainder} s`;
};

type SessionFilter = "all" | "submitted" | "reading" | "interval" | "recalling";

const ExperimentWorkspacePage = () => {
  const { locale, t } = useI18n();
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
  const [publishOpened, publishModal] = useDisclosure(false);
  const [closeOpened, closeModal] = useDisclosure(false);
  const [deleteOpened, deleteModal] = useDisclosure(false);
  const [qrOpened, qrModal] = useDisclosure(false);
  const [publicOrigin, setPublicOrigin] = useState("");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [languageFilter, setLanguageFilter] = useState<"all" | "es" | "en">(
    "all",
  );
  const [sessionSearch, setSessionSearch] = useState("");
  const [visibleSessionCount, setVisibleSessionCount] = useState(20);
  const updateDraft = useOperation(Experiment.domain.updateDraft);
  const publish = useOperation(Experiment.domain.publish, {
    onSuccess: () => {
      notifications.show({
        title: "Experimento publicado",
        message: "El experimento quedó bloqueado para edición.",
        color: "teal",
      });
      window.location.reload();
    },
  });
  const close = useOperation(Experiment.domain.close, {
    onSuccess: () => {
      closeModal.close();
      notifications.show({
        title: "Recepción cerrada",
        message: "El experimento ya no acepta nuevas respuestas.",
        color: "teal",
      });
    },
  });
  const deletePermanently = useOperation(Experiment.domain.deletePermanently, {
    onSuccess: () => {
      notifications.show({
        title: "Experimento eliminado",
        message: experiment.data?.title ?? "El experimento fue eliminado.",
        color: "teal",
      });
      window.location.replace("/");
    },
  });
  const startAnalysis = useOperation(AnalysisRun.domain.start);
  const analyzeRecall = useOperation(RecallAnalysis.domain.analyze);
  const finishAnalysis = useOperation(AnalysisRun.domain.finish);
  const form = useForm<{
    title: string;
    participantTitle: string;
    introduction: string;
    consentText: string;
    story: string;
    recallInstructions: string;
    primaryLanguage: "es" | "en";
    alternateLanguage: "" | "es" | "en";
    alternateParticipantTitle: string;
    alternateIntroduction: string;
    alternateConsentText: string;
    alternateStory: string;
    alternateRecallInstructions: string;
    intervalSeconds: number;
    distractorEnabled: boolean;
  }>({
    initialValues: {
      title: "",
      participantTitle: "",
      introduction: "",
      consentText: "",
      story: "",
      recallInstructions: "",
      primaryLanguage: "es",
      alternateLanguage: "",
      alternateParticipantTitle: "",
      alternateIntroduction: "",
      alternateConsentText: "",
      alternateStory: "",
      alternateRecallInstructions: "",
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
      alternateParticipantTitle: (value, values) =>
        !values.alternateLanguage || value.trim()
          ? null
          : "Ingresá el título de la variante.",
      alternateIntroduction: (value, values) =>
        !values.alternateLanguage || value.trim()
          ? null
          : "Ingresá la introducción de la variante.",
      alternateConsentText: (value, values) =>
        !values.alternateLanguage || value.trim()
          ? null
          : "Ingresá el consentimiento de la variante.",
      alternateStory: (value, values) =>
        !values.alternateLanguage || value.trim()
          ? null
          : "Ingresá la historia de la variante.",
      alternateRecallInstructions: (value, values) =>
        !values.alternateLanguage || value.trim()
          ? null
          : "Ingresá las instrucciones de la variante.",
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
        primaryLanguage: experiment.data.primaryLanguage,
        alternateLanguage: experiment.data.alternateLanguage ?? "",
        alternateParticipantTitle:
          experiment.data.alternateParticipantTitle ?? "",
        alternateIntroduction: experiment.data.alternateIntroduction ?? "",
        alternateConsentText: experiment.data.alternateConsentText ?? "",
        alternateStory: experiment.data.alternateStory ?? "",
        alternateRecallInstructions:
          experiment.data.alternateRecallInstructions ?? "",
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
      primaryLanguage: values.primaryLanguage,
      alternateLanguage: values.alternateLanguage || null,
      alternateParticipantTitle: values.alternateLanguage
        ? values.alternateParticipantTitle
        : null,
      alternateIntroduction: values.alternateLanguage
        ? values.alternateIntroduction
        : null,
      alternateConsentText: values.alternateLanguage
        ? values.alternateConsentText
        : null,
      alternateStory: values.alternateLanguage ? values.alternateStory : null,
      alternateRecallInstructions: values.alternateLanguage
        ? values.alternateRecallInstructions
        : null,
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
    publishModal.close();
    const result = await publish.executeAsync({
      experiment: Experiment.refById(experimentId),
      publishedAt: new Date().toISOString(),
      publicToken: createId(),
    });

    if (!result.ok) {
      publishModal.open();
      notifications.show({
        title: "No se pudo publicar",
        message: result.message,
        color: "red",
      });
    }
  };

  const copyPublicLink = async (publicToken: string) => {
    const url = `${window.location.origin}/p/${publicToken}`;
    await navigator.clipboard.writeText(url);
    notifications.show({
      title: t("Enlace copiado"),
      message: t("Ya podés compartirlo con participantes."),
      color: "teal",
    });
  };

  const openQr = () => {
    setPublicOrigin(window.location.origin);
    qrModal.open();
  };

  const handleClose = async () => {
    const result = await close.executeAsync({
      experiment: Experiment.refById(experimentId),
    });

    if (!result.ok) {
      notifications.show({
        title: "No se pudo cerrar el experimento",
        message: result.message,
        color: "red",
      });
    }
  };

  const handleDelete = async () => {
    const result = await deletePermanently.executeAsync({
      experiment: Experiment.refById(experimentId),
    });

    if (!result.ok) {
      notifications.show({
        title: "No se pudo eliminar el experimento",
        message: result.message,
        color: "red",
      });
    }
  };

  const exportResponses = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = (sessions.data ?? [])
      .filter((session) => session.status === "submitted")
      .map((session) =>
        [
          session.id,
          session.status,
          session.contentLanguage,
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
      "id_sesion,estado,idioma_contenido,inicio,inicio_intervalo,inicio_reconstruccion,envio,ultima_actividad,duracion_total_segundos,duracion_lectura_segundos,duracion_reconstruccion_segundos,reconstruccion",
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

    const id = createId();
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
          id: createId(),
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

  const sessionRows = sessions.data ?? [];
  const completedSessions = sessionRows.filter(
    (session) => session.status === "submitted",
  );
  const activeSessions = sessionRows.filter(
    (session) => session.status !== "submitted",
  );
  const completionRate =
    sessionRows.length > 0
      ? Math.round((completedSessions.length / sessionRows.length) * 100)
      : 0;
  const completedDurations = completedSessions.flatMap((session) => {
    const duration = elapsedNumber(session.startedAt, session.submittedAt);
    return duration === undefined ? [] : [duration];
  });
  const averageDuration =
    completedDurations.length > 0
      ? Math.round(
          completedDurations.reduce((total, value) => total + value, 0) /
            completedDurations.length,
        )
      : undefined;
  const latestActivity = sessionRows.reduce<string | undefined>(
    (latest, session) =>
      !latest || Date.parse(session.lastActivityAt) > Date.parse(latest)
        ? session.lastActivityAt
        : latest,
    undefined,
  );
  const filteredSessions = sessionRows.filter((session) => {
    if (sessionFilter !== "all" && session.status !== sessionFilter)
      return false;
    if (languageFilter !== "all" && session.contentLanguage !== languageFilter)
      return false;
    const search = sessionSearch.trim().toLocaleLowerCase();
    return (
      !search ||
      session.id.toLocaleLowerCase().includes(search) ||
      session.recallText?.toLocaleLowerCase().includes(search)
    );
  });
  const visibleSessions = filteredSessions.slice(0, visibleSessionCount);
  const latestActivityLabel = latestActivity
    ? new Date(latestActivity).toLocaleString(
        locale === "es" ? "es-AR" : "en-US",
        { dateStyle: "short", timeStyle: "short" },
      )
    : "—";

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AdminHeader
        section={experiment.data?.title ?? t("Experimento")}
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
                <Text c="red">{t("No se pudo cargar el experimento.")}</Text>
              </Card>
            )}

            {experiment.data && (
              <>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <div>
                    <Title order={1}>{experiment.data.title}</Title>
                    <Text c="dimmed">
                      {experiment.data.status === "published"
                        ? t("Recolección en curso")
                        : experiment.data.status === "closed"
                          ? t("Resultados del experimento")
                          : t("Configuración del experimento")}
                    </Text>
                  </div>
                  <Group>
                    <Badge
                      variant="light"
                      color={
                        experiment.data.status === "published" ? "teal" : "gray"
                      }
                    >
                      {experiment.data.status === "published"
                        ? t("Publicado")
                        : experiment.data.status === "closed"
                          ? t("Cerrado")
                          : t("Borrador")}
                    </Badge>
                    <Button
                      component={Link}
                      href={`/experiments/${experimentId}/preview`}
                      variant="default"
                      leftSection={<IconEye size={18} />}
                    >
                      {t("Vista previa")}
                    </Button>
                    {experiment.data.status === "draft" && (
                      <Button
                        leftSection={<IconRocket size={18} />}
                        onClick={publishModal.open}
                        disabled={form.isDirty()}
                      >
                        {t("Publicar")}
                      </Button>
                    )}
                    {experiment.data.status === "published" && (
                      <Button
                        color="red"
                        variant="light"
                        leftSection={<IconLock size={18} />}
                        onClick={closeModal.open}
                      >
                        {t("Cerrar recepción")}
                      </Button>
                    )}
                    {experiment.data.status === "closed" && (
                      <>
                        {analysisRuns.data?.length ? (
                          <Button
                            leftSection={<IconChartBar size={18} />}
                            onClick={() => void handleAnalysis()}
                          >
                            {t("Ver último análisis")}
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
                            ? t("Analizar nuevamente")
                            : t("Analizar resultados")}
                        </Button>
                      </>
                    )}
                  </Group>
                </Group>

                {experiment.data.status === "published" &&
                  experiment.data.publicToken && (
                    <Card
                      withBorder
                      padding="xl"
                      style={{
                        borderColor: "var(--mantine-color-teal-7)",
                        background:
                          "linear-gradient(135deg, color-mix(in srgb, var(--mantine-color-teal-9) 18%, transparent), transparent 65%)",
                      }}
                    >
                      <Stack gap="md">
                        <div>
                          <Title order={2}>{t("Compartir experimento")}</Title>
                          <Text c="dimmed" size="sm">
                            {t(
                              "Compartí el enlace o mostrá el código QR para sumar participantes.",
                            )}
                          </Text>
                        </div>
                        <Group align="flex-end">
                          <TextInput
                            aria-label={t("Enlace para participantes")}
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
                            {t("Copiar")}
                          </Button>
                          <Button
                            variant="light"
                            leftSection={<IconQrcode size={18} />}
                            onClick={openQr}
                          >
                            {t("Mostrar QR")}
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  )}

                {experiment.data.status === "draft" && (
                  <Card withBorder padding="lg">
                    <form onSubmit={handleSave}>
                      <Stack gap="lg">
                        <TextInput
                          label={t("Nombre del experimento")}
                          description={t("Sólo lo ven los administradores.")}
                          required
                          disabled={experiment.data.status !== "draft"}
                          {...form.getInputProps("title")}
                        />
                        <Textarea
                          label={t("Historia")}
                          description={t(
                            "El texto se mostrará a los participantes durante la etapa de lectura.",
                          )}
                          minRows={12}
                          autosize
                          required
                          disabled={experiment.data.status !== "draft"}
                          {...form.getInputProps("story")}
                        />
                        <NumberInput
                          label={t("Intervalo antes de reconstruir")}
                          description={t(
                            "Duración en segundos. Usá 0 para pasar directamente.",
                          )}
                          min={0}
                          max={3600}
                          suffix=" s"
                          disabled={experiment.data.status !== "draft"}
                          {...form.getInputProps("intervalSeconds")}
                        />
                        <Switch
                          label={t("Usar distractor durante el intervalo")}
                          disabled={experiment.data.status !== "draft"}
                          {...form.getInputProps("distractorEnabled", {
                            type: "checkbox",
                          })}
                        />
                        <Accordion variant="contained">
                          <Accordion.Item value="participant-copy">
                            <Accordion.Control>
                              {t("Textos e instrucciones")}
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
                          <Accordion.Item value="languages">
                            <Accordion.Control
                              icon={<IconLanguage size={18} />}
                            >
                              {t("Idiomas y variantes")}
                            </Accordion.Control>
                            <Accordion.Panel>
                              <Stack gap="lg">
                                <Select
                                  label={t("Idioma principal del contenido")}
                                  description={t(
                                    "No afecta el idioma de la interfaz administrativa.",
                                  )}
                                  data={[
                                    { value: "es", label: "Español" },
                                    { value: "en", label: "English" },
                                  ]}
                                  allowDeselect={false}
                                  disabled={
                                    experiment.data.status !== "draft" ||
                                    Boolean(form.values.alternateLanguage)
                                  }
                                  {...form.getInputProps("primaryLanguage")}
                                />
                                {!form.values.alternateLanguage ? (
                                  <div>
                                    <Button
                                      type="button"
                                      variant="light"
                                      disabled={
                                        experiment.data.status !== "draft"
                                      }
                                      onClick={() =>
                                        form.setFieldValue(
                                          "alternateLanguage",
                                          form.values.primaryLanguage === "es"
                                            ? "en"
                                            : "es",
                                        )
                                      }
                                    >
                                      {t("Agregar variante en otro idioma")}
                                    </Button>
                                  </div>
                                ) : (
                                  <Stack gap="md">
                                    <Group justify="space-between">
                                      <div>
                                        <Text fw={600}>
                                          {form.values.alternateLanguage ===
                                          "en"
                                            ? "English"
                                            : "Español"}
                                        </Text>
                                        <Text size="sm" c="dimmed">
                                          {t(
                                            "Los participantes podrán elegir esta versión antes de comenzar.",
                                          )}
                                        </Text>
                                      </div>
                                      {experiment.data.status === "draft" && (
                                        <Button
                                          type="button"
                                          variant="subtle"
                                          color="red"
                                          onClick={() => {
                                            form.setValues({
                                              alternateLanguage: "",
                                              alternateParticipantTitle: "",
                                              alternateIntroduction: "",
                                              alternateConsentText: "",
                                              alternateStory: "",
                                              alternateRecallInstructions: "",
                                            });
                                          }}
                                        >
                                          {t("Quitar variante")}
                                        </Button>
                                      )}
                                    </Group>
                                    <TextInput
                                      label={t("Título para participantes")}
                                      required
                                      disabled={
                                        experiment.data.status !== "draft"
                                      }
                                      {...form.getInputProps(
                                        "alternateParticipantTitle",
                                      )}
                                    />
                                    <Textarea
                                      label={t("Introducción")}
                                      minRows={3}
                                      autosize
                                      required
                                      disabled={
                                        experiment.data.status !== "draft"
                                      }
                                      {...form.getInputProps(
                                        "alternateIntroduction",
                                      )}
                                    />
                                    <Textarea
                                      label={t("Consentimiento")}
                                      minRows={3}
                                      autosize
                                      required
                                      disabled={
                                        experiment.data.status !== "draft"
                                      }
                                      {...form.getInputProps(
                                        "alternateConsentText",
                                      )}
                                    />
                                    <Textarea
                                      label={t("Historia")}
                                      minRows={10}
                                      autosize
                                      required
                                      disabled={
                                        experiment.data.status !== "draft"
                                      }
                                      {...form.getInputProps("alternateStory")}
                                    />
                                    <Textarea
                                      label={t(
                                        "Instrucciones de reconstrucción",
                                      )}
                                      minRows={3}
                                      autosize
                                      required
                                      disabled={
                                        experiment.data.status !== "draft"
                                      }
                                      {...form.getInputProps(
                                        "alternateRecallInstructions",
                                      )}
                                    />
                                  </Stack>
                                )}
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
                )}

                {experiment.data.status !== "draft" && (
                  <Stack gap="xl">
                    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          {t("Iniciadas")}
                        </Text>
                        <Text size="xl" fw={700}>
                          {sessionRows.length}
                        </Text>
                      </Card>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          {t("Completadas")}
                        </Text>
                        <Text size="xl" fw={700}>
                          {completedSessions.length}
                        </Text>
                      </Card>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          {t("En curso")}
                        </Text>
                        <Text size="xl" fw={700}>
                          {activeSessions.length}
                        </Text>
                      </Card>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          {t("Finalización")}
                        </Text>
                        <Text size="xl" fw={700}>
                          {completionRate} %
                        </Text>
                        <Progress value={completionRate} mt={6} size="xs" />
                      </Card>
                      <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                          {t("Duración promedio")}
                        </Text>
                        <Text size="xl" fw={700}>
                          {formatDuration(averageDuration)}
                        </Text>
                      </Card>
                    </SimpleGrid>

                    <Card withBorder padding="lg">
                      <Stack gap="md">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Title order={2}>{t("Respuestas")}</Title>
                            <Text c="dimmed" size="sm">
                              {t("Última actividad")}: {latestActivityLabel}
                            </Text>
                          </div>
                          <Button
                            variant="default"
                            leftSection={<IconDownload size={18} />}
                            disabled={completedSessions.length === 0}
                            onClick={exportResponses}
                          >
                            {t("Descargar CSV")}
                          </Button>
                        </Group>

                        <Group align="flex-end" grow wrap="wrap">
                          <Select
                            label={t("Estado")}
                            value={sessionFilter}
                            data={[
                              { value: "all", label: t("Todas") },
                              { value: "submitted", label: t("Completadas") },
                              { value: "reading", label: t("Leyendo") },
                              { value: "interval", label: t("En intervalo") },
                              {
                                value: "recalling",
                                label: t("Reconstruyendo"),
                              },
                            ]}
                            allowDeselect={false}
                            onChange={(value) => {
                              setSessionFilter(
                                (value ?? "all") as SessionFilter,
                              );
                              setVisibleSessionCount(20);
                            }}
                          />
                          {experiment.data.alternateLanguage && (
                            <Select
                              label={t("Idioma")}
                              value={languageFilter}
                              data={[
                                { value: "all", label: t("Todos") },
                                { value: "es", label: "Español" },
                                { value: "en", label: "English" },
                              ]}
                              allowDeselect={false}
                              onChange={(value) => {
                                setLanguageFilter(
                                  (value ?? "all") as "all" | "es" | "en",
                                );
                                setVisibleSessionCount(20);
                              }}
                            />
                          )}
                          <TextInput
                            label={t("Buscar")}
                            placeholder={t("ID o texto de la respuesta")}
                            value={sessionSearch}
                            onChange={(event) => {
                              setSessionSearch(event.currentTarget.value);
                              setVisibleSessionCount(20);
                            }}
                          />
                        </Group>

                        {sessions.isLoading && <Loader size="sm" />}
                        {sessions.isError && (
                          <Text c="red">
                            {t("No se pudieron cargar las respuestas.")}
                          </Text>
                        )}
                        {!sessions.isLoading &&
                          filteredSessions.length === 0 && (
                            <Paper withBorder p="lg">
                              <Text c="dimmed">
                                {sessionRows.length === 0
                                  ? t("Todavía no hay participaciones.")
                                  : t("No hay respuestas para estos filtros.")}
                              </Text>
                            </Paper>
                          )}
                        {visibleSessions.length > 0 && (
                          <Table.ScrollContainer minWidth={720}>
                            <Table verticalSpacing="sm" highlightOnHover>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>{t("Estado")}</Table.Th>
                                  <Table.Th>{t("Inicio")}</Table.Th>
                                  <Table.Th>{t("Idioma")}</Table.Th>
                                  <Table.Th>{t("Duración")}</Table.Th>
                                  <Table.Th>{t("Palabras")}</Table.Th>
                                  <Table.Th />
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {visibleSessions.map((session) => (
                                  <Table.Tr key={session.id}>
                                    <Table.Td>
                                      <Badge
                                        variant="light"
                                        color={
                                          sessionStatus[session.status].color
                                        }
                                      >
                                        {t(sessionStatus[session.status].label)}
                                      </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text size="sm">
                                        {new Date(
                                          session.startedAt,
                                        ).toLocaleString(
                                          locale === "es" ? "es-AR" : "en-US",
                                          {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                          },
                                        )}
                                      </Text>
                                      <Text size="xs" c="dimmed" ff="monospace">
                                        {session.id.slice(0, 8)}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      {session.contentLanguage.toUpperCase()}
                                    </Table.Td>
                                    <Table.Td>
                                      {formatDuration(
                                        elapsedNumber(
                                          session.startedAt,
                                          session.submittedAt ??
                                            session.lastActivityAt,
                                        ),
                                      )}
                                    </Table.Td>
                                    <Table.Td>
                                      {session.recallText
                                        ? (session.recallText.match(
                                            /[\p{L}\p{N}]+/gu,
                                          )?.length ?? 0)
                                        : "—"}
                                    </Table.Td>
                                    <Table.Td ta="right">
                                      <Button
                                        component={Link}
                                        href={`/experiments/${experimentId}/responses/${session.id}`}
                                        variant="subtle"
                                        size="compact-sm"
                                        rightSection={
                                          <IconChevronRight size={16} />
                                        }
                                      >
                                        {t("Ver")}
                                      </Button>
                                    </Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </Table.ScrollContainer>
                        )}
                        {visibleSessionCount < filteredSessions.length && (
                          <Group justify="center">
                            <Button
                              variant="default"
                              onClick={() =>
                                setVisibleSessionCount((count) => count + 20)
                              }
                            >
                              {t("Cargar más")} ·{" "}
                              {filteredSessions.length - visibleSessionCount}
                            </Button>
                          </Group>
                        )}
                      </Stack>
                    </Card>

                    <Accordion variant="contained">
                      <Accordion.Item value="configuration">
                        <Accordion.Control>
                          {t("Ver configuración del experimento")}
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="lg">
                            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                              <div>
                                <Text size="sm" c="dimmed">
                                  {t("Idioma principal del contenido")}
                                </Text>
                                <Text fw={600}>
                                  {experiment.data.primaryLanguage === "es"
                                    ? "Español"
                                    : "English"}
                                </Text>
                              </div>
                              <div>
                                <Text size="sm" c="dimmed">
                                  {t("Intervalo")}
                                </Text>
                                <Text fw={600}>
                                  {experiment.data.intervalSeconds > 0
                                    ? `${experiment.data.intervalSeconds} s`
                                    : t("Sin intervalo")}
                                </Text>
                              </div>
                              <div>
                                <Text size="sm" c="dimmed">
                                  {t("Distractor")}
                                </Text>
                                <Text fw={600}>
                                  {experiment.data.distractorEnabled
                                    ? t("Activado")
                                    : t("Desactivado")}
                                </Text>
                              </div>
                            </SimpleGrid>
                            <div>
                              <Text size="sm" c="dimmed" mb={4}>
                                {t("Historia")}
                              </Text>
                              <Text style={{ whiteSpace: "pre-wrap" }}>
                                {experiment.data.story}
                              </Text>
                            </div>
                            {experiment.data.alternateStory && (
                              <div>
                                <Text size="sm" c="dimmed" mb={4}>
                                  {t("Variante en otro idioma")}
                                </Text>
                                <Text style={{ whiteSpace: "pre-wrap" }}>
                                  {experiment.data.alternateStory}
                                </Text>
                              </div>
                            )}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  </Stack>
                )}

                <Card withBorder padding="lg">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <div>
                      <Text fw={600}>{t("Eliminar experimento")}</Text>
                      <Text c="dimmed" size="sm">
                        {t(
                          "Borra también todas sus participaciones y análisis.",
                        )}
                      </Text>
                    </div>
                    <Button
                      color="red"
                      variant="light"
                      leftSection={<IconTrash size={18} />}
                      onClick={deleteModal.open}
                    >
                      {t("Eliminar")}
                    </Button>
                  </Group>
                </Card>
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>

      <Modal
        opened={qrOpened}
        onClose={qrModal.close}
        title={t("Código QR para participantes")}
        centered
        size="auto"
      >
        <Stack align="center" gap="lg">
          <Text c="dimmed" ta="center">
            {t("Escaneá el código para abrir el experimento.")}
          </Text>
          {publicOrigin && experiment.data?.publicToken ? (
            <Card bg="white" p="md" radius="md">
              <QRCodeSVG
                value={`${publicOrigin}/p/${experiment.data.publicToken}`}
                size={280}
                marginSize={1}
                level="M"
              />
            </Card>
          ) : (
            <Loader />
          )}
          <Text
            size="xs"
            c="dimmed"
            ta="center"
            maw={320}
            style={{ overflowWrap: "anywhere" }}
          >
            {publicOrigin && experiment.data?.publicToken
              ? `${publicOrigin}/p/${experiment.data.publicToken}`
              : ""}
          </Text>
        </Stack>
      </Modal>

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

      <Modal
        opened={deleteOpened}
        onClose={deleteModal.close}
        title={t("Eliminar experimento")}
        centered
      >
        <Stack>
          <Text>
            {t("Vas a eliminar definitivamente")}{" "}
            <strong>{experiment.data?.title}</strong>.
          </Text>
          <Text c="dimmed">
            {t(
              "También se borrarán todas las participaciones, respuestas y corridas de análisis asociadas. Esta acción no se puede deshacer.",
            )}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={deleteModal.close}>
              {t("Cancelar")}
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={18} />}
              loading={deletePermanently.isExecuting}
              onClick={() => void handleDelete()}
            >
              {t("Eliminar definitivamente")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
};

export default ExperimentWorkspacePage;

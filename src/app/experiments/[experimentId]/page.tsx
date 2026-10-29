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
  IconBook,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconLock,
  IconLanguage,
  IconPencil,
  IconQrcode,
  IconRocket,
  IconSettings,
  IconTrash,
  IconUsersGroup,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { AdminHeader } from "@/app/admin-header";
import { useI18n } from "@/app/i18n";
import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
  ShareChannel,
} from "@/generated/client-entities";
import { createId } from "@/lib/create-id";
import {
  ExperimentWorkspaceTabs,
  type ExperimentWorkspaceSection,
} from "./workspace-tabs";

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
  analysisRunId: true,
  analysisRubrics: true,
  analysisPreparedAt: true,
});

const ParticipantSessionRow = ParticipantSession.view("ParticipantSessionRow", {
  id: true,
  shareChannel: true,
  contentLanguage: true,
  countryCode: true,
  browserLocale: true,
  timezone: true,
  deviceType: true,
  browser: true,
  operatingSystem: true,
  screenWidth: true,
  screenHeight: true,
  status: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  lastActivityAt: true,
  recallText: true,
  submittedAt: true,
});

const ShareChannelRow = ShareChannel.view("ShareChannelRow", {
  id: true,
  name: true,
  status: true,
  createdAt: true,
});

const AnalysisRunRow = AnalysisRun.view("AnalysisRunRow", {
  id: true,
  status: true,
  analyzerVersion: true,
  createdAt: true,
});

const SessionAnalysisRow = RecallAnalysis.view("SessionAnalysisRow", {
  id: true,
  run: true,
  session: true,
  status: true,
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

const countryFlag = (countryCode: string) =>
  /^[A-Z]{2}$/.test(countryCode)
    ? String.fromCodePoint(
        ...[...countryCode].map((letter) => 127397 + letter.charCodeAt(0)),
      )
    : "🌐";

const countryLabel = (countryCode: string) =>
  `${countryFlag(countryCode)} ${countryCode}`;

const languageFlag = (language: "es" | "en") =>
  language === "es" ? "🇪🇸" : "🇬🇧";

const languageLabel = (language: "es" | "en", full = false) =>
  language === "es"
    ? `${languageFlag(language)} ${full ? "Español" : "ES"}`
    : `${languageFlag(language)} ${full ? "English" : "EN"}`;

type SessionFilter = "all" | "submitted" | "reading" | "interval" | "recalling";

const ExperimentWorkspacePage = () => {
  const { locale, t } = useI18n();
  const { experimentId } = useParams<{ experimentId: string }>();
  const searchParams = useSearchParams();
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
  const shareChannelsQuery = useMemo(
    () =>
      ShareChannel.all()
        .where((channel) =>
          channel.experiment.eq(Experiment.refById(experimentId)),
        )
        .as(ShareChannelRow)
        .orderBy((channel) => channel.createdAt.asc()),
    [experimentId],
  );
  const shareChannels = useGraphQuery(shareChannelsQuery);
  const analysisRunsQuery = useMemo(
    () =>
      AnalysisRun.all()
        .where((run) => run.experiment.eq(Experiment.refById(experimentId)))
        .as(AnalysisRunRow)
        .orderBy((run) => run.createdAt.desc()),
    [experimentId],
  );
  const analysisRuns = useGraphQuery(analysisRunsQuery);
  const currentAnalysisRunId = experiment.data?.analysisRunId;
  const sessionAnalysesQuery = useMemo(
    () =>
      RecallAnalysis.all()
        .where((analysis) =>
          analysis.run.eq(
            AnalysisRun.refById(currentAnalysisRunId ?? "missing-run"),
          ),
        )
        .as(SessionAnalysisRow),
    [currentAnalysisRunId],
  );
  const sessionAnalyses = useGraphQuery(sessionAnalysesQuery);
  const [publishOpened, publishModal] = useDisclosure(false);
  const [closeOpened, closeModal] = useDisclosure(false);
  const [deleteOpened, deleteModal] = useDisclosure(false);
  const [qrOpened, qrModal] = useDisclosure(false);
  const [publicOrigin, setPublicOrigin] = useState("");
  const [qrChannelId, setQrChannelId] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [languageFilter, setLanguageFilter] = useState<"all" | "es" | "en">(
    "all",
  );
  const [countryFilter, setCountryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sessionSearch, setSessionSearch] = useState("");
  const [visibleSessionCount, setVisibleSessionCount] = useState(20);
  const updateDraft = useOperation(Experiment.domain.updateDraft);
  const prepareAnalysis = useOperation(Experiment.domain.prepareAnalysis);
  const publish = useOperation(Experiment.domain.publish);
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
  const finishAnalysis = useOperation(AnalysisRun.domain.finish);
  const createShareChannel = useOperation(ShareChannel.domain.create);
  const disableShareChannel = useOperation(ShareChannel.domain.disable);
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
    if (!experiment.data) return;
    if (!experiment.data.analysisRubrics) {
      const prepared = await prepareAnalysis.executeAsync({
        experiment: Experiment.refById(experimentId),
        preparedAt: new Date().toISOString(),
      });
      if (!prepared.ok) {
        publishModal.open();
        notifications.show({
          title: "No se pudo preparar la historia",
          message: prepared.message,
          color: "red",
        });
        return;
      }
    }

    const analysisRunId = createId();
    const result = await publish.executeAsync({
      experiment: Experiment.refById(experimentId),
      publishedAt: new Date().toISOString(),
      publicToken: createId(),
      analysisRunId,
    });

    if (!result.ok) {
      publishModal.open();
      notifications.show({
        title: "No se pudo publicar",
        message: result.message,
        color: "red",
      });
      return;
    }

    const run = await startAnalysis.executeAsync({
      id: analysisRunId,
      experiment: Experiment.refById(experimentId),
      createdAt: new Date().toISOString(),
    });
    if (!run.ok) {
      notifications.show({
        title: "El experimento se publicó, pero el análisis no pudo iniciarse",
        message: run.message,
        color: "red",
      });
      return;
    }
    notifications.show({
      title: "Experimento publicado",
      message: "La historia quedó preparada para analizar cada respuesta.",
      color: "teal",
    });
    window.location.reload();
  };

  const handlePrepareAnalysis = async () => {
    const result = await prepareAnalysis.executeAsync({
      experiment: Experiment.refById(experimentId),
      preparedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      notifications.show({
        title: "No se pudo preparar la historia",
        message: result.message,
        color: "red",
      });
      return;
    }
    notifications.show({
      title: "Historia preparada",
      message: "Las unidades narrativas ya están listas.",
      color: "teal",
    });
    window.location.reload();
  };

  const participantUrl = (publicToken: string, channelId?: string | null) =>
    `${window.location.origin}/p/${publicToken}${channelId ? `?s=${encodeURIComponent(channelId)}` : ""}`;

  const copyPublicLink = async (
    publicToken: string,
    channelId?: string | null,
  ) => {
    const url = participantUrl(publicToken, channelId);
    await navigator.clipboard.writeText(url);
    notifications.show({
      title: t("Enlace copiado"),
      message: t("Ya podés compartirlo con participantes."),
      color: "teal",
    });
  };

  const openQr = (channelId?: string | null) => {
    setPublicOrigin(window.location.origin);
    setQrChannelId(channelId ?? null);
    qrModal.open();
  };

  const handleCreateShareChannel = async () => {
    const name = newChannelName.trim();
    if (!name) return;
    const result = await createShareChannel.executeAsync({
      id: createId(),
      experiment: Experiment.refById(experimentId),
      name,
      createdAt: new Date().toISOString(),
    });
    if (!result.ok) {
      notifications.show({
        title: t("No se pudo crear el enlace"),
        message: result.message,
        color: "red",
      });
      return;
    }
    setNewChannelName("");
    notifications.show({
      title: t("Enlace de difusión creado"),
      message: result.value.name,
      color: "teal",
    });
  };

  const handleDisableShareChannel = async (channelId: string) => {
    const result = await disableShareChannel.executeAsync({
      channel: ShareChannel.refById(channelId),
    });
    if (!result.ok) {
      notifications.show({
        title: t("No se pudo desactivar el enlace"),
        message: result.message,
        color: "red",
      });
    }
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
      return;
    }

    if (experiment.data?.analysisRunId) {
      await finishAnalysis.executeAsync({
        run: AnalysisRun.refById(experiment.data.analysisRunId),
        hasErrors: false,
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
          session.shareChannel
            ? (shareChannelNames.get(String(session.shareChannel.locator.id)) ??
              "")
            : t("Enlace general"),
          session.countryCode ?? "",
          session.browserLocale ?? "",
          session.timezone ?? "",
          session.deviceType ?? "",
          session.browser ?? "",
          session.operatingSystem ?? "",
          session.screenWidth?.toString() ?? "",
          session.screenHeight?.toString() ?? "",
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
      "id_sesion,estado,idioma_contenido,origen,pais,idioma_navegador,zona_horaria,tipo_dispositivo,navegador,sistema_operativo,ancho_pantalla,alto_pantalla,inicio,inicio_intervalo,inicio_reconstruccion,envio,ultima_actividad,duracion_total_segundos,duracion_lectura_segundos,duracion_reconstruccion_segundos,reconstruccion",
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

  const sessionRows = sessions.data ?? [];
  const shareChannelRows = shareChannels.data ?? [];
  const shareChannelNames = new Map(
    shareChannelRows.map((channel) => [channel.id, channel.name]),
  );
  const shareChannelCounts = sessionRows.reduce((counts, session) => {
    if (session.status !== "submitted") return counts;
    const id = session.shareChannel
      ? String(session.shareChannel.locator.id)
      : undefined;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
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
  const averageReadingDuration = (() => {
    const durations = completedSessions.flatMap((session) => {
      const duration = elapsedNumber(
        session.startedAt,
        session.intervalStartedAt ?? session.recallingStartedAt,
      );
      return duration === undefined ? [] : [duration];
    });
    return durations.length > 0
      ? Math.round(
          durations.reduce((total, value) => total + value, 0) /
            durations.length,
        )
      : undefined;
  })();
  const averageRecallDuration = (() => {
    const durations = completedSessions.flatMap((session) => {
      const duration = elapsedNumber(
        session.recallingStartedAt,
        session.submittedAt,
      );
      return duration === undefined ? [] : [duration];
    });
    return durations.length > 0
      ? Math.round(
          durations.reduce((total, value) => total + value, 0) /
            durations.length,
        )
      : undefined;
  })();
  const latestActivity = sessionRows.reduce<string | undefined>(
    (latest, session) =>
      !latest || Date.parse(session.lastActivityAt) > Date.parse(latest)
        ? session.lastActivityAt
        : latest,
    undefined,
  );
  const availableCountries = Array.from(
    new Set(
      sessionRows.flatMap((session) =>
        session.countryCode ? [session.countryCode] : [],
      ),
    ),
  ).sort();
  const filteredSessions = sessionRows.filter((session) => {
    if (sessionFilter !== "all" && session.status !== sessionFilter)
      return false;
    if (languageFilter !== "all" && session.contentLanguage !== languageFilter)
      return false;
    if (countryFilter !== "all" && session.countryCode !== countryFilter)
      return false;
    const sessionSource = session.shareChannel?.locator.id ?? "general";
    if (sourceFilter !== "all" && sessionSource !== sourceFilter) return false;
    const search = sessionSearch.trim().toLocaleLowerCase();
    return (
      !search ||
      session.id.toLocaleLowerCase().includes(search) ||
      session.recallText?.toLocaleLowerCase().includes(search)
    );
  });
  const visibleSessions = filteredSessions.slice(0, visibleSessionCount);
  const analyzedSessionIds = new Set(
    (sessionAnalyses.data ?? []).map((analysis) =>
      String(analysis.session.locator.id),
    ),
  );
  const latestActivityLabel = latestActivity
    ? new Date(latestActivity).toLocaleString(
        locale === "es" ? "es-AR" : "en-US",
        { dateStyle: "short", timeStyle: "short" },
      )
    : "—";
  const requestedView = searchParams.get("view");
  const workspaceSection: ExperimentWorkspaceSection =
    experiment.data?.status === "draft"
      ? "configuration"
      : requestedView === "responses" || requestedView === "configuration"
        ? requestedView
        : "summary";
  const latestAnalysisHref = analysisRuns.data?.[0]
    ? `/experiments/${experimentId}/analysis/${analysisRuns.data[0].id}`
    : undefined;

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
                  </Group>
                </Group>

                <ExperimentWorkspaceTabs
                  experimentId={experimentId}
                  current={workspaceSection}
                  isDraft={experiment.data.status === "draft"}
                  analysisHref={latestAnalysisHref}
                />

                {workspaceSection === "summary" &&
                  experiment.data.status === "published" &&
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
                            onClick={() => openQr()}
                          >
                            {t("Mostrar QR")}
                          </Button>
                        </Group>
                        <Accordion variant="separated">
                          <Accordion.Item value="distribution-links">
                            <Accordion.Control
                              icon={<IconSettings size={18} />}
                            >
                              {t("Opciones avanzadas")}
                            </Accordion.Control>
                            <Accordion.Panel>
                              <Stack gap="md">
                                <div>
                                  <Text fw={650}>
                                    {t("Enlaces de difusión")}
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    {t(
                                      "Creá enlaces distintos para conocer desde qué grupo llegaron las respuestas.",
                                    )}
                                  </Text>
                                </div>
                                {shareChannels.isLoading && (
                                  <Loader size="sm" />
                                )}
                                {shareChannels.isError && (
                                  <Text c="red" size="sm">
                                    {t(
                                      "No se pudieron cargar los enlaces de difusión.",
                                    )}
                                  </Text>
                                )}
                                {shareChannelRows.map((channel) => (
                                  <Paper key={channel.id} withBorder p="sm">
                                    <Group
                                      justify="space-between"
                                      align="center"
                                      wrap="wrap"
                                    >
                                      <div>
                                        <Group gap="xs">
                                          <Text fw={600}>{channel.name}</Text>
                                          {channel.status === "disabled" && (
                                            <Badge color="gray" variant="light">
                                              {t("Desactivado")}
                                            </Badge>
                                          )}
                                        </Group>
                                        <Text size="xs" c="dimmed">
                                          {t("{count} respuestas", {
                                            count:
                                              shareChannelCounts.get(
                                                channel.id,
                                              ) ?? 0,
                                          })}
                                        </Text>
                                      </div>
                                      <Group gap="xs">
                                        <Button
                                          size="compact-sm"
                                          variant="default"
                                          leftSection={<IconCopy size={15} />}
                                          disabled={
                                            channel.status === "disabled"
                                          }
                                          onClick={() =>
                                            void copyPublicLink(
                                              experiment.data
                                                ?.publicToken as string,
                                              channel.id,
                                            )
                                          }
                                        >
                                          {t("Copiar")}
                                        </Button>
                                        <Button
                                          size="compact-sm"
                                          variant="light"
                                          leftSection={<IconQrcode size={15} />}
                                          disabled={
                                            channel.status === "disabled"
                                          }
                                          onClick={() => openQr(channel.id)}
                                        >
                                          QR
                                        </Button>
                                        {channel.status === "active" && (
                                          <Button
                                            size="compact-sm"
                                            variant="subtle"
                                            color="red"
                                            loading={
                                              disableShareChannel.isExecuting
                                            }
                                            onClick={() =>
                                              void handleDisableShareChannel(
                                                channel.id,
                                              )
                                            }
                                          >
                                            {t("Desactivar")}
                                          </Button>
                                        )}
                                      </Group>
                                    </Group>
                                  </Paper>
                                ))}
                                <Group align="flex-end" wrap="wrap">
                                  <TextInput
                                    label={t("Nombre del enlace")}
                                    placeholder={t(
                                      "Ej. Familia, Trabajo, María",
                                    )}
                                    value={newChannelName}
                                    maxLength={80}
                                    style={{ flex: 1 }}
                                    onChange={(event) =>
                                      setNewChannelName(
                                        event.currentTarget.value,
                                      )
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void handleCreateShareChannel();
                                      }
                                    }}
                                  />
                                  <Button
                                    loading={createShareChannel.isExecuting}
                                    disabled={!newChannelName.trim()}
                                    onClick={() =>
                                      void handleCreateShareChannel()
                                    }
                                  >
                                    {t("Crear enlace")}
                                  </Button>
                                </Group>
                              </Stack>
                            </Accordion.Panel>
                          </Accordion.Item>
                        </Accordion>
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
                        <Card withBorder padding="md">
                          <Stack gap="md">
                            <Group justify="space-between" align="flex-start">
                              <div>
                                <Text fw={650}>
                                  {t("Preparación del análisis")}
                                </Text>
                                <Text size="sm" c="dimmed">
                                  {experiment.data.analysisRubrics
                                    ? t(
                                        "La historia está lista para analizar respuestas.",
                                      )
                                    : t(
                                        "Detectá las unidades narrativas antes de publicar.",
                                      )}
                                </Text>
                              </div>
                              <Badge
                                variant="light"
                                color={
                                  experiment.data.analysisRubrics
                                    ? "teal"
                                    : "yellow"
                                }
                              >
                                {experiment.data.analysisRubrics
                                  ? t("Lista")
                                  : t("Pendiente")}
                              </Badge>
                            </Group>
                            {Boolean(experiment.data.analysisRubrics) && (
                              <Accordion variant="separated">
                                <Accordion.Item value="prepared-units">
                                  <Accordion.Control>
                                    {t("Ver unidades detectadas")}
                                  </Accordion.Control>
                                  <Accordion.Panel>
                                    <Stack gap="md">
                                      {(
                                        experiment.data
                                          .analysisRubrics as Array<{
                                          language: "es" | "en";
                                          units: Array<{
                                            id: string;
                                            text: string;
                                          }>;
                                        }>
                                      ).map((rubric) => (
                                        <div key={rubric.language}>
                                          <Group
                                            justify="space-between"
                                            mb="sm"
                                          >
                                            <Text fw={650}>
                                              {languageLabel(
                                                rubric.language,
                                                true,
                                              )}
                                            </Text>
                                            <Text size="sm" c="dimmed">
                                              {rubric.units.length}{" "}
                                              {t(
                                                rubric.units.length === 1
                                                  ? "unidad detectada"
                                                  : "unidades detectadas",
                                              )}
                                            </Text>
                                          </Group>
                                          <Stack gap="xs">
                                            {rubric.units.map((unit, index) => (
                                              <Paper
                                                key={unit.id}
                                                withBorder
                                                p="sm"
                                                radius="sm"
                                              >
                                                <Group
                                                  align="flex-start"
                                                  gap="sm"
                                                  wrap="nowrap"
                                                >
                                                  <Badge
                                                    variant="light"
                                                    color="gray"
                                                    circle
                                                    mt={2}
                                                    style={{ flexShrink: 0 }}
                                                  >
                                                    {index + 1}
                                                  </Badge>
                                                  <Text size="sm">
                                                    {unit.text}
                                                  </Text>
                                                </Group>
                                              </Paper>
                                            ))}
                                          </Stack>
                                        </div>
                                      ))}
                                    </Stack>
                                  </Accordion.Panel>
                                </Accordion.Item>
                              </Accordion>
                            )}
                            <Group justify="flex-end">
                              <Button
                                type="button"
                                variant="light"
                                loading={prepareAnalysis.isExecuting}
                                disabled={form.isDirty()}
                                onClick={() => void handlePrepareAnalysis()}
                              >
                                {experiment.data.analysisRubrics
                                  ? t("Preparar nuevamente")
                                  : t("Preparar historia")}
                              </Button>
                            </Group>
                          </Stack>
                        </Card>
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
                    {workspaceSection === "summary" && (
                      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                        <Card withBorder padding="md">
                          <Group justify="space-between" wrap="nowrap">
                            <Text size="sm" c="dimmed">
                              {t("Participación")}
                            </Text>
                            <IconUsersGroup
                              size={19}
                              color="var(--mantine-color-dimmed)"
                              stroke={1.6}
                            />
                          </Group>
                          <Text size="xl" fw={700} mt={4}>
                            {completedSessions.length} {t("completadas")}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {t(
                              "De {started} iniciadas · {pending} sin completar",
                              {
                                started: sessionRows.length,
                                pending: activeSessions.length,
                              },
                            )}
                          </Text>
                          <Progress value={completionRate} mt={6} size="xs" />
                        </Card>
                        <Card withBorder padding="md">
                          <Group justify="space-between" wrap="nowrap">
                            <Text size="sm" c="dimmed">
                              {t("Duración total promedio")}
                            </Text>
                            <IconClock
                              size={19}
                              color="var(--mantine-color-dimmed)"
                              stroke={1.6}
                            />
                          </Group>
                          <Text size="xl" fw={700}>
                            {formatDuration(averageDuration)}
                          </Text>
                        </Card>
                        <Card withBorder padding="md">
                          <Group justify="space-between" wrap="nowrap">
                            <Text size="sm" c="dimmed">
                              {t("Lectura promedio")}
                            </Text>
                            <IconBook
                              size={19}
                              color="var(--mantine-color-dimmed)"
                              stroke={1.6}
                            />
                          </Group>
                          <Text size="xl" fw={700}>
                            {formatDuration(averageReadingDuration)}
                          </Text>
                        </Card>
                        <Card withBorder padding="md">
                          <Group justify="space-between" wrap="nowrap">
                            <Text size="sm" c="dimmed">
                              {t("Reconstrucción promedio")}
                            </Text>
                            <IconPencil
                              size={19}
                              color="var(--mantine-color-dimmed)"
                              stroke={1.6}
                            />
                          </Group>
                          <Text size="xl" fw={700}>
                            {formatDuration(averageRecallDuration)}
                          </Text>
                        </Card>
                      </SimpleGrid>
                    )}

                    {workspaceSection === "responses" && (
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
                              {t("Descargar planilla")}
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
                                  {
                                    value: "es",
                                    label: languageLabel("es", true),
                                  },
                                  {
                                    value: "en",
                                    label: languageLabel("en", true),
                                  },
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
                            <Select
                              label={t("País")}
                              value={countryFilter}
                              data={[
                                { value: "all", label: t("Todos") },
                                ...availableCountries.map((country) => ({
                                  value: country,
                                  label: countryLabel(country),
                                })),
                              ]}
                              allowDeselect={false}
                              disabled={availableCountries.length === 0}
                              onChange={(value) => {
                                setCountryFilter(value ?? "all");
                                setVisibleSessionCount(20);
                              }}
                            />
                            <Select
                              label={t("Origen")}
                              value={sourceFilter}
                              data={[
                                { value: "all", label: t("Todos") },
                                {
                                  value: "general",
                                  label: t("Enlace general"),
                                },
                                ...shareChannelRows.map((channel) => ({
                                  value: channel.id,
                                  label: channel.name,
                                })),
                              ]}
                              allowDeselect={false}
                              onChange={(value) => {
                                setSourceFilter(value ?? "all");
                                setVisibleSessionCount(20);
                              }}
                            />
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
                                    : t(
                                        "No hay respuestas para estos filtros.",
                                      )}
                                </Text>
                              </Paper>
                            )}
                          {visibleSessions.length > 0 && (
                            <Table.ScrollContainer minWidth={860}>
                              <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>{t("Estado")}</Table.Th>
                                    <Table.Th>{t("Análisis")}</Table.Th>
                                    <Table.Th>{t("Inicio")}</Table.Th>
                                    <Table.Th>{t("Idioma")}</Table.Th>
                                    <Table.Th>{t("País")}</Table.Th>
                                    <Table.Th>{t("Origen")}</Table.Th>
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
                                          {t(
                                            sessionStatus[session.status].label,
                                          )}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge
                                          variant="light"
                                          color={
                                            session.status !== "submitted"
                                              ? "gray"
                                              : analyzedSessionIds.has(
                                                    session.id,
                                                  )
                                                ? "teal"
                                                : "yellow"
                                          }
                                        >
                                          {t(
                                            session.status !== "submitted"
                                              ? "No aplica"
                                              : analyzedSessionIds.has(
                                                    session.id,
                                                  )
                                                ? "Analizada"
                                                : "Pendiente",
                                          )}
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
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                          ff="monospace"
                                        >
                                          {session.id.slice(0, 8)}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text
                                          component="span"
                                          fz={24}
                                          lh={1}
                                          title={session.contentLanguage.toUpperCase()}
                                          aria-label={session.contentLanguage.toUpperCase()}
                                        >
                                          {languageFlag(
                                            session.contentLanguage,
                                          )}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td>
                                        {session.countryCode ? (
                                          <Text
                                            component="span"
                                            fz={24}
                                            lh={1}
                                            title={session.countryCode}
                                            aria-label={session.countryCode}
                                          >
                                            {countryFlag(session.countryCode)}
                                          </Text>
                                        ) : (
                                          "—"
                                        )}
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="sm">
                                          {session.shareChannel
                                            ? (shareChannelNames.get(
                                                String(
                                                  session.shareChannel.locator
                                                    .id,
                                                ),
                                              ) ?? t("Enlace desactivado"))
                                            : t("Enlace general")}
                                        </Text>
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
                    )}

                    {workspaceSection === "configuration" && (
                      <Card withBorder padding="lg">
                        <Stack gap="lg">
                          <div>
                            <Title order={2}>{t("Configuración")}</Title>
                            <Text c="dimmed" size="sm">
                              {t(
                                "La configuración queda en modo de solo lectura después de publicar.",
                              )}
                            </Text>
                          </div>
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
                        </Stack>
                      </Card>
                    )}
                  </Stack>
                )}

                {workspaceSection === "configuration" && (
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
                )}
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
                value={`${publicOrigin}/p/${experiment.data.publicToken}${qrChannelId ? `?s=${encodeURIComponent(qrChannelId)}` : ""}`}
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
              ? `${publicOrigin}/p/${experiment.data.publicToken}${qrChannelId ? `?s=${encodeURIComponent(qrChannelId)}` : ""}`
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

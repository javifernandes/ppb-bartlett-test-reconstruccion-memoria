"use client";

import {
  Box,
  Button,
  Center,
  Checkbox,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import { IconCheck } from "@tabler/icons-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
  RecallAnalysis,
  ShareChannel,
} from "@/generated/client-entities";
import { LanguageSelector, useI18n } from "@/app/i18n";
import { createId } from "@/lib/create-id";
import { collectParticipantClientMetadata } from "@/lib/participant-client-metadata";
import { MAX_RECALL_LENGTH } from "@/lib/recall-limits";
import {
  createDistractorValues,
  expectedDistractorOrder,
  isDistractorOrderCorrect,
} from "@/features/participation/distractor";
import { DistractorCard } from "@/features/participation/distractor-card";

const PublicExperiment = Experiment.view("PublicExperiment", {
  id: true,
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
  analysisRunId: true,
});

const ResumableSession = ParticipantSession.view("ResumableSession", {
  id: true,
  status: true,
  contentLanguage: true,
  intervalStartedAt: true,
});

type ParticipantStep =
  | "introduction"
  | "reading"
  | "interval"
  | "recall"
  | "complete";

const progressByStep: Record<ParticipantStep, number> = {
  introduction: 0,
  reading: 25,
  interval: 50,
  recall: 75,
  complete: 100,
};

const stepByStatus = {
  reading: "reading",
  interval: "interval",
  recalling: "recall",
  submitted: "complete",
} as const;

const cookieName = (publicToken: string) => `bartlett_session_${publicToken}`;

const readSessionCookie = (publicToken: string) => {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(cookieName(publicToken))}=`;
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
  return value ? decodeURIComponent(value) : undefined;
};

const writeSessionCookie = (publicToken: string, sessionId: string) => {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const name = encodeURIComponent(cookieName(publicToken));
  const value = encodeURIComponent(sessionId);

  // Older versions scoped this cookie to the participant page. The runtime
  // bridge lives at /api/runtime, so that scope prevented the server from
  // authorizing a session resume after a browser refresh.
  document.cookie = `${name}=; Path=/p/${publicToken}; Max-Age=0; SameSite=Lax${secure}`;
  document.cookie = `${name}=${value}; Path=/; Max-Age=604800; SameSite=Lax${secure}`;
};

const recallDraftKey = (publicToken: string, sessionId: string) =>
  `bartlett_recall_draft_${publicToken}_${sessionId}`;

const readRecallDraft = (publicToken: string, sessionId: string) => {
  try {
    return localStorage.getItem(recallDraftKey(publicToken, sessionId)) ?? "";
  } catch {
    return "";
  }
};

const writeRecallDraft = (
  publicToken: string,
  sessionId: string,
  value: string,
) => {
  try {
    localStorage.setItem(recallDraftKey(publicToken, sessionId), value);
  } catch {
    // The participation remains usable when browser storage is unavailable.
  }
};

const clearRecallDraft = (publicToken: string, sessionId: string) => {
  try {
    localStorage.removeItem(recallDraftKey(publicToken, sessionId));
  } catch {
    // Nothing else is required after a successful submission.
  }
};

const PublicParticipationPage = () => {
  const { locale, setLocale, t } = useI18n();
  const { publicToken } = useParams<{ publicToken: string }>();
  const searchParams = useSearchParams();
  const shareChannelId = searchParams.get("s")?.trim() || null;
  const requestedLanguage = searchParams.get("lang");
  const [step, setStep] = useState<ParticipantStep>("introduction");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [selectedContentLanguage, setSelectedContentLanguage] = useState<
    "es" | "en"
  >();
  const [sessionId, setSessionId] = useState<string>();
  const [intervalStartedAt, setIntervalStartedAt] = useState<string>();
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [recall, setRecall] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>();
  const experiment = useGraphQuery(
    Experiment.all()
      .where((experiment) => experiment.publicToken.eq(publicToken))
      .as(PublicExperiment)
      .one(),
  );
  const savedSession = useGraphQuery(
    ParticipantSession.all()
      .where((session) => session.id.eq(sessionId ?? ""))
      .as(ResumableSession)
      .first(),
    { enabled: Boolean(sessionId) },
  );
  const startSession = useOperation(ParticipantSession.domain.start);
  const finishReadingOperation = useOperation(
    ParticipantSession.domain.finishReading,
  );
  const startRecall = useOperation(ParticipantSession.domain.startRecall);
  const submitRecall = useOperation(ParticipantSession.domain.submitRecall);
  const analyzeRecall = useOperation(RecallAnalysis.domain.analyze);
  const distractorValues = useMemo(
    () => createDistractorValues(sessionId ?? publicToken),
    [publicToken, sessionId],
  );
  const expectedNumbers = useMemo(
    () => expectedDistractorOrder(distractorValues),
    [distractorValues],
  );
  const distractorComplete = isDistractorOrderCorrect(
    selectedNumbers,
    expectedNumbers,
  );

  useEffect(() => {
    if (requestedLanguage === "es" || requestedLanguage === "en") {
      setLocale(requestedLanguage);
    }
  }, [requestedLanguage, setLocale]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const savedSessionId = readSessionCookie(publicToken);
      if (savedSessionId) {
        writeSessionCookie(publicToken, savedSessionId);
      }
      setSessionId(savedSessionId);
    });
    return () => cancelAnimationFrame(frame);
  }, [publicToken]);

  useEffect(() => {
    if (!sessionId || savedSession.isLoading) return;
    if (!savedSession.data) return;

    const restoredSession = savedSession.data;
    const frame = requestAnimationFrame(() => {
      setStep(stepByStatus[restoredSession.status]);
      setSelectedContentLanguage(restoredSession.contentLanguage);
      setLocale(restoredSession.contentLanguage);
      setIntervalStartedAt(restoredSession.intervalStartedAt ?? undefined);
      if (restoredSession.status === "recalling") {
        setRecall(
          readRecallDraft(publicToken, restoredSession.id).slice(
            0,
            MAX_RECALL_LENGTH,
          ),
        );
      }
      if (restoredSession.status === "interval" && experiment.data) {
        const availableAt =
          Date.parse(restoredSession.intervalStartedAt ?? "") +
          experiment.data.intervalSeconds * 1000;
        setRemainingSeconds(
          Math.max(0, Math.ceil((availableAt - Date.now()) / 1000)),
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    experiment.data,
    publicToken,
    savedSession.data,
    savedSession.isLoading,
    sessionId,
    setLocale,
  ]);

  useEffect(() => {
    if (!sessionId || step !== "recall") return;
    const key = recallDraftKey(publicToken, sessionId);
    const syncDraft = (event: StorageEvent) => {
      if (event.key === key) {
        setRecall((event.newValue ?? "").slice(0, MAX_RECALL_LENGTH));
      }
    };
    window.addEventListener("storage", syncDraft);
    return () => window.removeEventListener("storage", syncDraft);
  }, [publicToken, sessionId, step]);

  useEffect(() => {
    if (step !== "interval" || !intervalStartedAt || !experiment.data) return;
    const updateRemaining = () => {
      const availableAt =
        Date.parse(intervalStartedAt) + experiment.data.intervalSeconds * 1000;
      setRemainingSeconds(
        Math.max(0, Math.ceil((availableAt - Date.now()) / 1000)),
      );
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [experiment.data, intervalStartedAt, step]);

  if (experiment.isLoading || (sessionId && savedSession.isLoading)) {
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  }

  if (
    experiment.isError ||
    !experiment.data ||
    experiment.data.status !== "published"
  ) {
    return (
      <Center mih="100dvh" p="md">
        <Paper withBorder p="lg" maw={560} w="100%">
          <Title order={2}>{t("Este experimento no está disponible")}</Title>
          <Text c="dimmed" mt="sm">
            {t(
              "Revisá que el enlace sea correcto o consultá a quien te lo envió.",
            )}
          </Text>
        </Paper>
      </Center>
    );
  }

  const hasAlternate = Boolean(
    experiment.data.alternateLanguage &&
    experiment.data.alternateParticipantTitle &&
    experiment.data.alternateIntroduction &&
    experiment.data.alternateConsentText &&
    experiment.data.alternateStory &&
    experiment.data.alternateRecallInstructions,
  );
  const contentLanguage =
    selectedContentLanguage ??
    (locale === experiment.data.primaryLanguage ||
    (hasAlternate && locale === experiment.data.alternateLanguage)
      ? locale
      : experiment.data.primaryLanguage);
  const useAlternate =
    hasAlternate && contentLanguage === experiment.data.alternateLanguage;
  const participantContent = useAlternate
    ? {
        participantTitle: experiment.data.alternateParticipantTitle as string,
        introduction: experiment.data.alternateIntroduction as string,
        consentText: experiment.data.alternateConsentText as string,
        story: experiment.data.alternateStory as string,
        recallInstructions: experiment.data
          .alternateRecallInstructions as string,
      }
    : {
        participantTitle: experiment.data.participantTitle,
        introduction: experiment.data.introduction,
        consentText: experiment.data.consentText,
        story: experiment.data.story,
        recallInstructions: experiment.data.recallInstructions,
      };

  const begin = async () => {
    setErrorMessage(undefined);
    const id = createId();
    const result = await startSession.executeAsync({
      id,
      experiment: Experiment.refById(experiment.data.id),
      shareChannel: shareChannelId
        ? ShareChannel.refById(shareChannelId)
        : null,
      contentLanguage,
      ...collectParticipantClientMetadata(),
      startedAt: new Date().toISOString(),
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    writeSessionCookie(publicToken, id);
    setSelectedNumbers([]);
    setSessionId(id);
    setStep("reading");
  };

  const finishReading = async () => {
    if (!sessionId) return;
    setErrorMessage(undefined);
    const result = await finishReadingOperation.executeAsync({
      session: ParticipantSession.refById(sessionId),
      experiment: Experiment.refById(experiment.data.id),
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setIntervalStartedAt(result.value.intervalStartedAt ?? undefined);
    setRemainingSeconds(experiment.data.intervalSeconds);
    setStep(stepByStatus[result.value.status]);
  };

  const beginRecall = async () => {
    if (!sessionId) return;
    setErrorMessage(undefined);
    const result = await startRecall.executeAsync({
      session: ParticipantSession.refById(sessionId),
      experiment: Experiment.refById(experiment.data.id),
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStep("recall");
  };

  const submit = async () => {
    if (!sessionId) return;
    setErrorMessage(undefined);
    const result = await submitRecall.executeAsync({
      session: ParticipantSession.refById(sessionId),
      experiment: Experiment.refById(experiment.data.id),
      recallText: recall,
      submittedAt: new Date().toISOString(),
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    clearRecallDraft(publicToken, sessionId);
    setStep("complete");
    if (experiment.data.analysisRunId) {
      void (async () => {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const analysisResult = await analyzeRecall.executeAsync({
            id: createId(),
            run: AnalysisRun.refById(experiment.data.analysisRunId!),
            session: ParticipantSession.refById(sessionId),
            experiment: Experiment.refById(experiment.data.id),
            createdAt: new Date().toISOString(),
          });
          if (analysisResult.ok) return;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2_000));
          } else {
            console.error("Automatic recall analysis remains pending", {
              experimentId: experiment.data.id,
              participantSessionId: sessionId,
              message: analysisResult.message,
            });
          }
        }
      })();
    }
  };

  const content = {
    introduction: (
      <Stack gap="lg">
        {hasAlternate && (
          <SegmentedControl
            fullWidth
            value={contentLanguage}
            data={[
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
            ].filter(
              (option) =>
                option.value === experiment.data.primaryLanguage ||
                option.value === experiment.data.alternateLanguage,
            )}
            onChange={(value) => {
              const language = value as "es" | "en";
              setSelectedContentLanguage(language);
              setLocale(language);
              setConsentAccepted(false);
            }}
          />
        )}
        <Title order={1}>{participantContent.participantTitle}</Title>
        <Text size="lg" style={{ whiteSpace: "pre-wrap" }}>
          {participantContent.introduction}
        </Text>
        <Checkbox
          checked={consentAccepted}
          onChange={(event) => setConsentAccepted(event.currentTarget.checked)}
          label={participantContent.consentText}
          size="md"
        />
        <Button
          size="lg"
          fullWidth
          disabled={!consentAccepted}
          loading={startSession.isExecuting}
          onClick={() => void begin()}
        >
          {t("Comenzar")}
        </Button>
      </Stack>
    ),
    reading: (
      <Stack gap="xl">
        <div>
          <Text c="dimmed" size="sm" fw={600} tt="uppercase" mb="xs">
            {t("Historia")}
          </Text>
          <Title order={1}>{participantContent.participantTitle}</Title>
        </div>
        <Text size="lg" lh={1.7} style={{ whiteSpace: "pre-wrap" }}>
          {participantContent.story}
        </Text>
        <Button
          size="lg"
          fullWidth
          loading={finishReadingOperation.isExecuting}
          onClick={() => void finishReading()}
        >
          {t("Terminé de leer")}
        </Button>
      </Stack>
    ),
    interval: (
      <Stack gap="lg" ta="center" align="center">
        <Title order={1}>{t("Actividad")}</Title>
        <Text size="lg">
          {remainingSeconds > 0
            ? t("Podés continuar en {seconds} segundos.", {
                seconds: remainingSeconds,
              })
            : t("El intervalo terminó.")}
        </Text>
        <Progress
          value={
            experiment.data.intervalSeconds > 0
              ? ((experiment.data.intervalSeconds - remainingSeconds) /
                  experiment.data.intervalSeconds) *
                100
              : 100
          }
          w="100%"
          animated={remainingSeconds > 0}
        />
        {experiment.data.distractorEnabled && (
          <DistractorCard
            values={distractorValues}
            selectedValues={selectedNumbers}
            expectedValues={expectedNumbers}
            complete={distractorComplete}
            onSelect={(value) =>
              setSelectedNumbers((current) => [...current, value])
            }
            onReset={() => setSelectedNumbers([])}
          />
        )}
        <Button
          size="lg"
          fullWidth
          disabled={remainingSeconds > 0}
          loading={startRecall.isExecuting}
          onClick={() => void beginRecall()}
        >
          {t("Continuar")}
        </Button>
      </Stack>
    ),
    recall: (
      <Stack gap="lg">
        <Title order={1}>{t("Reconstruí la historia")}</Title>
        <Text size="lg" style={{ whiteSpace: "pre-wrap" }}>
          {participantContent.recallInstructions}
        </Text>
        <Textarea
          label={t("Tu respuesta")}
          description={t("{current} de {maximum} caracteres", {
            current: recall.length,
            maximum: MAX_RECALL_LENGTH,
          })}
          value={recall}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setRecall(value);
            if (sessionId) writeRecallDraft(publicToken, sessionId, value);
          }}
          minRows={10}
          autosize
          maxLength={MAX_RECALL_LENGTH}
          size="md"
          autoFocus
        />
        <Button
          size="lg"
          fullWidth
          disabled={!recall.trim()}
          loading={submitRecall.isExecuting}
          onClick={() => void submit()}
        >
          {t("Enviar respuesta")}
        </Button>
      </Stack>
    ),
    complete: (
      <Stack gap="lg" align="center" ta="center">
        <Center bg="teal.8" c="white" w={64} h={64} bdrs="50%">
          <IconCheck size={34} />
        </Center>
        <Title order={1}>{t("¡Gracias por participar!")}</Title>
        <Text size="lg" c="dimmed">
          {t("Tu respuesta fue enviada.")}
        </Text>
      </Stack>
    ),
  }[step];

  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Box component="header" p="md">
        <Container size="sm">
          <Group justify="space-between" wrap="nowrap">
            <Box w={82} />
            <Text ta="center" size="sm" c="dimmed">
              {step === "complete" ? t("Completado") : t("Prueba de memoria")}
            </Text>
            <LanguageSelector compact />
          </Group>
        </Container>
      </Box>
      <Progress value={progressByStep[step]} radius={0} size="xs" />
      <Container size="sm" px="md" py={{ base: 32, sm: 64 }}>
        <Paper withBorder p={{ base: "lg", sm: 40 }} radius="lg">
          <Stack>
            {errorMessage && <Text c="red">{errorMessage}</Text>}
            {content}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default PublicParticipationPage;

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
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import { IconCheck, IconRefresh } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Experiment, ParticipantSession } from "@/generated/client-entities";

const PublicExperiment = Experiment.view("PublicExperiment", {
  id: true,
  participantTitle: true,
  introduction: true,
  consentText: true,
  story: true,
  recallInstructions: true,
  intervalSeconds: true,
  distractorEnabled: true,
  status: true,
});

const ResumableSession = ParticipantSession.view("ResumableSession", {
  id: true,
  status: true,
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
  document.cookie = `${encodeURIComponent(cookieName(publicToken))}=${encodeURIComponent(sessionId)}; Path=/p/${publicToken}; Max-Age=604800; SameSite=Lax${secure}`;
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

const createDistractorValues = (seed: string) => {
  let state = [...seed].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const values = new Set<number>();
  while (values.size < 8) {
    state = (state * 1664525 + 1013904223) >>> 0;
    values.add(10 + (state % 90));
  }
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
};

const PublicParticipationPage = () => {
  const { publicToken } = useParams<{ publicToken: string }>();
  const [step, setStep] = useState<ParticipantStep>("introduction");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [intervalStartedAt, setIntervalStartedAt] = useState<string>();
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [recall, setRecall] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>();
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.publicToken.eq(publicToken))
        .as(PublicExperiment)
        .one(),
    [publicToken],
  );
  const experiment = useGraphQuery(experimentQuery);
  const sessionQuery = useMemo(
    () =>
      ParticipantSession.all()
        .where((session) => session.id.eq(sessionId ?? "missing-session"))
        .as(ResumableSession)
        .first(),
    [sessionId],
  );
  const savedSession = useGraphQuery(sessionQuery);
  const startSession = useOperation(ParticipantSession.domain.start);
  const finishReadingOperation = useOperation(
    ParticipantSession.domain.finishReading,
  );
  const startRecall = useOperation(ParticipantSession.domain.startRecall);
  const submitRecall = useOperation(ParticipantSession.domain.submitRecall);
  const distractorValues = useMemo(
    () => createDistractorValues(sessionId ?? publicToken),
    [publicToken, sessionId],
  );
  const expectedNumbers = useMemo(
    () => [...distractorValues].sort((left, right) => right - left),
    [distractorValues],
  );
  const distractorComplete =
    selectedNumbers.length === expectedNumbers.length &&
    selectedNumbers.every((value, index) => value === expectedNumbers[index]);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setSessionId(readSessionCookie(publicToken)),
    );
    return () => cancelAnimationFrame(frame);
  }, [publicToken]);

  useEffect(() => {
    if (!sessionId || savedSession.isLoading) return;
    if (!savedSession.data) return;

    const restoredSession = savedSession.data;
    const frame = requestAnimationFrame(() => {
      setStep(stepByStatus[restoredSession.status]);
      setIntervalStartedAt(restoredSession.intervalStartedAt ?? undefined);
      if (restoredSession.status === "recalling") {
        setRecall(readRecallDraft(publicToken, restoredSession.id));
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
  ]);

  useEffect(() => {
    if (!sessionId || step !== "recall") return;
    const key = recallDraftKey(publicToken, sessionId);
    const syncDraft = (event: StorageEvent) => {
      if (event.key === key) setRecall(event.newValue ?? "");
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
          <Title order={2}>Este experimento no está disponible</Title>
          <Text c="dimmed" mt="sm">
            Revisá que el enlace sea correcto o consultá a quien te lo envió.
          </Text>
        </Paper>
      </Center>
    );
  }

  const begin = async () => {
    setErrorMessage(undefined);
    const id = crypto.randomUUID();
    const result = await startSession.executeAsync({
      id,
      experiment: Experiment.refById(experiment.data.id),
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
  };

  const content = {
    introduction: (
      <Stack gap="lg">
        <Title order={1}>{experiment.data.participantTitle}</Title>
        <Text size="lg" style={{ whiteSpace: "pre-wrap" }}>
          {experiment.data.introduction}
        </Text>
        <Checkbox
          checked={consentAccepted}
          onChange={(event) => setConsentAccepted(event.currentTarget.checked)}
          label={experiment.data.consentText}
          size="md"
        />
        <Button
          size="lg"
          fullWidth
          disabled={!consentAccepted}
          loading={startSession.isExecuting}
          onClick={() => void begin()}
        >
          Comenzar
        </Button>
      </Stack>
    ),
    reading: (
      <Stack gap="xl">
        <div>
          <Text c="dimmed" size="sm" fw={600} tt="uppercase" mb="xs">
            Historia
          </Text>
          <Title order={1}>{experiment.data.participantTitle}</Title>
        </div>
        <Text size="lg" lh={1.7} style={{ whiteSpace: "pre-wrap" }}>
          {experiment.data.story}
        </Text>
        <Button
          size="lg"
          fullWidth
          loading={finishReadingOperation.isExecuting}
          onClick={() => void finishReading()}
        >
          Terminé de leer
        </Button>
      </Stack>
    ),
    interval: (
      <Stack gap="lg" ta="center" align="center">
        <Title order={1}>Actividad</Title>
        <Text size="lg">
          {remainingSeconds > 0
            ? `Podés continuar en ${remainingSeconds} segundos.`
            : "El intervalo terminó."}
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
          <Paper withBorder p="lg" w="100%">
            <Stack gap="md">
              <div>
                <Text fw={700}>Ordená los números de mayor a menor</Text>
                <Text c="dimmed" size="sm">
                  Tocá cada número en el orden correcto.
                </Text>
              </div>
              <SimpleGrid cols={4} spacing="sm">
                {distractorValues.map((value) => (
                  <Button
                    key={value}
                    variant="light"
                    size="lg"
                    disabled={selectedNumbers.includes(value)}
                    onClick={() =>
                      setSelectedNumbers((current) => [...current, value])
                    }
                  >
                    {value}
                  </Button>
                ))}
              </SimpleGrid>
              <Text mih={24} fw={600}>
                {selectedNumbers.length > 0
                  ? selectedNumbers.join(" › ")
                  : "Tu orden aparecerá acá"}
              </Text>
              {selectedNumbers.length === expectedNumbers.length &&
                !distractorComplete && (
                  <Text c="red">Ese orden no es correcto. Probá de nuevo.</Text>
                )}
              {distractorComplete && (
                <Text c="teal" fw={600}>
                  ¡Orden correcto!
                </Text>
              )}
              <Group justify="center">
                <Button
                  variant="subtle"
                  leftSection={<IconRefresh size={18} />}
                  disabled={selectedNumbers.length === 0}
                  onClick={() => setSelectedNumbers([])}
                >
                  Reiniciar
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
        <Button
          size="lg"
          fullWidth
          disabled={
            remainingSeconds > 0 ||
            (experiment.data.distractorEnabled && !distractorComplete)
          }
          loading={startRecall.isExecuting}
          onClick={() => void beginRecall()}
        >
          Continuar
        </Button>
      </Stack>
    ),
    recall: (
      <Stack gap="lg">
        <Title order={1}>Reconstruí la historia</Title>
        <Text size="lg" style={{ whiteSpace: "pre-wrap" }}>
          {experiment.data.recallInstructions}
        </Text>
        <Textarea
          label="Tu respuesta"
          value={recall}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setRecall(value);
            if (sessionId) writeRecallDraft(publicToken, sessionId, value);
          }}
          minRows={10}
          autosize
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
          Enviar respuesta
        </Button>
      </Stack>
    ),
    complete: (
      <Stack gap="lg" align="center" ta="center">
        <Center bg="teal.8" c="white" w={64} h={64} bdrs="50%">
          <IconCheck size={34} />
        </Center>
        <Title order={1}>¡Gracias por participar!</Title>
        <Text size="lg" c="dimmed">
          Tu respuesta fue enviada.
        </Text>
      </Stack>
    ),
  }[step];

  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Box component="header" p="md">
        <Container size="sm">
          <Text ta="center" size="sm" c="dimmed">
            {step === "complete" ? "Completado" : "Prueba de memoria"}
          </Text>
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

"use client";

import {
  Box,
  Button,
  Center,
  Checkbox,
  Container,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import { IconCheck } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

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

const PublicParticipationPage = () => {
  const { publicToken } = useParams<{ publicToken: string }>();
  const [step, setStep] = useState<ParticipantStep>("introduction");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
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
  const startSession = useOperation(ParticipantSession.domain.start);
  const startRecall = useOperation(ParticipantSession.domain.startRecall);
  const submitRecall = useOperation(ParticipantSession.domain.submitRecall);

  if (experiment.isLoading) {
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

    setSessionId(id);
    setStep("reading");
  };

  const beginRecall = async () => {
    if (!sessionId) return;
    setErrorMessage(undefined);
    const result = await startRecall.executeAsync({
      session: ParticipantSession.refById(sessionId),
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStep("recall");
  };

  const finishReading = () => {
    if (experiment.data.intervalSeconds > 0) {
      setStep("interval");
      return;
    }
    void beginRecall();
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
          loading={startRecall.isExecuting}
          onClick={finishReading}
        >
          Terminé de leer
        </Button>
      </Stack>
    ),
    interval: (
      <Stack gap="lg" ta="center" align="center">
        <Title order={1}>Pausa</Title>
        <Text size="lg">
          Esperá {experiment.data.intervalSeconds} segundos antes de continuar.
        </Text>
        {experiment.data.distractorEnabled && (
          <Paper withBorder p="lg" w="100%">
            <Text fw={600}>Actividad</Text>
            <Text c="dimmed">Contá hacia atrás de tres en tres desde 100.</Text>
          </Paper>
        )}
        <Button
          size="lg"
          fullWidth
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
          onChange={(event) => setRecall(event.currentTarget.value)}
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

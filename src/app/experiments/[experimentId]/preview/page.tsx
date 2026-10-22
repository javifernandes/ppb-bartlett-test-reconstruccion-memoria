"use client";

import {
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Experiment } from "@/generated/client-entities";

const ParticipantPreview = Experiment.view("ParticipantPreview", {
  id: true,
  participantTitle: true,
  introduction: true,
  consentText: true,
  story: true,
  recallInstructions: true,
  intervalSeconds: true,
  distractorEnabled: true,
});

type PreviewStep =
  | "introduction"
  | "reading"
  | "interval"
  | "recall"
  | "complete";

const progressByStep: Record<PreviewStep, number> = {
  introduction: 0,
  reading: 25,
  interval: 50,
  recall: 75,
  complete: 100,
};

const ParticipantPreviewPage = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const [step, setStep] = useState<PreviewStep>("introduction");
  const [recall, setRecall] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.id.eq(experimentId))
        .as(ParticipantPreview)
        .one(),
    [experimentId],
  );
  const experiment = useGraphQuery(experimentQuery);

  if (experiment.isLoading) {
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  }

  if (experiment.isError || !experiment.data) {
    return (
      <Center mih="100dvh" p="md">
        <Paper withBorder p="lg" maw={560} w="100%">
          <Text c="red">No se pudo cargar el experimento.</Text>
        </Paper>
      </Center>
    );
  }

  const content = {
    introduction: (
      <Stack gap="lg">
        <Badge variant="light" w="fit-content">
          Vista previa
        </Badge>
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
          onClick={() => setStep("reading")}
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
          onClick={() =>
            setStep(experiment.data.intervalSeconds > 0 ? "interval" : "recall")
          }
        >
          Terminé de leer
        </Button>
      </Stack>
    ),
    interval: (
      <Stack gap="lg" ta="center" align="center">
        <Title order={1}>Pausa</Title>
        <Text size="lg">
          El protocolo indica una espera de {experiment.data.intervalSeconds}{" "}
          segundos antes de reconstruir la historia.
        </Text>
        {experiment.data.distractorEnabled && (
          <Paper withBorder p="lg" w="100%">
            <Text fw={600}>Distractor</Text>
            <Text c="dimmed">
              La actividad distractora se presentará durante este intervalo.
            </Text>
          </Paper>
        )}
        <Button size="lg" fullWidth onClick={() => setStep("recall")}>
          Continuar vista previa
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
          onClick={() => setStep("complete")}
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
          Tu respuesta fue completada.
        </Text>
        <Button
          variant="default"
          onClick={() => {
            setRecall("");
            setConsentAccepted(false);
            setStep("introduction");
          }}
        >
          Reiniciar vista previa
        </Button>
      </Stack>
    ),
  }[step];

  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Box component="header" p="md">
        <Container size="sm">
          <Group justify="space-between">
            <Button
              component={Link}
              href={`/experiments/${experimentId}`}
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
            >
              Volver
            </Button>
            <Text size="sm" c="dimmed">
              {step === "complete" ? "Completado" : "Prueba de memoria"}
            </Text>
          </Group>
        </Container>
      </Box>

      <Progress value={progressByStep[step]} radius={0} size="xs" />

      <Container size="sm" px="md" py={{ base: 32, sm: 64 }}>
        <Paper withBorder p={{ base: "lg", sm: 40 }} radius="lg">
          {content}
        </Paper>
      </Container>
    </Box>
  );
};

export default ParticipantPreviewPage;

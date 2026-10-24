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
import { LanguageSelector, useI18n } from "@/app/i18n";

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
  const { t } = useI18n();
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
          <Text c="red">{t("No se pudo cargar el experimento.")}</Text>
        </Paper>
      </Center>
    );
  }

  const content = {
    introduction: (
      <Stack gap="lg">
        <Badge variant="light" w="fit-content">
          {t("Vista previa")}
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
          {t("Terminé de leer")}
        </Button>
      </Stack>
    ),
    interval: (
      <Stack gap="lg" ta="center" align="center">
        <Title order={1}>{t("Pausa")}</Title>
        <Text size="lg">
          {t("Esperá {seconds} segundos antes de reconstruir la historia.", {
            seconds: experiment.data.intervalSeconds,
          })}
        </Text>
        {experiment.data.distractorEnabled && (
          <Paper withBorder p="lg" w="100%">
            <Text fw={600}>{t("Distractor")}</Text>
            <Text c="dimmed">
              {t(
                "La actividad distractora se presentará durante este intervalo.",
              )}
            </Text>
          </Paper>
        )}
        <Button size="lg" fullWidth onClick={() => setStep("recall")}>
          {t("Continuar vista previa")}
        </Button>
      </Stack>
    ),
    recall: (
      <Stack gap="lg">
        <Title order={1}>{t("Reconstruí la historia")}</Title>
        <Text size="lg" style={{ whiteSpace: "pre-wrap" }}>
          {experiment.data.recallInstructions}
        </Text>
        <Textarea
          label={t("Tu respuesta")}
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
          {t("Tu respuesta fue completada.")}
        </Text>
        <Button
          variant="default"
          onClick={() => {
            setRecall("");
            setConsentAccepted(false);
            setStep("introduction");
          }}
        >
          {t("Reiniciar vista previa")}
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
              {t("Volver")}
            </Button>
            <Text size="sm" c="dimmed">
              {step === "complete" ? t("Completado") : t("Prueba de memoria")}
            </Text>
            <LanguageSelector compact />
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

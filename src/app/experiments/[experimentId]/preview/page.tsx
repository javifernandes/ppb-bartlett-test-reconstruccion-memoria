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
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Experiment } from "@/generated/client-entities";
import { LanguageSelector, useI18n } from "@/app/i18n";
import {
  createDistractorValues,
  expectedDistractorOrder,
  isDistractorOrderCorrect,
} from "@/features/participation/distractor";
import { DistractorCard } from "@/features/participation/distractor-card";

const ParticipantPreview = Experiment.view("ParticipantPreview", {
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
  const { locale, setLocale, t } = useI18n();
  const { experimentId } = useParams<{ experimentId: string }>();
  const [step, setStep] = useState<PreviewStep>("introduction");
  const [recall, setRecall] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [intervalStartedAt, setIntervalStartedAt] = useState<number>();
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedContentLanguage, setSelectedContentLanguage] = useState<
    "es" | "en"
  >();
  const experiment = useGraphQuery(
    Experiment.all()
      .where((experiment) => experiment.id.eq(experimentId))
      .as(ParticipantPreview)
      .one(),
  );
  const distractorValues = useMemo(
    () => createDistractorValues(`${experimentId}:preview`),
    [experimentId],
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
    if (step !== "interval" || intervalStartedAt === undefined) return;
    const updateRemaining = () => {
      const intervalSeconds = experiment.data?.intervalSeconds ?? 0;
      const availableAt = intervalStartedAt + intervalSeconds * 1000;
      setRemainingSeconds(
        Math.max(0, Math.ceil((availableAt - Date.now()) / 1000)),
      );
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [experiment.data?.intervalSeconds, intervalStartedAt, step]);

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

  const content = {
    introduction: (
      <Stack gap="lg">
        <Badge variant="light" w="fit-content">
          {t("Vista previa")}
        </Badge>
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
          <Title order={1}>{participantContent.participantTitle}</Title>
        </div>
        <Text size="lg" lh={1.7} style={{ whiteSpace: "pre-wrap" }}>
          {participantContent.story}
        </Text>
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            if (experiment.data.intervalSeconds > 0) {
              setSelectedNumbers([]);
              setRemainingSeconds(experiment.data.intervalSeconds);
              setIntervalStartedAt(Date.now());
              setStep("interval");
              return;
            }
            setStep("recall");
          }}
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
          onClick={() => setStep("recall")}
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
            setIntervalStartedAt(undefined);
            setRemainingSeconds(0);
            setSelectedNumbers([]);
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

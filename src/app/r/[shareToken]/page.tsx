"use client";

import {
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import { IconChevronDown, IconSparkles } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { LanguageSelector, useI18n } from "@/app/i18n";
import {
  ParticipantSession,
  RecallAnalysis,
  ResultShare,
} from "@/generated/client-entities";

const SharedResult = ResultShare.view("SharedResult", {
  id: true,
  session: true,
  contentLanguage: true,
  story: true,
  recallText: true,
  readingSeconds: true,
  distractorSeconds: true,
  recallSeconds: true,
  totalSeconds: true,
  status: true,
});

const SharedAnalysis = RecallAnalysis.view("SharedAnalysis", {
  id: true,
  session: true,
  retainedUnitsCount: true,
  omittedUnitsCount: true,
  intrusionCount: true,
  phenomena: true,
  createdAt: true,
});

type SharedPhenomenon = {
  kind: string;
  storyExcerpt: string | null;
  recallExcerpt: string | null;
  explanation: string;
  confidence: number;
};

const phenomenonNames: Record<string, string> = {
  retained: "Unidad retenida",
  omission: "Omisión candidata",
  intrusion: "Intrusión candidata",
  substitution: "Sustitución candidata",
  rationalization: "Racionalización posible",
  accentuation: "Acentuación posible",
};

const phenomenonColors: Record<string, string> = {
  retained: "green",
  omission: "red",
  intrusion: "grape",
  substitution: "orange",
  rationalization: "blue",
  accentuation: "teal",
};

const phenomenonBackgrounds: Record<string, string> = {
  retained: "rgba(64, 192, 87, 0.22)",
  omission: "rgba(250, 82, 82, 0.22)",
  intrusion: "rgba(190, 75, 219, 0.22)",
  substitution: "rgba(253, 126, 20, 0.24)",
  rationalization: "rgba(34, 139, 230, 0.22)",
  accentuation: "rgba(18, 184, 134, 0.22)",
};

const readPhenomena = (value: unknown): SharedPhenomenon[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is SharedPhenomenon =>
          typeof item === "object" &&
          item !== null &&
          "kind" in item &&
          "explanation" in item,
      )
    : [];

const countWords = (value: string) =>
  value.trim().match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
};

const AnnotatedText = ({
  text,
  phenomena,
  side,
  selectedIndices,
  onSelect,
}: {
  text: string;
  phenomena: SharedPhenomenon[];
  side: "story" | "recall";
  selectedIndices: number[];
  onSelect: (indices: number[]) => void;
}) => {
  const { t } = useI18n();
  const candidates = phenomena
    .map((phenomenon, index) => {
      const excerpt =
        side === "story" ? phenomenon.storyExcerpt : phenomenon.recallExcerpt;
      const start = excerpt ? text.indexOf(excerpt) : -1;
      return excerpt && start >= 0
        ? { phenomenon, index, start, end: start + excerpt.length }
        : null;
    })
    .filter((candidate) => candidate !== null)
    .sort((left, right) => left.start - right.start || right.end - left.end);

  if (candidates.length === 0) return text;

  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...candidates.flatMap((candidate) => [candidate.start, candidate.end]),
    ]),
  ].sort((left, right) => left - right);

  return boundaries.slice(0, -1).map((start, boundaryIndex) => {
    const end = boundaries[boundaryIndex + 1];
    const fragment = text.slice(start, end);
    const active = candidates.filter(
      (candidate) => candidate.start <= start && candidate.end >= end,
    );
    if (active.length === 0) {
      return <span key={`${side}-plain-${start}`}>{fragment}</span>;
    }
    const indices = active.map((candidate) => candidate.index);
    const isSelected =
      indices.length === selectedIndices.length &&
      indices.every((index) => selectedIndices.includes(index));
    const colors = active.map(
      (candidate) =>
        phenomenonBackgrounds[candidate.phenomenon.kind] ??
        "rgba(134, 142, 150, 0.22)",
    );
    const background =
      colors.length === 1
        ? colors[0]
        : `linear-gradient(135deg, ${colors
            .map(
              (color, index) =>
                `${color} ${(index / colors.length) * 100}% ${((index + 1) / colors.length) * 100}%`,
            )
            .join(", ")})`;
    const color = phenomenonColors[active[0].phenomenon.kind] ?? "gray";

    return (
      <Box
        component="button"
        type="button"
        key={`${side}-${start}-${end}`}
        onClick={() => onSelect(indices)}
        aria-label={active
          .map((candidate) =>
            t(
              phenomenonNames[candidate.phenomenon.kind] ??
                candidate.phenomenon.kind,
            ),
          )
          .join(", ")}
        style={{
          display: "inline",
          padding: "1px 2px",
          margin: "0 1px",
          color: "inherit",
          font: "inherit",
          lineHeight: "inherit",
          textAlign: "inherit",
          cursor: "pointer",
          border: 0,
          borderBottom: `2px solid var(--mantine-color-${color}-6)`,
          borderRadius: 3,
          background,
          outline: isSelected
            ? "2px solid var(--mantine-color-gray-3)"
            : "none",
          outlineOffset: 2,
        }}
      >
        {fragment}
      </Box>
    );
  });
};

const SharedResultPage = () => {
  const { t } = useI18n();
  const [analysisVisible, setAnalysisVisible] = useState(true);
  const [selectedPhenomena, setSelectedPhenomena] = useState<number[]>([]);
  const { shareToken } = useParams<{ shareToken: string }>();
  const share = useGraphQuery(
    ResultShare.all()
      .where((share) => share.id.eq(shareToken))
      .as(SharedResult)
      .one(),
  );
  const sessionId = share.data
    ? String(share.data.session.locator.id)
    : undefined;
  const analysis = useGraphQuery(
    RecallAnalysis.all()
      .where((analysis) =>
        analysis.session.eq(ParticipantSession.refById(sessionId ?? "")),
      )
      .as(SharedAnalysis)
      .orderBy((analysis) => analysis.createdAt.desc())
      .first(),
    { enabled: Boolean(sessionId) },
  );
  const phenomena = readPhenomena(analysis.data?.phenomena);
  const selected = selectedPhenomena.flatMap((index) =>
    phenomena[index] ? [phenomena[index]] : [],
  );

  if (share.isLoading) {
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  }

  if (share.isError || !share.data || share.data.status !== "active") {
    return (
      <Center mih="100dvh" p="md">
        <Paper withBorder p="lg" maw={560} w="100%">
          <Title order={2}>{t("Este resultado no está disponible")}</Title>
          <Text c="dimmed" mt="sm">
            {t("El enlace puede haber sido desactivado o ser incorrecto.")}
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>{t("Prueba de Bartlett")}</Text>
          <LanguageSelector compact />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" py="xl">
          <Stack gap="xl">
            <div>
              <Group gap="sm" mb="xs">
                <Title order={1}>{t("Resultado compartido")}</Title>
                <Badge variant="light" color="gray">
                  {share.data.contentLanguage.toUpperCase()}
                </Badge>
              </Group>
              <Text c="dimmed">
                {t(
                  "Comparación anónima entre la historia original y una reconstrucción.",
                )}
              </Text>
            </div>

            <Card withBorder padding="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={2}>{t("Comparación")}</Title>
                    <Text c="dimmed" size="sm">
                      {t("Historia original y reconstrucción de la persona.")}
                    </Text>
                  </div>
                  {analysis.data && (
                    <Button
                      variant={analysisVisible ? "light" : "default"}
                      leftSection={<IconSparkles size={17} />}
                      rightSection={
                        <IconChevronDown
                          size={16}
                          style={{
                            transform: analysisVisible
                              ? "rotate(180deg)"
                              : undefined,
                            transition: "transform 150ms ease",
                          }}
                        />
                      }
                      onClick={() => setAnalysisVisible((value) => !value)}
                    >
                      {analysisVisible
                        ? t("Ocultar análisis")
                        : t("Mostrar análisis")}
                    </Button>
                  )}
                </Group>

                {analysis.data && analysisVisible && (
                  <Group gap="xs">
                    {Object.keys(phenomenonNames).map((kind) => {
                      const count = phenomena.filter(
                        (phenomenon) => phenomenon.kind === kind,
                      ).length;
                      return count > 0 ? (
                        <Badge
                          key={kind}
                          color={phenomenonColors[kind] ?? "gray"}
                          variant="light"
                        >
                          {t(phenomenonNames[kind])} · {count}
                        </Badge>
                      ) : null;
                    })}
                  </Group>
                )}

                <SimpleGrid
                  cols={{
                    base: 1,
                    lg: analysis.data && analysisVisible ? 3 : 2,
                  }}
                >
                  <Paper withBorder p="md">
                    <Text size="sm" c="dimmed" fw={600} mb="md">
                      {t("Historia original")} · {countWords(share.data.story)}{" "}
                      {t("palabras")}
                    </Text>
                    <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                      {analysis.data && analysisVisible ? (
                        <AnnotatedText
                          text={share.data.story}
                          phenomena={phenomena}
                          side="story"
                          selectedIndices={selectedPhenomena}
                          onSelect={setSelectedPhenomena}
                        />
                      ) : (
                        share.data.story
                      )}
                    </Text>
                  </Paper>
                  <Paper withBorder p="md">
                    <Text size="sm" c="dimmed" fw={600} mb="md">
                      {t("Reconstrucción")} ·{" "}
                      {countWords(share.data.recallText)} {t("palabras")}
                    </Text>
                    <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                      {analysis.data && analysisVisible ? (
                        <AnnotatedText
                          text={share.data.recallText}
                          phenomena={phenomena}
                          side="recall"
                          selectedIndices={selectedPhenomena}
                          onSelect={setSelectedPhenomena}
                        />
                      ) : (
                        share.data.recallText
                      )}
                    </Text>
                  </Paper>
                  {analysis.data && analysisVisible && (
                    <Paper withBorder p="md" style={{ alignSelf: "start" }}>
                      <Stack gap="md">
                        <div>
                          <Text fw={650}>{t("Detalle del fragmento")}</Text>
                          <Text size="sm" c="dimmed">
                            {selected.length > 0
                              ? t(
                                  "Este fragmento tiene las siguientes interpretaciones.",
                                )
                              : t(
                                  "Seleccioná una marca en los textos para inspeccionarla.",
                                )}
                          </Text>
                        </div>
                        {selected.map((phenomenon, index) => (
                          <Paper
                            key={`${phenomenon.kind}-${index}`}
                            withBorder
                            p="sm"
                            style={{
                              background:
                                phenomenonBackgrounds[phenomenon.kind] ??
                                "rgba(134, 142, 150, 0.22)",
                            }}
                          >
                            <Group justify="space-between" mb="xs">
                              <Badge
                                color={
                                  phenomenonColors[phenomenon.kind] ?? "gray"
                                }
                              >
                                {t(
                                  phenomenonNames[phenomenon.kind] ??
                                    phenomenon.kind,
                                )}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {t("Confianza")}{" "}
                                {Math.round(phenomenon.confidence * 100)} %
                              </Text>
                            </Group>
                            <Text size="sm">{phenomenon.explanation}</Text>
                            {(phenomenon.storyExcerpt ||
                              phenomenon.recallExcerpt) && (
                              <Text size="xs" c="dimmed" mt="xs">
                                {[
                                  phenomenon.storyExcerpt,
                                  phenomenon.recallExcerpt,
                                ]
                                  .filter(Boolean)
                                  .map((excerpt) => `“${excerpt}”`)
                                  .join(" → ")}
                              </Text>
                            )}
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </SimpleGrid>
              </Stack>
            </Card>

            <SimpleGrid cols={{ base: 2, md: 4 }}>
              <Paper withBorder p="md">
                <Text size="sm" c="dimmed">
                  {t("Tiempo total")}
                </Text>
                <Text size="xl" fw={700}>
                  {formatDuration(share.data.totalSeconds)}
                </Text>
              </Paper>
              <Paper withBorder p="md">
                <Text size="sm" c="dimmed">
                  {t("Lectura")}
                </Text>
                <Text size="xl" fw={700}>
                  {formatDuration(share.data.readingSeconds)}
                </Text>
              </Paper>
              <Paper withBorder p="md">
                <Text size="sm" c="dimmed">
                  {t("Intervalo / distractor")}
                </Text>
                <Text size="xl" fw={700}>
                  {formatDuration(share.data.distractorSeconds)}
                </Text>
              </Paper>
              <Paper withBorder p="md">
                <Text size="sm" c="dimmed">
                  {t("Reconstrucción")}
                </Text>
                <Text size="xl" fw={700}>
                  {formatDuration(share.data.recallSeconds)}
                </Text>
              </Paper>
            </SimpleGrid>

            <Card withBorder padding="lg">
              <Group justify="space-between" align="flex-start" mb="lg">
                <div>
                  <Group gap="xs">
                    <IconSparkles size={20} />
                    <Title order={2}>{t("Análisis automático")}</Title>
                  </Group>
                  <Text c="dimmed" size="sm" mt={4}>
                    {t(
                      "Las interpretaciones automáticas son orientativas y requieren revisión humana.",
                    )}
                  </Text>
                </div>
                <Badge
                  variant="light"
                  color={analysis.data ? "teal" : "yellow"}
                >
                  {analysis.data ? t("Analizada") : t("En preparación")}
                </Badge>
              </Group>

              {analysis.isLoading && <Loader size="sm" />}
              {!analysis.isLoading && !analysis.data && (
                <Text c="dimmed">
                  {t(
                    "El análisis todavía se está preparando. La comparación de textos ya está disponible.",
                  )}
                </Text>
              )}
              {analysis.data && (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Paper withBorder p="md">
                    <Text size="sm" c="dimmed">
                      {t("Unidades retenidas")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {analysis.data.retainedUnitsCount}
                    </Text>
                  </Paper>
                  <Paper withBorder p="md">
                    <Text size="sm" c="dimmed">
                      {t("Omisiones candidatas")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {analysis.data.omittedUnitsCount}
                    </Text>
                  </Paper>
                  <Paper withBorder p="md">
                    <Text size="sm" c="dimmed">
                      {t("Intrusiones candidatas")}
                    </Text>
                    <Text size="xl" fw={700}>
                      {analysis.data.intrusionCount}
                    </Text>
                  </Paper>
                </SimpleGrid>
              )}
            </Card>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default SharedResultPage;

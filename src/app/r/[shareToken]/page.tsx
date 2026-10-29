"use client";

import {
  AppShell,
  Badge,
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
import { IconSparkles } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";

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

const SharedResultPage = () => {
  const { t } = useI18n();
  const { shareToken } = useParams<{ shareToken: string }>();
  const shareQuery = useMemo(
    () =>
      ResultShare.all()
        .where((share) => share.id.eq(shareToken))
        .as(SharedResult)
        .one(),
    [shareToken],
  );
  const share = useGraphQuery(shareQuery);
  const sessionId = share.data
    ? String(share.data.session.locator.id)
    : "missing-session";
  const analysisQuery = useMemo(
    () =>
      RecallAnalysis.all()
        .where((analysis) =>
          analysis.session.eq(ParticipantSession.refById(sessionId)),
        )
        .as(SharedAnalysis)
        .orderBy((analysis) => analysis.createdAt.desc())
        .first(),
    [sessionId],
  );
  const analysis = useGraphQuery(analysisQuery);
  const phenomena = readPhenomena(analysis.data?.phenomena);

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

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Card withBorder padding="lg">
                <Text size="sm" c="dimmed" fw={600} mb="md">
                  {t("Historia original")} · {countWords(share.data.story)}{" "}
                  {t("palabras")}
                </Text>
                <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                  {share.data.story}
                </Text>
              </Card>
              <Card withBorder padding="lg">
                <Text size="sm" c="dimmed" fw={600} mb="md">
                  {t("Reconstrucción")} · {countWords(share.data.recallText)}{" "}
                  {t("palabras")}
                </Text>
                <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                  {share.data.recallText}
                </Text>
              </Card>
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
                <Stack gap="lg">
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

                  {phenomena.length > 0 && (
                    <div>
                      <Text fw={650} mb="sm">
                        {t("Fenómenos detectados")}
                      </Text>
                      <Stack gap="sm">
                        {phenomena.map((phenomenon, index) => (
                          <Paper
                            key={`${phenomenon.kind}-${index}`}
                            withBorder
                            p="md"
                          >
                            <Group justify="space-between" mb="xs">
                              <Badge
                                color={
                                  phenomenonColors[phenomenon.kind] ?? "gray"
                                }
                                variant="light"
                              >
                                {t(
                                  phenomenonNames[phenomenon.kind] ??
                                    phenomenon.kind,
                                )}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {t("Confianza")} ·{" "}
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
                    </div>
                  )}
                </Stack>
              )}
            </Card>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default SharedResultPage;

"use client";

import {
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@mantine/form";

import {
  AnalysisRun,
  Experiment,
  ParticipantSession,
} from "@/generated/client-entities";
import { createId } from "@/lib/create-id";

import { AdminHeader } from "./admin-header";
import { useI18n } from "./i18n";

const ExperimentCard = Experiment.view("ExperimentCard", {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  publishedAt: true,
  intervalSeconds: true,
  distractorEnabled: true,
});

const ParticipantSummary = ParticipantSession.view("ParticipantSummary", {
  id: true,
  experiment: true,
  status: true,
});

const AnalysisRunSummary = AnalysisRun.view("AnalysisRunSummary", {
  id: true,
  experiment: true,
  status: true,
  analyzerVersion: true,
  createdAt: true,
});

const experimentsQuery = Experiment.all()
  .as(ExperimentCard)
  .orderBy((experiment) => experiment.title);
const participantSummariesQuery =
  ParticipantSession.all().as(ParticipantSummary);
const analysisRunSummariesQuery = AnalysisRun.all()
  .as(AnalysisRunSummary)
  .orderBy((run) => run.createdAt.desc());

const HomePage = () => {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [createOpened, createModal] = useDisclosure(false);
  const experiments = useGraphQuery(experimentsQuery);
  const participants = useGraphQuery(participantSummariesQuery);
  const analysisRuns = useGraphQuery(analysisRunSummariesQuery);
  const createDraft = useOperation(Experiment.domain.createDraft);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { title: "", story: "" },
    validate: {
      title: (value) => (value.trim() ? null : t("Ingresá un nombre.")),
      story: (value) => (value.trim() ? null : t("Ingresá la historia.")),
    },
  });

  const handleCreate = form.onSubmit(async (values) => {
    const id = createId();
    const result = await createDraft.executeAsync({
      id,
      title: values.title,
      story: values.story,
      createdAt: new Date().toISOString(),
    });

    if (result.ok) {
      notifications.show({
        title: t("Borrador creado"),
        message: result.value.title,
        color: "teal",
      });
      createModal.close();
      form.reset();
      router.push(`/experiments/${id}`);
      return;
    }

    notifications.show({
      title: t("No se pudo crear el borrador"),
      message: result.message,
      color: "red",
    });
  });

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AdminHeader section={t("Experimentos")} />

      <AppShell.Main>
        <Container size="lg" py="xl">
          <Stack gap="xl">
            <Group justify="space-between" align="flex-end">
              <div>
                <Text c="dimmed" size="sm" fw={500} tt="uppercase">
                  {t("Procesos Psicológicos Básicos")}
                </Text>
                <Title order={1}>{t("Experimentos")}</Title>
              </div>
              <Button
                leftSection={<IconPlus size={18} />}
                loading={createDraft.isExecuting}
                onClick={createModal.open}
              >
                {t("Nuevo experimento")}
              </Button>
            </Group>

            {(experiments.isLoading ||
              participants.isLoading ||
              analysisRuns.isLoading) && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {(experiments.isError ||
              participants.isError ||
              analysisRuns.isError) && (
              <Card withBorder>
                <Text c="red">
                  {t("No se pudieron cargar los experimentos.")}
                </Text>
                {process.env.NODE_ENV === "development" && (
                  <Stack gap={2} mt="xs">
                    {experiments.error && (
                      <Text size="xs" c="dimmed">
                        Experimentos: {experiments.error.message}
                      </Text>
                    )}
                    {participants.error && (
                      <Text size="xs" c="dimmed">
                        {t("Participaciones")}: {participants.error.message}
                      </Text>
                    )}
                    {analysisRuns.error && (
                      <Text size="xs" c="dimmed">
                        Análisis: {analysisRuns.error.message}
                      </Text>
                    )}
                  </Stack>
                )}
              </Card>
            )}

            {experiments.data && participants.data && analysisRuns.data && (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {experiments.data.map((experiment) => {
                  const experimentParticipants = participants.data.filter(
                    (session) =>
                      session.experiment.locator.id === experiment.id,
                  );
                  const submitted = experimentParticipants.filter(
                    (session) => session.status === "submitted",
                  ).length;
                  const active = experimentParticipants.length - submitted;
                  const runs = analysisRuns.data.filter(
                    (run) => run.experiment.locator.id === experiment.id,
                  );
                  const latestRun = runs[0];
                  const analyzerLabel = latestRun?.analyzerVersion.startsWith(
                    "deepseek:",
                  )
                    ? `DeepSeek · ${latestRun.analyzerVersion.replace("deepseek:", "")}`
                    : latestRun
                      ? "Heurístico local"
                      : null;

                  return (
                    <Card
                      key={experiment.id}
                      component={Link}
                      href={`/experiments/${experiment.id}`}
                      withBorder
                      padding="lg"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <Stack gap="md" h="100%">
                        <Group justify="space-between" align="flex-start">
                          <Title order={3} lineClamp={2} style={{ flex: 1 }}>
                            {experiment.title}
                          </Title>
                          <Badge
                            variant="light"
                            color={
                              experiment.status === "published"
                                ? "teal"
                                : "gray"
                            }
                          >
                            {experiment.status === "published"
                              ? t("Publicado")
                              : experiment.status === "closed"
                                ? t("Cerrado")
                                : t("Borrador")}
                          </Badge>
                        </Group>

                        {experiment.status === "draft" && (
                          <Group gap="xs">
                            <Text c="dimmed" size="sm">
                              {experiment.intervalSeconds > 0
                                ? `${experiment.intervalSeconds} s`
                                : t("Sin intervalo")}
                            </Text>
                            <Text c="dimmed" size="sm">
                              ·
                            </Text>
                            <Text c="dimmed" size="sm">
                              {experiment.distractorEnabled
                                ? t("Con distractor")
                                : t("Sin distractor")}
                            </Text>
                          </Group>
                        )}

                        {experiment.status === "published" && (
                          <Group gap="lg">
                            <div>
                              <Text fw={700} size="lg">
                                {submitted}
                              </Text>
                              <Text c="dimmed" size="xs">
                                {t("respuestas")}
                              </Text>
                            </div>
                            <div>
                              <Text fw={700} size="lg">
                                {active}
                              </Text>
                              <Text c="dimmed" size="xs">
                                {t("en curso")}
                              </Text>
                            </div>
                            {experiment.publishedAt && (
                              <Text c="dimmed" size="sm" ml="auto">
                                {t("Desde")}{" "}
                                {new Date(
                                  experiment.publishedAt,
                                ).toLocaleDateString(
                                  locale === "es" ? "es-AR" : "en-US",
                                )}
                              </Text>
                            )}
                          </Group>
                        )}

                        {experiment.status === "closed" && (
                          <Stack gap={4}>
                            <Text size="sm">
                              <Text component="span" fw={700}>
                                {submitted}
                              </Text>{" "}
                              {t("respuestas")} · {runs.length}{" "}
                              {t(runs.length === 1 ? "corrida" : "corridas")}
                            </Text>
                            <Text c="dimmed" size="sm">
                              {analyzerLabel
                                ? `${t("Último")}: ${analyzerLabel}`
                                : t("Todavía no fue analizado")}
                            </Text>
                          </Stack>
                        )}

                        <Group justify="space-between" mt="auto">
                          <Text c="dimmed" size="xs">
                            {t("Creado")}{" "}
                            {new Date(experiment.createdAt).toLocaleDateString(
                              locale === "es" ? "es-AR" : "en-US",
                            )}
                          </Text>
                          <Group gap={4}>
                            <Text fw={600} size="sm">
                              {experiment.status === "draft"
                                ? t("Continuar configuración")
                                : experiment.status === "published"
                                  ? t("Monitorear")
                                  : t("Ver resultados")}
                            </Text>
                            <IconChevronRight size={16} />
                          </Group>
                        </Group>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            )}
          </Stack>
        </Container>
      </AppShell.Main>

      <Modal
        opened={createOpened}
        onClose={createModal.close}
        title={t("Nuevo experimento")}
        centered
      >
        <form onSubmit={handleCreate}>
          <Stack>
            <TextInput
              label={t("Nombre del experimento")}
              placeholder={t("Ej. Prueba piloto")}
              required
              key={form.key("title")}
              {...form.getInputProps("title")}
            />
            <Textarea
              label={t("Historia")}
              description={t("El texto que leerán los participantes.")}
              placeholder={t("Pegá la historia completa…")}
              minRows={8}
              autosize
              required
              key={form.key("story")}
              {...form.getInputProps("story")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={createModal.close}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" loading={createDraft.isExecuting}>
                {t("Crear borrador")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
};

export default HomePage;

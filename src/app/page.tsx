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

import { AdminHeader } from "./admin-header";

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
      title: (value) => (value.trim() ? null : "Ingresá un nombre."),
      story: (value) => (value.trim() ? null : "Ingresá la historia."),
    },
  });

  const handleCreate = form.onSubmit(async (values) => {
    const id = crypto.randomUUID();
    const result = await createDraft.executeAsync({
      id,
      title: values.title,
      story: values.story,
      createdAt: new Date().toISOString(),
    });

    if (result.ok) {
      notifications.show({
        title: "Borrador creado",
        message: result.value.title,
        color: "teal",
      });
      createModal.close();
      form.reset();
      router.push(`/experiments/${id}`);
      return;
    }

    notifications.show({
      title: "No se pudo crear el borrador",
      message: result.message,
      color: "red",
    });
  });

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AdminHeader section="Experimentos" />

      <AppShell.Main>
        <Container size="lg" py="xl">
          <Stack gap="xl">
            <Group justify="space-between" align="flex-end">
              <div>
                <Text c="dimmed" size="sm" fw={500} tt="uppercase">
                  Procesos Psicológicos Básicos
                </Text>
                <Title order={1}>Experimentos</Title>
              </div>
              <Button
                leftSection={<IconPlus size={18} />}
                loading={createDraft.isExecuting}
                onClick={createModal.open}
              >
                Nuevo experimento
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
                <Text c="red">No se pudieron cargar los experimentos.</Text>
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
                              ? "Publicado"
                              : experiment.status === "closed"
                                ? "Cerrado"
                                : "Borrador"}
                          </Badge>
                        </Group>

                        {experiment.status === "draft" && (
                          <Group gap="xs">
                            <Text c="dimmed" size="sm">
                              {experiment.intervalSeconds > 0
                                ? `Intervalo de ${experiment.intervalSeconds} s`
                                : "Sin intervalo"}
                            </Text>
                            <Text c="dimmed" size="sm">
                              ·
                            </Text>
                            <Text c="dimmed" size="sm">
                              {experiment.distractorEnabled
                                ? "Con distractor"
                                : "Sin distractor"}
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
                                respuestas
                              </Text>
                            </div>
                            <div>
                              <Text fw={700} size="lg">
                                {active}
                              </Text>
                              <Text c="dimmed" size="xs">
                                en curso
                              </Text>
                            </div>
                            {experiment.publishedAt && (
                              <Text c="dimmed" size="sm" ml="auto">
                                Desde{" "}
                                {new Date(
                                  experiment.publishedAt,
                                ).toLocaleDateString("es-AR")}
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
                              respuestas · {runs.length}{" "}
                              {runs.length === 1 ? "corrida" : "corridas"}
                            </Text>
                            <Text c="dimmed" size="sm">
                              {analyzerLabel
                                ? `Último: ${analyzerLabel}`
                                : "Todavía no fue analizado"}
                            </Text>
                          </Stack>
                        )}

                        <Group justify="space-between" mt="auto">
                          <Text c="dimmed" size="xs">
                            Creado{" "}
                            {new Date(experiment.createdAt).toLocaleDateString(
                              "es-AR",
                            )}
                          </Text>
                          <Group gap={4}>
                            <Text fw={600} size="sm">
                              {experiment.status === "draft"
                                ? "Continuar configuración"
                                : experiment.status === "published"
                                  ? "Monitorear"
                                  : "Ver resultados"}
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
        title="Nuevo experimento"
        centered
      >
        <form onSubmit={handleCreate}>
          <Stack>
            <TextInput
              label="Nombre del experimento"
              placeholder="Ej. Prueba piloto"
              required
              key={form.key("title")}
              {...form.getInputProps("title")}
            />
            <Textarea
              label="Historia"
              description="El texto que leerán los participantes."
              placeholder="Pegá la historia completa…"
              minRows={8}
              autosize
              required
              key={form.key("story")}
              {...form.getInputProps("story")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={createModal.close}>
                Cancelar
              </Button>
              <Button type="submit" loading={createDraft.isExecuting}>
                Crear borrador
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
};

export default HomePage;

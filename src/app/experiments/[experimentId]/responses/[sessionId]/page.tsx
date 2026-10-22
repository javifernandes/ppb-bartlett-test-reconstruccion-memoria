"use client";

import {
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useGraphQuery } from "@ontahi/react/graph";
import { IconArrowLeft, IconFlask } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { Experiment, ParticipantSession } from "@/generated/client-entities";

const ResponseExperiment = Experiment.view("ResponseExperiment", {
  id: true,
  title: true,
});

const ResponseDetail = ParticipantSession.view("ResponseDetail", {
  id: true,
  experiment: true,
  status: true,
  startedAt: true,
  intervalStartedAt: true,
  recallingStartedAt: true,
  lastActivityAt: true,
  recallText: true,
  submittedAt: true,
});

const statusDetails = {
  reading: { label: "Leyendo", color: "blue" },
  interval: { label: "En intervalo", color: "yellow" },
  recalling: { label: "Reconstruyendo", color: "grape" },
  submitted: { label: "Completada", color: "teal" },
} as const;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-AR") : "—";

const durationBetween = (from?: string | null, to?: string | null) => {
  if (!from || !to) return "—";
  const totalSeconds = Math.max(
    0,
    Math.round((Date.parse(to) - Date.parse(from)) / 1000),
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
};

const ResponseDetailPage = () => {
  const { experimentId, sessionId } = useParams<{
    experimentId: string;
    sessionId: string;
  }>();
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.id.eq(experimentId))
        .as(ResponseExperiment)
        .one(),
    [experimentId],
  );
  const responseQuery = useMemo(
    () =>
      ParticipantSession.all()
        .where((session) => session.id.eq(sessionId))
        .as(ResponseDetail)
        .one(),
    [sessionId],
  );
  const experiment = useGraphQuery(experimentQuery);
  const response = useGraphQuery(responseQuery);
  const belongsToExperiment =
    response.data?.experiment.locator.id === experimentId;

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header px="md">
        <Group h="100%" gap="sm">
          <IconFlask size={24} />
          <Text fw={600}>Prueba de Bartlett</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="md" py="xl">
          <Stack gap="xl">
            <Button
              component={Link}
              href={`/experiments/${experimentId}`}
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              w="fit-content"
            >
              Volver al experimento
            </Button>

            {(experiment.isLoading || response.isLoading) && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {(experiment.isError || response.isError || !belongsToExperiment) &&
              !experiment.isLoading &&
              !response.isLoading && (
                <Card withBorder>
                  <Title order={2}>No se encontró la participación</Title>
                  <Text c="dimmed" mt="xs">
                    Revisá que el enlace corresponda a este experimento.
                  </Text>
                </Card>
              )}

            {experiment.data && response.data && belongsToExperiment && (
              <>
                <div>
                  <Text c="dimmed" size="sm">
                    {experiment.data.title}
                  </Text>
                  <Group justify="space-between" align="flex-start" mt={4}>
                    <div>
                      <Title order={1}>Respuesta individual</Title>
                      <Text c="dimmed" ff="monospace" size="sm">
                        {response.data.id}
                      </Text>
                    </div>
                    <Badge
                      size="lg"
                      variant="light"
                      color={statusDetails[response.data.status].color}
                    >
                      {statusDetails[response.data.status].label}
                    </Badge>
                  </Group>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Tiempo total
                    </Text>
                    <Text size="xl" fw={700}>
                      {durationBetween(
                        response.data.startedAt,
                        response.data.submittedAt ??
                          response.data.lastActivityAt,
                      )}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Lectura
                    </Text>
                    <Text size="xl" fw={700}>
                      {durationBetween(
                        response.data.startedAt,
                        response.data.intervalStartedAt ??
                          response.data.recallingStartedAt,
                      )}
                    </Text>
                  </Card>
                  <Card withBorder>
                    <Text size="sm" c="dimmed">
                      Reconstrucción
                    </Text>
                    <Text size="xl" fw={700}>
                      {durationBetween(
                        response.data.recallingStartedAt,
                        response.data.submittedAt ??
                          response.data.lastActivityAt,
                      )}
                    </Text>
                  </Card>
                </SimpleGrid>

                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <Title order={2}>Línea temporal</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <div>
                        <Text size="sm" c="dimmed">
                          Inicio
                        </Text>
                        <Text>{formatDate(response.data.startedAt)}</Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">
                          Inicio del intervalo
                        </Text>
                        <Text>
                          {formatDate(response.data.intervalStartedAt)}
                        </Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">
                          Inicio de reconstrucción
                        </Text>
                        <Text>
                          {formatDate(response.data.recallingStartedAt)}
                        </Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">
                          Envío
                        </Text>
                        <Text>{formatDate(response.data.submittedAt)}</Text>
                      </div>
                    </SimpleGrid>
                  </Stack>
                </Card>

                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <Title order={2}>Reconstrucción</Title>
                    <Text
                      size="lg"
                      c={response.data.recallText ? undefined : "dimmed"}
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {response.data.recallText ??
                        "La persona todavía no envió una respuesta."}
                    </Text>
                  </Stack>
                </Card>
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default ResponseDetailPage;

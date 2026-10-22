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
import { notifications } from "@mantine/notifications";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import { IconFlask, IconPlus } from "@tabler/icons-react";

import { Experiment } from "@/generated/client-entities";

const ExperimentCard = Experiment.view("ExperimentCard", {
  id: true,
  title: true,
  status: true,
  createdAt: true,
});

const experimentsQuery = Experiment.all()
  .as(ExperimentCard)
  .orderBy((experiment) => experiment.title);

const HomePage = () => {
  const experiments = useGraphQuery(experimentsQuery);
  const createDraft = useOperation(Experiment.domain.createDraft);

  const handleCreate = async () => {
    const result = await createDraft.executeAsync({
      id: crypto.randomUUID(),
      title: `Experimento ${new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      createdAt: new Date().toISOString(),
    });

    if (result.ok) {
      notifications.show({
        title: "Borrador creado",
        message: result.value.title,
        color: "teal",
      });
      return;
    }

    notifications.show({
      title: "No se pudo crear el borrador",
      message: result.message,
      color: "red",
    });
  };

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between">
          <Group gap="sm">
            <IconFlask size={24} />
            <Text fw={600}>Prueba de Bartlett</Text>
          </Group>
          <Badge variant="light">Runtime local · memoria</Badge>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg" py="xl">
          <Stack gap="xl">
            <Group justify="space-between" align="flex-end">
              <div>
                <Text c="dimmed" size="sm" fw={500} tt="uppercase">
                  Procesos Psicológicos Básicos
                </Text>
                <Title order={1}>Experimentos</Title>
                <Text c="dimmed">
                  Primer slice ejecutando Query y Operation mediante Ontahí.
                </Text>
              </div>
              <Button
                leftSection={<IconPlus size={18} />}
                loading={createDraft.isExecuting}
                onClick={() => void handleCreate()}
              >
                Nuevo experimento
              </Button>
            </Group>

            {experiments.isLoading && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {experiments.isError && (
              <Card withBorder>
                <Text c="red">No se pudieron cargar los experimentos.</Text>
              </Card>
            )}

            {experiments.data && (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {experiments.data.map((experiment) => (
                  <Card key={experiment.id} withBorder padding="lg">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Title order={3}>{experiment.title}</Title>
                        <Badge variant="light">Borrador</Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        Creado{" "}
                        {new Date(experiment.createdAt).toLocaleDateString(
                          "es-AR",
                        )}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default HomePage;

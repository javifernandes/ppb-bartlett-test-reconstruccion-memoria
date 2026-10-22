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
import { IconFlask, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@mantine/form";

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
  const router = useRouter();
  const [createOpened, createModal] = useDisclosure(false);
  const experiments = useGraphQuery(experimentsQuery);
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
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between">
          <Group gap="sm">
            <IconFlask size={24} />
            <Text fw={600}>Prueba de Bartlett</Text>
          </Group>
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
              </div>
              <Button
                leftSection={<IconPlus size={18} />}
                loading={createDraft.isExecuting}
                onClick={createModal.open}
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
                  <Card
                    key={experiment.id}
                    component={Link}
                    href={`/experiments/${experiment.id}`}
                    withBorder
                    padding="lg"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
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

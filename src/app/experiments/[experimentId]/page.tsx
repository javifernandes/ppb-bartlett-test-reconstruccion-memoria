"use client";

import {
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconEye,
  IconFlask,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Experiment } from "@/generated/client-entities";

const ExperimentWorkspace = Experiment.view("ExperimentWorkspace", {
  id: true,
  title: true,
  story: true,
  status: true,
  createdAt: true,
});

const ExperimentWorkspacePage = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const experimentQuery = useMemo(
    () =>
      Experiment.all()
        .where((experiment) => experiment.id.eq(experimentId))
        .as(ExperimentWorkspace)
        .one(),
    [experimentId],
  );
  const experiment = useGraphQuery(experimentQuery);
  const updateDraft = useOperation(Experiment.domain.updateDraft);
  const form = useForm({
    initialValues: { title: "", story: "" },
    validate: {
      title: (value) => (value.trim() ? null : "Ingresá un nombre."),
      story: (value) => (value.trim() ? null : "Ingresá la historia."),
    },
  });

  useEffect(() => {
    if (experiment.data) {
      form.setValues({
        title: experiment.data.title,
        story: experiment.data.story,
      });
      form.resetDirty();
    }
    // The entity id is the boundary for resetting this editing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.data?.id]);

  const handleSave = form.onSubmit(async (values) => {
    const result = await updateDraft.executeAsync({
      experiment: Experiment.refById(experimentId),
      title: values.title,
      story: values.story,
    });

    if (result.ok) {
      form.resetDirty(values);
      notifications.show({
        title: "Cambios guardados",
        message: result.value.title,
        color: "teal",
      });
      return;
    }

    notifications.show({
      title: "No se pudieron guardar los cambios",
      message: result.message,
      color: "red",
    });
  });

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
              href="/"
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              w="fit-content"
            >
              Experimentos
            </Button>

            {experiment.isLoading && (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            )}

            {experiment.isError && (
              <Card withBorder>
                <Text c="red">No se pudo cargar el experimento.</Text>
              </Card>
            )}

            {experiment.data && (
              <>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <div>
                    <Title order={1}>{experiment.data.title}</Title>
                    <Text c="dimmed">Configuración del experimento</Text>
                  </div>
                  <Group>
                    <Badge variant="light">Borrador</Badge>
                    <Button
                      component={Link}
                      href={`/experiments/${experimentId}/preview`}
                      variant="default"
                      leftSection={<IconEye size={18} />}
                    >
                      Vista previa
                    </Button>
                  </Group>
                </Group>

                <Card withBorder padding="lg">
                  <form onSubmit={handleSave}>
                    <Stack gap="lg">
                      <TextInput
                        label="Nombre del experimento"
                        required
                        {...form.getInputProps("title")}
                      />
                      <Textarea
                        label="Historia"
                        description="El texto se mostrará a los participantes durante la etapa de lectura."
                        minRows={12}
                        autosize
                        required
                        {...form.getInputProps("story")}
                      />
                      <Group justify="flex-end">
                        <Button
                          type="submit"
                          leftSection={<IconDeviceFloppy size={18} />}
                          loading={updateDraft.isExecuting}
                          disabled={!form.isDirty()}
                        >
                          Guardar cambios
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                </Card>
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default ExperimentWorkspacePage;

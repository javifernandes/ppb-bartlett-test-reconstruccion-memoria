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
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useGraphQuery, useOperation } from "@ontahi/react/graph";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconEye,
  IconFlask,
  IconRocket,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Experiment } from "@/generated/client-entities";

const ExperimentWorkspace = Experiment.view("ExperimentWorkspace", {
  id: true,
  title: true,
  participantTitle: true,
  introduction: true,
  consentText: true,
  story: true,
  recallInstructions: true,
  intervalSeconds: true,
  distractorEnabled: true,
  status: true,
  createdAt: true,
  publishedAt: true,
  publicToken: true,
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
  const publish = useOperation(Experiment.domain.publish);
  const [publishOpened, publishModal] = useDisclosure(false);
  const form = useForm({
    initialValues: {
      title: "",
      participantTitle: "",
      introduction: "",
      consentText: "",
      story: "",
      recallInstructions: "",
      intervalSeconds: 0,
      distractorEnabled: false,
    },
    validate: {
      title: (value) => (value.trim() ? null : "Ingresá un nombre."),
      participantTitle: (value) =>
        value.trim() ? null : "Ingresá el título visible.",
      introduction: (value) =>
        value.trim() ? null : "Ingresá una introducción.",
      consentText: (value) =>
        value.trim() ? null : "Ingresá el consentimiento.",
      story: (value) => (value.trim() ? null : "Ingresá la historia."),
      recallInstructions: (value) =>
        value.trim() ? null : "Ingresá las instrucciones.",
    },
  });

  useEffect(() => {
    if (experiment.data) {
      form.setValues({
        title: experiment.data.title,
        participantTitle: experiment.data.participantTitle,
        introduction: experiment.data.introduction,
        consentText: experiment.data.consentText,
        story: experiment.data.story,
        recallInstructions: experiment.data.recallInstructions,
        intervalSeconds: experiment.data.intervalSeconds,
        distractorEnabled: experiment.data.distractorEnabled,
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
      participantTitle: values.participantTitle,
      introduction: values.introduction,
      consentText: values.consentText,
      story: values.story,
      recallInstructions: values.recallInstructions,
      intervalSeconds: values.intervalSeconds,
      distractorEnabled: values.distractorEnabled,
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

  const handlePublish = async () => {
    const result = await publish.executeAsync({
      experiment: Experiment.refById(experimentId),
      publishedAt: new Date().toISOString(),
      publicToken: crypto.randomUUID(),
    });

    if (result.ok) {
      publishModal.close();
      notifications.show({
        title: "Experimento publicado",
        message: "El protocolo quedó bloqueado para edición.",
        color: "teal",
      });
      return;
    }

    notifications.show({
      title: "No se pudo publicar",
      message: result.message,
      color: "red",
    });
  };

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
                    <Badge
                      variant="light"
                      color={
                        experiment.data.status === "published" ? "teal" : "gray"
                      }
                    >
                      {experiment.data.status === "published"
                        ? "Publicado"
                        : "Borrador"}
                    </Badge>
                    <Button
                      component={Link}
                      href={`/experiments/${experimentId}/preview`}
                      variant="default"
                      leftSection={<IconEye size={18} />}
                    >
                      Vista previa
                    </Button>
                    {experiment.data.status === "draft" && (
                      <Button
                        leftSection={<IconRocket size={18} />}
                        onClick={publishModal.open}
                        disabled={form.isDirty()}
                      >
                        Publicar
                      </Button>
                    )}
                  </Group>
                </Group>

                <Card withBorder padding="lg">
                  <form onSubmit={handleSave}>
                    <Stack gap="lg">
                      <TextInput
                        label="Nombre del experimento"
                        description="Sólo lo ven los administradores."
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("title")}
                      />
                      <TextInput
                        label="Título para participantes"
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("participantTitle")}
                      />
                      <Textarea
                        label="Introducción"
                        minRows={3}
                        autosize
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("introduction")}
                      />
                      <Textarea
                        label="Consentimiento"
                        minRows={3}
                        autosize
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("consentText")}
                      />
                      <Textarea
                        label="Historia"
                        description="El texto se mostrará a los participantes durante la etapa de lectura."
                        minRows={12}
                        autosize
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("story")}
                      />
                      <Textarea
                        label="Instrucciones de reconstrucción"
                        minRows={3}
                        autosize
                        required
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("recallInstructions")}
                      />
                      <NumberInput
                        label="Intervalo antes de reconstruir"
                        description="Duración en segundos. Usá 0 para pasar directamente."
                        min={0}
                        max={3600}
                        suffix=" s"
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("intervalSeconds")}
                      />
                      <Switch
                        label="Usar distractor durante el intervalo"
                        disabled={experiment.data.status !== "draft"}
                        {...form.getInputProps("distractorEnabled", {
                          type: "checkbox",
                        })}
                      />
                      <Group justify="flex-end">
                        {experiment.data.status === "draft" && (
                          <Button
                            type="submit"
                            leftSection={<IconDeviceFloppy size={18} />}
                            loading={updateDraft.isExecuting}
                            disabled={!form.isDirty()}
                          >
                            Guardar cambios
                          </Button>
                        )}
                      </Group>
                    </Stack>
                  </form>
                </Card>
              </>
            )}
          </Stack>
        </Container>
      </AppShell.Main>

      <Modal
        opened={publishOpened}
        onClose={publishModal.close}
        title="Publicar experimento"
        centered
      >
        <Stack>
          <Text>
            Al publicar, el protocolo quedará bloqueado para que todas las
            personas reciban exactamente la misma experiencia.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={publishModal.close}>
              Cancelar
            </Button>
            <Button
              leftSection={<IconRocket size={18} />}
              loading={publish.isExecuting}
              onClick={() => void handlePublish()}
            >
              Confirmar publicación
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
};

export default ExperimentWorkspacePage;

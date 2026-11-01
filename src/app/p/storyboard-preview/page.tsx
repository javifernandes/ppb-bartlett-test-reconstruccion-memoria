"use client";

import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Image,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useState } from "react";

const basketStory = `Al amanecer, una mujer llegó a un pueblo junto al río llevando una canasta cubierta con hojas azules. Dijo que venía de la montaña y buscaba la casa donde las piedras cantaban durante la lluvia.

Un anciano le advirtió que no cruzara el puente antes de que pasaran tres canoas, porque el río todavía estaba soñando. La mujer esperó, pero sólo vio pasar dos. Entonces dejó la canasta en la orilla y cruzó.

Cuando llegó al otro lado, escuchó un silbido dentro de la canasta. Al abrirla encontró un pez pequeño con plumas blancas. El pez pronunció el nombre del anciano y después quedó inmóvil.

Esa noche comenzó a llover. Desde el pueblo se oyó cantar a las piedras, pero la mujer no regresó. A la mañana siguiente, encontraron la canasta vacía debajo del puente.`;

type ReadingMode = "text" | "storyboard";
type StoryboardView = "sequence" | "overview";

const frames = [
  "La mujer llega al pueblo junto al río al amanecer.",
  "La mujer pregunta por la casa donde cantan las piedras.",
  "El anciano le advierte que espere tres canoas.",
  "La mujer observa pasar solamente dos canoas.",
  "La mujer deja la canasta en la orilla y cruza el puente.",
  "La mujer encuentra el pez con plumas blancas dentro de la canasta.",
  "Durante la lluvia, las piedras comienzan a cantar.",
  "La canasta vacía aparece debajo del puente a la mañana siguiente.",
];

const initialCaptions = [
  "Al amanecer, una mujer llegó desde la montaña.",
  "Busco la casa donde las piedras cantan bajo la lluvia.",
  "No cruces hasta que hayan pasado tres canoas.",
  "Esperó. Sólo pasaron dos.",
  "Dejó la canasta en la orilla y cruzó.",
  "El pez pronunció el nombre del anciano.",
  "Esa noche, las piedras comenzaron a cantar.",
  "A la mañana siguiente, la canasta estaba vacía.",
];

const StoryboardPreviewPage = () => {
  const [readingMode, setReadingMode] = useState<ReadingMode>("text");
  const [storyboardView, setStoryboardView] =
    useState<StoryboardView>("sequence");
  const [frameIndex, setFrameIndex] = useState(0);

  const openFrame = (index: number) => {
    setFrameIndex(index);
    setStoryboardView("sequence");
  };

  const advanceFrame = () => {
    setFrameIndex((current) =>
      current === frames.length - 1 ? 0 : current + 1,
    );
  };

  return (
    <Box mih="100dvh" bg="var(--mantine-color-body)">
      <Container size="lg" px="md" py={{ base: 32, sm: 64 }}>
        <Paper withBorder p={{ base: "lg", sm: 40 }} radius="lg">
          <Stack gap="xl">
            <Stack gap="xs">
              <Badge variant="light" w="fit-content">
                Laboratorio visual
              </Badge>
              <Title order={1}>La historia de la canasta</Title>
              <Text c="dimmed">
                Preview experimental: compará la lectura textual con su
                adaptación visual.
              </Text>
            </Stack>

            <SegmentedControl
              fullWidth
              value={readingMode}
              data={[
                { value: "text", label: "Texto" },
                { value: "storyboard", label: "Storyboard" },
              ]}
              onChange={(value) => setReadingMode(value as ReadingMode)}
              aria-label="Modo de lectura"
            />

            {readingMode === "text" ? (
              <Text
                size="lg"
                lh={1.8}
                maw={720}
                mx="auto"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {basketStory}
              </Text>
            ) : (
              <Stack gap="lg">
                <SegmentedControl
                  fullWidth
                  value={storyboardView}
                  data={[
                    { value: "sequence", label: "Cuadro a cuadro" },
                    { value: "overview", label: "Grilla" },
                  ]}
                  onChange={(value) =>
                    setStoryboardView(value as StoryboardView)
                  }
                  aria-label="Vista del storyboard"
                />

                {storyboardView === "sequence" ? (
                  <Stack gap="md" align="center">
                    <Image
                      src={`/storyboards/historia-de-la-canasta-${String(
                        frameIndex + 1,
                      ).padStart(2, "0")}.png`}
                      alt={frames[frameIndex]}
                      radius="md"
                      fit="contain"
                      maw={560}
                      mah="62dvh"
                    />
                    <Paper withBorder p="md" radius="md" maw={560} w="100%">
                      <Text size="lg" fw={500} ta="center" lh={1.45}>
                        {initialCaptions[frameIndex]}
                      </Text>
                    </Paper>
                    <Group gap="xs" justify="center" aria-hidden="true">
                      {frames.map((_, index) => (
                        <Box
                          key={index}
                          w={index === frameIndex ? 22 : 8}
                          h={8}
                          bdrs="xl"
                          bg={
                            index === frameIndex
                              ? "var(--mantine-color-teal-6)"
                              : "var(--mantine-color-gray-5)"
                          }
                          style={{ transition: "width 160ms ease" }}
                        />
                      ))}
                    </Group>
                    <Button
                      size="lg"
                      fullWidth
                      maw={560}
                      onClick={advanceFrame}
                      aria-label={
                        frameIndex === frames.length - 1
                          ? "Volver al comienzo del storyboard"
                          : `Siguiente, abrir viñeta ${frameIndex + 2} de ${frames.length}`
                      }
                    >
                      {frameIndex === frames.length - 1
                        ? "Volver al comienzo"
                        : "Siguiente"}
                    </Button>
                  </Stack>
                ) : (
                  <Stack gap="sm">
                    <Text size="sm" c="dimmed">
                      Seleccioná una viñeta para abrirla en la secuencia.
                    </Text>
                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                      {frames.map((description, index) => (
                        <UnstyledButton
                          key={description}
                          onClick={() => openFrame(index)}
                          aria-label={`Abrir viñeta ${index + 1}: ${description}`}
                          style={{ borderRadius: "var(--mantine-radius-md)" }}
                        >
                          <Image
                            src={`/storyboards/historia-de-la-canasta-${String(
                              index + 1,
                            ).padStart(2, "0")}.png`}
                            alt=""
                            radius="md"
                          />
                        </UnstyledButton>
                      ))}
                    </SimpleGrid>
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default StoryboardPreviewPage;

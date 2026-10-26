"use client";

import {
  Badge,
  Box,
  Card,
  Group,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useMemo, useState } from "react";

import { useI18n } from "@/app/i18n";
import {
  demoMemoryCohortSize,
  demoMemoryUnits,
  type DemoMemoryUnit,
  type DemoTransformation,
} from "@/application/demo-memory-map";
import { inferConceptAnchors } from "@/application/story-concepts";

type Mode = "retention" | "transformations";

const presenceRate = (unit: DemoMemoryUnit, cohortSize: number) =>
  (unit.fullCount + unit.traceCount) / Math.max(1, cohortSize);

const weightedRetentionRate = (unit: DemoMemoryUnit, cohortSize: number) =>
  (unit.fullCount + unit.traceCount * 0.5) / Math.max(1, cohortSize);

const cohortPercentage = (count: number, cohortSize: number) =>
  Math.round((count / Math.max(1, cohortSize)) * 100);

const retentionColor = (unit: DemoMemoryUnit, cohortSize: number) => {
  const score = weightedRetentionRate(unit, cohortSize);
  if (score >= 0.8) return "rgba(18, 184, 134, 0.42)";
  if (score >= 0.4) return "rgba(245, 159, 0, 0.3)";
  return "rgba(250, 82, 82, 0.3)";
};

const transformationColor = (unit: DemoMemoryUnit) => {
  if (unit.transformations.length === 0) return "transparent";
  const total = unit.transformations.reduce(
    (sum, transformation) => sum + transformation.count,
    0,
  );
  return total >= 12 ? "rgba(121, 80, 242, 0.38)" : "rgba(121, 80, 242, 0.23)";
};

const transformationBadge = (kind: DemoTransformation["kind"]) => {
  if (kind === "substitution") return "violet";
  if (kind === "rationalization") return "orange";
  return "blue";
};

const ConceptText = ({ unit }: { unit: DemoMemoryUnit }) => {
  const concepts = unit.concepts?.length
    ? unit.concepts
    : inferConceptAnchors(unit.text);
  const ranges = concepts
    .flatMap((concept) => {
      const start = unit.text.indexOf(concept);
      return start < 0 ? [] : [{ start, end: start + concept.length }];
    })
    .sort((left, right) => left.start - right.start)
    .filter(
      (range, index, all) => index === 0 || range.start >= all[index - 1].end,
    );
  const parts: Array<{ text: string; concept: boolean }> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({
        text: unit.text.slice(cursor, range.start),
        concept: false,
      });
    }
    parts.push({
      text: unit.text.slice(range.start, range.end),
      concept: true,
    });
    cursor = range.end;
  }
  if (cursor < unit.text.length) {
    parts.push({ text: unit.text.slice(cursor), concept: false });
  }

  return (
    <>
      {parts.map((part, index) =>
        part.concept ? (
          <Box
            key={`${part.text}-${index}`}
            component="span"
            style={{
              textDecorationLine: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "var(--mantine-color-teal-5)",
              textDecorationThickness: "1px",
              textUnderlineOffset: 4,
            }}
          >
            {part.text}
          </Box>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
};

const MemoryUnitDetail = ({
  unit,
  cohortSize,
}: {
  unit: DemoMemoryUnit;
  cohortSize: number;
}) => {
  const { t } = useI18n();
  const present = Math.round(presenceRate(unit, cohortSize) * 100);

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {t("Unidad seleccionada")}
          </Text>
          <Text size="lg" fw={650} mt={4}>
            “<ConceptText unit={unit} />”
          </Text>
          <Text size="xs" c="dimmed" mt={6}>
            {t("El subrayado señala las anclas conceptuales de la unidad.")}
          </Text>
        </div>

        <div>
          <Group justify="space-between" mb={6}>
            <Text size="sm" fw={600}>
              {t("Presente total o parcialmente")}
            </Text>
            <Text size="sm" fw={700}>
              {present} %
            </Text>
          </Group>
          <Progress.Root size="xl">
            <Progress.Section
              value={(unit.fullCount / Math.max(1, cohortSize)) * 100}
              color="teal"
            />
            <Progress.Section
              value={(unit.traceCount / Math.max(1, cohortSize)) * 100}
              color="yellow"
            />
            <Progress.Section
              value={(unit.absentCount / Math.max(1, cohortSize)) * 100}
              color="red"
            />
          </Progress.Root>
          <Group gap="lg" mt="xs">
            <Tooltip
              multiline
              w={260}
              withArrow
              label={t(
                "La respuesta conserva la idea central y sus relaciones principales.",
              )}
            >
              <Text
                size="xs"
                c="teal.4"
                tabIndex={0}
                style={{ cursor: "help" }}
              >
                ● {t("Completa")}: {unit.fullCount} (
                {cohortPercentage(unit.fullCount, cohortSize)} %)
              </Text>
            </Tooltip>
            <Tooltip
              multiline
              w={260}
              withArrow
              label={t(
                "La respuesta conserva algún concepto o palabra, pero no la idea completa.",
              )}
            >
              <Text
                size="xs"
                c="yellow.5"
                tabIndex={0}
                style={{ cursor: "help" }}
              >
                ● {t("Huella")}: {unit.traceCount} (
                {cohortPercentage(unit.traceCount, cohortSize)} %)
              </Text>
            </Tooltip>
            <Tooltip
              multiline
              w={260}
              withArrow
              label={t(
                "No hay evidencia suficiente de esta unidad en la reconstrucción.",
              )}
            >
              <Text size="xs" c="red.4" tabIndex={0} style={{ cursor: "help" }}>
                ● {t("Omitida")}: {unit.absentCount} (
                {cohortPercentage(unit.absentCount, cohortSize)} %)
              </Text>
            </Tooltip>
          </Group>
        </div>

        <div>
          <Text size="sm" fw={650} mb="xs">
            {t("Transformaciones frecuentes")}
          </Text>
          {unit.transformations.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("No aparecen transformaciones recurrentes en esta unidad.")}
            </Text>
          ) : (
            <Stack gap="sm">
              {unit.transformations.map((transformation) => (
                <Box key={transformation.label}>
                  <Group gap="xs">
                    <Badge
                      variant="light"
                      color={transformationBadge(transformation.kind)}
                    >
                      {t(
                        transformation.kind === "substitution"
                          ? "Sustitución"
                          : transformation.kind === "rationalization"
                            ? "Racionalización"
                            : "Generalización",
                      )}
                    </Badge>
                    <Text size="sm" fw={600}>
                      {transformation.label}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {transformation.count}×
                    </Text>
                  </Group>
                  {transformation.examples.map((example) => (
                    <Text key={example} size="sm" c="dimmed" fs="italic" mt={4}>
                      “{example}”
                    </Text>
                  ))}
                </Box>
              ))}
            </Stack>
          )}
        </div>
      </Stack>
    </Card>
  );
};

export const MemoryMap = ({
  story,
  units = demoMemoryUnits,
  responseCount = demoMemoryCohortSize,
}: {
  story: string;
  units?: DemoMemoryUnit[];
  responseCount?: number;
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("retention");
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? "");
  const selected = units.find((unit) => unit.id === selectedId) ?? units[0];
  const storyParts = useMemo(() => {
    let cursor = 0;
    const parts: Array<
      | { kind: "plain"; text: string; id: string }
      | { kind: "unit"; unit: DemoMemoryUnit }
    > = [];

    units.forEach((unit) => {
      const start = story.indexOf(unit.text, cursor);
      if (start < 0) return;
      if (start > cursor) {
        parts.push({
          kind: "plain",
          text: story.slice(cursor, start),
          id: `plain-${cursor}`,
        });
      }
      parts.push({ kind: "unit", unit });
      cursor = start + unit.text.length;
    });
    if (cursor < story.length) {
      parts.push({
        kind: "plain",
        text: story.slice(cursor),
        id: `plain-${cursor}`,
      });
    }
    return parts;
  }, [story, units]);

  if (!selected) return null;

  return (
    <Card withBorder padding="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs">
              <Title order={2}>{t("Mapa de recuerdo")}</Title>
              <Badge variant="light" color="gray">
                {responseCount} {t("respuestas")}
              </Badge>
            </Group>
            <Text c="dimmed" mt={4}>
              {t(
                "Explorá qué partes de la historia sobrevivieron y cómo fueron transformadas.",
              )}
            </Text>
          </div>
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            data={[
              { label: t("Retención"), value: "retention" },
              { label: t("Transformaciones"), value: "transformations" },
            ]}
          />
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card withBorder padding="lg" radius="md" bg="dark.7">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="md">
              {t("Historia original")}
            </Text>
            <Box style={{ fontSize: "1rem", lineHeight: 1.55 }}>
              {storyParts.map((part) => {
                if (part.kind === "plain") {
                  return <span key={part.id}>{part.text}</span>;
                }
                const unit = part.unit;
                const isSelected = unit.id === selectedId;
                return (
                  <Box
                    key={unit.id}
                    component="button"
                    type="button"
                    onClick={() => setSelectedId(unit.id)}
                    aria-pressed={isSelected}
                    style={{
                      display: "block",
                      width: "100%",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      boxShadow:
                        mode === "transformations" &&
                        unit.transformations.length > 0
                          ? "inset 0 -2px 0 var(--mantine-color-violet-4)"
                          : "none",
                      outline: isSelected
                        ? "2px solid var(--mantine-color-gray-4)"
                        : "none",
                      outlineOffset: -2,
                      borderRadius: 6,
                      padding: "7px 10px",
                      margin: "0 0 6px",
                      color: "inherit",
                      background:
                        mode === "retention"
                          ? retentionColor(unit, responseCount)
                          : transformationColor(unit),
                      cursor: "pointer",
                      font: "inherit",
                      lineHeight: "inherit",
                      textAlign: "left",
                    }}
                  >
                    {unit.text}
                  </Box>
                );
              })}
            </Box>

            <Group gap="lg" mt="lg">
              {mode === "retention" ? (
                <>
                  <Text size="xs" c="dimmed">
                    <Text component="span" c="teal.4">
                      ■
                    </Text>{" "}
                    {t("Alta retención")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    <Text component="span" c="yellow.5">
                      ■
                    </Text>{" "}
                    {t("Retención media")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    <Text component="span" c="red.4">
                      ■
                    </Text>{" "}
                    {t("Baja retención")}
                  </Text>
                </>
              ) : (
                <Text size="xs" c="dimmed">
                  <Text component="span" c="violet.4">
                    ■
                  </Text>{" "}
                  {t("Presenta transformaciones recurrentes")}
                </Text>
              )}
            </Group>
          </Card>

          <MemoryUnitDetail unit={selected} cohortSize={responseCount} />
        </SimpleGrid>
      </Stack>
    </Card>
  );
};

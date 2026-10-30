"use client";

import { Button, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";

import { useI18n } from "@/app/i18n";

type DistractorCardProps = {
  values: readonly number[];
  selectedValues: readonly number[];
  expectedValues: readonly number[];
  complete: boolean;
  onSelect: (value: number) => void;
  onReset: () => void;
};

export const DistractorCard = ({
  values,
  selectedValues,
  expectedValues,
  complete,
  onSelect,
  onReset,
}: DistractorCardProps) => {
  const { t } = useI18n();

  return (
    <Paper withBorder p="lg" w="100%">
      <Stack gap="md">
        <div>
          <Text fw={700}>{t("Ordená los números de mayor a menor")}</Text>
          <Text c="dimmed" size="sm">
            {t("Tocá cada número en el orden correcto.")}
          </Text>
        </div>
        <SimpleGrid cols={4} spacing="xs">
          {values.map((value) => (
            <Button
              key={value}
              variant="light"
              size="lg"
              px={0}
              fullWidth
              disabled={selectedValues.includes(value)}
              style={{ minWidth: 0 }}
              styles={{ label: { overflow: "visible" } }}
              onClick={() => onSelect(value)}
            >
              {value}
            </Button>
          ))}
        </SimpleGrid>
        <Text mih={24} fw={600}>
          {selectedValues.length > 0
            ? selectedValues.join(" › ")
            : t("Tu orden aparecerá acá")}
        </Text>
        {selectedValues.length === expectedValues.length && !complete && (
          <Text c="red">{t("Ese orden no es correcto. Probá de nuevo.")}</Text>
        )}
        {complete && (
          <Text c="teal" fw={600}>
            {t("¡Orden correcto!")}
          </Text>
        )}
        <Group justify="center">
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={18} />}
            disabled={selectedValues.length === 0}
            onClick={onReset}
          >
            {t("Reiniciar")}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
};

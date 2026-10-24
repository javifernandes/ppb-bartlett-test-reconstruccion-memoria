"use client";

import { Group, Stack, Text, Title } from "@mantine/core";

import { LanguageSelector, useI18n } from "../i18n";

export const LoginCopy = ({ invalid }: { invalid: boolean }) => {
  const { t } = useI18n();
  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>{t("Prueba de Bartlett")}</Title>
          <Text c="dimmed" mt="xs">
            {t("Ingresá al espacio de administración.")}
          </Text>
        </div>
        <LanguageSelector compact />
      </Group>
      {invalid && (
        <Text c="red">
          {t("El enlace no es válido o ya venció. Pedí uno nuevo.")}
        </Text>
      )}
    </Stack>
  );
};

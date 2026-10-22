"use client";

import { AppShell, Box, Group, Text, UnstyledButton } from "@mantine/core";
import { IconArrowLeft, IconFlask } from "@tabler/icons-react";
import Link from "next/link";

export const AdminHeader = ({
  section,
  backHref,
}: {
  section: string;
  backHref?: string;
}) => (
  <AppShell.Header px={{ base: "sm", sm: "md" }}>
    <Box
      h="100%"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(40px, 1fr) auto minmax(40px, 1fr)",
        alignItems: "center",
      }}
    >
      <UnstyledButton component={Link} href="/" w="fit-content">
        <Group gap="sm" wrap="nowrap">
          <IconFlask size={24} />
          <Text fw={600} visibleFrom="sm" truncate>
            Prueba de Bartlett
          </Text>
        </Group>
      </UnstyledButton>

      <Group gap="xs" wrap="nowrap" justify="center">
        {backHref && (
          <UnstyledButton
            component={Link}
            href={backHref}
            aria-label="Volver"
            title="Volver"
          >
            <IconArrowLeft size={19} />
          </UnstyledButton>
        )}
        <Text
          fw={600}
          size="sm"
          truncate
          maw={{ base: 190, sm: 520, lg: 760 }}
          title={section}
        >
          {section}
        </Text>
      </Group>

      <Box />
    </Box>
  </AppShell.Header>
);

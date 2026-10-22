"use client";

import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowLeft, IconFlask, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { signOut } from "./login/actions";

export const AdminHeader = ({
  section,
  backHref,
}: {
  section: string;
  backHref?: string;
}) => {
  const [email, setEmail] = useState<string>();

  useEffect(() => {
    let active = true;
    void createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setEmail(data.user?.email);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
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

        <Group gap="xs" wrap="nowrap" justify="flex-end">
          {email && (
            <Text size="sm" c="dimmed" visibleFrom="md" truncate maw={240}>
              {email}
            </Text>
          )}
          <Box component="form" action={signOut}>
            <Tooltip label="Cerrar sesión">
              <ActionIcon
                type="submit"
                variant="subtle"
                color="gray"
                aria-label="Cerrar sesión"
              >
                <IconLogout size={19} />
              </ActionIcon>
            </Tooltip>
          </Box>
        </Group>
      </Box>
    </AppShell.Header>
  );
};

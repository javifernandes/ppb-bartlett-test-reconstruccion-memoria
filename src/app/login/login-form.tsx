"use client";

import { Alert, Button, Paper, Stack, Text, TextInput } from "@mantine/core";
import { IconCheck, IconInfoCircle } from "@tabler/icons-react";
import { useActionState } from "react";

import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export const LoginForm = ({ next }: { next: string }) => {
  const [state, action, pending] = useActionState(
    requestMagicLink,
    initialState,
  );

  return (
    <Paper component="form" action={action} withBorder p="xl" radius="md">
      <Stack>
        <input type="hidden" name="next" value={next} />
        <TextInput
          name="email"
          type="email"
          label="Email"
          placeholder="nombre@ejemplo.com"
          autoComplete="email"
          required
          disabled={pending || state.status === "sent"}
        />
        {state.message && (
          <Alert
            color={state.status === "error" ? "red" : "teal"}
            icon={state.status === "error" ? <IconInfoCircle /> : <IconCheck />}
          >
            {state.message}
          </Alert>
        )}
        <Button
          type="submit"
          loading={pending}
          disabled={state.status === "sent"}
        >
          Enviar enlace mágico
        </Button>
        <Text size="sm" c="dimmed">
          El acceso está limitado a los integrantes invitados del equipo.
        </Text>
      </Stack>
    </Paper>
  );
};

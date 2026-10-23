"use client";

import {
  Alert,
  Button,
  Divider,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconBrandGoogle,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useActionState, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export const LoginForm = ({ next }: { next: string }) => {
  const [state, action, pending] = useActionState(
    requestMagicLink,
    initialState,
  );
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string>();

  const signInWithGoogle = async () => {
    setGooglePending(true);
    setGoogleError(undefined);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setGooglePending(false);
      setGoogleError("No se pudo iniciar el acceso con Google.");
    }
  };

  return (
    <Paper component="form" action={action} withBorder p="xl" radius="md">
      <Stack>
        <Button
          type="button"
          variant="default"
          leftSection={<IconBrandGoogle size={20} />}
          loading={googlePending}
          disabled={pending}
          onClick={() => void signInWithGoogle()}
        >
          Continuar con Google
        </Button>
        {googleError && (
          <Alert color="red" icon={<IconInfoCircle />}>
            {googleError}
          </Alert>
        )}

        <Divider label="o ingresá por email" labelPosition="center" />

        <input type="hidden" name="next" value={next} />
        <TextInput
          name="email"
          type="email"
          label="Email"
          placeholder="nombre@ejemplo.com"
          autoComplete="email"
          required
          disabled={pending || googlePending || state.status === "sent"}
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
          disabled={googlePending || state.status === "sent"}
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

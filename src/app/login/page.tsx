import { Container, Stack, Text, Title } from "@mantine/core";

import { LoginForm } from "./login-form";

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) => {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/";

  return (
    <Container size={440} py={{ base: 48, sm: 96 }}>
      <Stack gap="xl">
        <div>
          <Title order={1}>Prueba de Bartlett</Title>
          <Text c="dimmed" mt="xs">
            Ingresá al espacio de administración.
          </Text>
        </div>
        {params.error && (
          <Text c="red">
            El enlace no es válido o ya venció. Pedí uno nuevo.
          </Text>
        )}
        <LoginForm next={next} />
      </Stack>
    </Container>
  );
};

export default LoginPage;

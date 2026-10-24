import { Container, Stack } from "@mantine/core";

import { LoginForm } from "./login-form";
import { LoginCopy } from "./login-copy";

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
        <LoginCopy invalid={Boolean(params.error)} />
        <LoginForm next={next} />
      </Stack>
    </Container>
  );
};

export default LoginPage;

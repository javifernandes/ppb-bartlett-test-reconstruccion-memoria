"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
  OntahiGraphProvider,
  createFetchGraphClient,
} from "@ontahi/react/graph";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: "Inter, system-ui, sans-serif",
});

const graphClient = createFetchGraphClient({
  runtimeTransport: { endpoint: "/api/runtime" },
});

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <OntahiGraphProvider
          runtime={{ name: "browser" }}
          identity={{ principal: null, cacheScope: "local-development" }}
          client={graphClient}
        >
          {children}
        </OntahiGraphProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
};

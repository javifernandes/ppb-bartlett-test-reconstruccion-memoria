"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
  createOntahiDiagnostics,
  instrumentRuntimeTransport,
} from "@ontahi/devtools";
import { OntahiDevtools } from "@ontahi/devtools/react";
import {
  OntahiGraphProvider,
  createFetchRuntimeTransport,
  createRuntimeGraphClient,
} from "@ontahi/react/graph";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { clientApplication } from "@/generated/client-entities";

import { I18nProvider } from "./i18n";

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: "Inter, system-ui, sans-serif",
});

const redactSensitiveValues = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactSensitiveValues);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /authorization|cookie|credential|password|secret|token/i.test(key)
        ? "[redacted]"
        : redactSensitiveValues(item),
    ]),
  );
};

const diagnostics =
  process.env.NODE_ENV === "development"
    ? createOntahiDiagnostics({
        capacity: 300,
        capturePayloads: true,
        redact: redactSensitiveValues,
      })
    : undefined;
const fetchRuntimeTransport = createFetchRuntimeTransport({
  endpoint: "/api/runtime",
});
const runtimeTransport = diagnostics
  ? instrumentRuntimeTransport({
      diagnostics,
      id: "http",
      kind: "fetch",
      transport: fetchRuntimeTransport,
    })
  : fetchRuntimeTransport;
const graphClient = createRuntimeGraphClient({
  application: clientApplication,
  runtimeTransport,
});

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <I18nProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <OntahiGraphProvider
            runtime={{ name: "browser" }}
            identity={{ principal: null, cacheScope: "local-development" }}
            client={graphClient}
          >
            {children}
            {diagnostics ? (
              <OntahiDevtools
                diagnostics={diagnostics}
                runtimeTransport={runtimeTransport}
              />
            ) : null}
          </OntahiGraphProvider>
        </QueryClientProvider>
      </I18nProvider>
    </MantineProvider>
  );
};

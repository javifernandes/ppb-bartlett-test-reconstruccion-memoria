import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Prueba de Bartlett",
  description: "Experimentos de reconstrucción de una historia",
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <html lang="es" data-mantine-color-scheme="dark">
    <body>
      <Providers>{children}</Providers>
    </body>
  </html>
);

export default RootLayout;

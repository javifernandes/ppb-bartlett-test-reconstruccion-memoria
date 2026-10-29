import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Bartlett Memory Experiment",
  description:
    "Take part in a short, anonymous experiment about how we remember and reconstruct stories.",
  openGraph: {
    title: "Bartlett Memory Experiment",
    description:
      "Read a short story, complete a brief activity, and reconstruct it from memory.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bartlett Memory Experiment",
    description:
      "Read a short story, complete a brief activity, and reconstruct it from memory.",
  },
};

const ParticipantLayout = ({ children }: Readonly<{ children: ReactNode }>) =>
  children;

export default ParticipantLayout;

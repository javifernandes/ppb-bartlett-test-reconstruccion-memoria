import type { GraphReadPolicy } from "@ontahi/core/data-graph";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";

export type LocalRuntimeAuthority = {
  principal: null;
};

const ExperimentReadPolicy = {
  entity: Experiment,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 100,
  fields: {
    id: { select: true, filter: ["eq", "in"] },
    title: { select: true, filter: ["eq", "in"], order: true },
    participantTitle: { select: true },
    introduction: { select: true },
    consentText: { select: true },
    story: { select: true },
    recallInstructions: { select: true },
    intervalSeconds: { select: true },
    distractorEnabled: { select: true },
    status: { select: true, filter: ["eq", "in"] },
    createdAt: { select: true, order: true },
    publishedAt: { select: true },
    publicToken: { select: true, filter: ["eq"] },
  },
  scope: "all",
} satisfies GraphReadPolicy<typeof Experiment, LocalRuntimeAuthority>;

const ParticipantSessionReadPolicy = {
  entity: ParticipantSession,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 500,
  fields: {
    id: { select: true, filter: ["eq", "in"] },
    experiment: { select: true, filter: ["eq", "in"] },
    status: { select: true, filter: ["eq", "in"] },
    startedAt: { select: true, order: true },
    intervalStartedAt: { select: true },
    recallingStartedAt: { select: true },
    lastActivityAt: { select: true, order: true },
    recallText: { select: true },
    submittedAt: { select: true, order: true },
  },
  scope: "all",
} satisfies GraphReadPolicy<typeof ParticipantSession, LocalRuntimeAuthority>;

const AnalysisRunReadPolicy = {
  entity: AnalysisRun,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 100,
  fields: {
    id: { select: true, filter: ["eq", "in"] },
    experiment: { select: true, filter: ["eq", "in"] },
    status: { select: true, filter: ["eq", "in"] },
    analyzerVersion: { select: true },
    createdAt: { select: true, order: true },
  },
  scope: "all",
} satisfies GraphReadPolicy<typeof AnalysisRun, LocalRuntimeAuthority>;

export const localGraphReadPolicies = [
  ExperimentReadPolicy,
  ParticipantSessionReadPolicy,
  AnalysisRunReadPolicy,
] as const;

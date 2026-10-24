import {
  selection,
  selectionAll,
  selectionNone,
  type GraphReadPolicy,
} from "@ontahi/core/data-graph";
import type { Principal } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";
import { RecallAnalysis } from "./recall-analysis";

export type LocalRuntimeAuthority = {
  principal: Principal | null;
  participantSessionIds: string[];
  participantPublicToken?: string;
  cacheScope: readonly string[];
};

const authenticatedScope = ({
  authority,
}: {
  authority: LocalRuntimeAuthority;
}) => (authority.principal ? selectionAll() : selectionNone());

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
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    const publicToken = authority.participantPublicToken;
    if (!publicToken) return selectionNone();

    return selection(entity, (experiment) =>
      experiment.status.eq("published"),
    ).and((experiment) => experiment.publicToken.eq(publicToken));
  },
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
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    if (authority.participantSessionIds.length === 0) return selectionNone();

    return selection(entity, (session) =>
      session.id.in(authority.participantSessionIds),
    );
  },
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
  scope: authenticatedScope,
} satisfies GraphReadPolicy<typeof AnalysisRun, LocalRuntimeAuthority>;

const RecallAnalysisReadPolicy = {
  entity: RecallAnalysis,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 500,
  fields: {
    id: { select: true, filter: ["eq", "in"] },
    run: { select: true, filter: ["eq", "in"] },
    session: { select: true, filter: ["eq", "in"] },
    experiment: { select: true, filter: ["eq", "in"] },
    status: { select: true, filter: ["eq", "in"] },
    rubricVersion: { select: true },
    retainedUnitsCount: { select: true, order: true },
    omittedUnitsCount: { select: true, order: true },
    intrusionCount: { select: true, order: true },
    phenomena: { select: true },
    createdAt: { select: true, order: true },
  },
  scope: authenticatedScope,
} satisfies GraphReadPolicy<typeof RecallAnalysis, LocalRuntimeAuthority>;

export const localGraphReadPolicies = [
  ExperimentReadPolicy,
  ParticipantSessionReadPolicy,
  AnalysisRunReadPolicy,
  RecallAnalysisReadPolicy,
] as const;

import {
  defineGraphReadPolicy,
  selection,
  selectionAll,
  selectionNone,
} from "@ontahi/core/data-graph";
import type { Principal } from "@ontahi/core/runtime/server";
import type { ServerRuntimeResourceMap } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "./analysis-run";
import { Experiment } from "./experiment";
import { ParticipantSession } from "./participant-session";
import { RecallAnalysis } from "./recall-analysis";
import { ResultShare } from "./result-share";
import { ShareChannel } from "./share-channel";

export type LocalRuntimeAuthority = {
  principal: Principal | null;
  participantSessionIds: string[];
  participantPublicToken?: string;
  resultShare?: {
    token: string;
    sessionId: string;
  };
  resources: ServerRuntimeResourceMap;
  cacheScope: readonly string[];
};

const authenticatedScope = ({
  authority,
}: {
  authority: LocalRuntimeAuthority;
}) => (authority.principal ? selectionAll() : selectionNone());

const ExperimentReadPolicy = defineGraphReadPolicy<
  typeof Experiment,
  LocalRuntimeAuthority
>({
  entity: Experiment,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 100,
  allow: {
    select: [
      "id",
      "title",
      "participantTitle",
      "introduction",
      "consentText",
      "story",
      "recallInstructions",
      "primaryLanguage",
      "alternateLanguage",
      "alternateParticipantTitle",
      "alternateIntroduction",
      "alternateConsentText",
      "alternateStory",
      "alternateRecallInstructions",
      "intervalSeconds",
      "distractorEnabled",
      "status",
      "createdAt",
      "publishedAt",
      "publicToken",
      "analysisRunId",
      "analysisRubrics",
      "analysisPreparedAt",
    ],
    filter: {
      id: ["eq", "in"],
      title: ["eq", "in"],
      status: ["eq", "in"],
      publicToken: ["eq"],
    },
    order: ["title", "createdAt"],
  },
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    const publicToken = authority.participantPublicToken;
    if (!publicToken) return selectionNone();

    return selection(entity, (experiment) =>
      experiment.status.eq("published"),
    ).and((experiment) => experiment.publicToken.eq(publicToken));
  },
});

const ParticipantSessionReadPolicy = defineGraphReadPolicy<
  typeof ParticipantSession,
  LocalRuntimeAuthority
>({
  entity: ParticipantSession,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 500,
  allow: {
    select: [
      "id",
      "experiment",
      "shareChannel",
      "contentLanguage",
      "countryCode",
      "browserLocale",
      "timezone",
      "deviceType",
      "browser",
      "operatingSystem",
      "screenWidth",
      "screenHeight",
      "status",
      "startedAt",
      "intervalStartedAt",
      "recallingStartedAt",
      "lastActivityAt",
      "recallText",
      "submittedAt",
    ],
    filter: {
      id: ["eq", "in"],
      experiment: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: ["startedAt", "lastActivityAt", "submittedAt"],
  },
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    const allowedIds = authority.participantSessionIds;
    if (allowedIds.length === 0) return selectionNone();

    return selection(entity, (session) => session.id.in(allowedIds));
  },
});

const ResultShareReadPolicy = defineGraphReadPolicy<
  typeof ResultShare,
  LocalRuntimeAuthority
>({
  entity: ResultShare,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 100,
  allow: {
    select: [
      "id",
      "experiment",
      "session",
      "contentLanguage",
      "story",
      "recallText",
      "status",
      "createdAt",
    ],
    filter: {
      id: ["eq", "in"],
      experiment: ["eq", "in"],
      session: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: ["createdAt"],
  },
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    if (!authority.resultShare) return selectionNone();
    return selection(entity, (share) =>
      share.id.eq(authority.resultShare!.token),
    ).and((share) => share.status.eq("active"));
  },
});

const ShareChannelReadPolicy = defineGraphReadPolicy<
  typeof ShareChannel,
  LocalRuntimeAuthority
>({
  entity: ShareChannel,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 500,
  allow: {
    select: ["id", "experiment", "name", "status", "createdAt"],
    filter: {
      id: ["eq", "in"],
      experiment: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: ["name", "createdAt"],
  },
  scope: authenticatedScope,
});

const AnalysisRunReadPolicy = defineGraphReadPolicy<
  typeof AnalysisRun,
  LocalRuntimeAuthority
>({
  entity: AnalysisRun,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 100,
  allow: {
    select: ["id", "experiment", "status", "analyzerVersion", "createdAt"],
    filter: {
      id: ["eq", "in"],
      experiment: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: ["createdAt"],
  },
  scope: authenticatedScope,
});

const RecallAnalysisReadPolicy = defineGraphReadPolicy<
  typeof RecallAnalysis,
  LocalRuntimeAuthority
>({
  entity: RecallAnalysis,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 500,
  allow: {
    select: [
      "id",
      "run",
      "session",
      "experiment",
      "status",
      "rubricVersion",
      "retainedUnitsCount",
      "omittedUnitsCount",
      "intrusionCount",
      "phenomena",
      "unitAssessments",
      "createdAt",
    ],
    filter: {
      id: ["eq", "in"],
      run: ["eq", "in"],
      session: ["eq", "in"],
      experiment: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: [
      "retainedUnitsCount",
      "omittedUnitsCount",
      "intrusionCount",
      "createdAt",
    ],
  },
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    if (!authority.resultShare) return selectionNone();
    return selection(entity, (analysis) =>
      analysis.session.eq(
        ParticipantSession.refById(authority.resultShare!.sessionId),
      ),
    );
  },
});

export const localGraphReadPolicies = [
  ExperimentReadPolicy,
  ParticipantSessionReadPolicy,
  AnalysisRunReadPolicy,
  RecallAnalysisReadPolicy,
  ResultShareReadPolicy,
  ShareChannelReadPolicy,
] as const;

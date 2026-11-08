import {
  defineGraphReadPolicy,
  selection,
  selectionAll,
  selectionNone,
} from "@ontahi/core/data-graph";
import type { Principal } from "@ontahi/core/runtime/server";
import type { ServerRuntimeResourceMap } from "@ontahi/core/runtime/server";

import { AnalysisRun } from "../entities/analysis-run";
import { Experiment } from "../entities/experiment";
import { ExperimentResultShare } from "../entities/experiment-result-share";
import { ParticipantSession } from "../entities/participant-session";
import { RecallAnalysis } from "../entities/recall-analysis";
import { ResultShare } from "../entities/result-share";
import { ShareChannel } from "../entities/share-channel";

export type LocalRuntimeAuthority = {
  principal: Principal | null;
  participantSessionIds: string[];
  participantPublicToken?: string;
  resultShare?: {
    token: string;
    sessionId: string;
  };
  experimentResultShare?: {
    token: string;
    experimentId: string;
    runId: string;
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
      "liveAnalysisRunId",
      "reportingAnalysisRunId",
      "analysisRubrics",
      "analysisPreparedAt",
      "semanticAnalysisRubrics",
      "semanticAnalysisPreparedAt",
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
    if (authority.experimentResultShare) {
      return selection(entity, (experiment) =>
        experiment.id.eq(authority.experimentResultShare!.experimentId),
      );
    }
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
    if (authority.experimentResultShare) {
      return selection(entity, (session) =>
        session.experiment.eq(
          Experiment.refById(authority.experimentResultShare!.experimentId),
        ),
      ).and((session) => session.status.eq("submitted"));
    }
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
      "readingSeconds",
      "distractorSeconds",
      "recallSeconds",
      "totalSeconds",
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

const ExperimentResultShareReadPolicy = defineGraphReadPolicy<
  typeof ExperimentResultShare,
  LocalRuntimeAuthority
>({
  entity: ExperimentResultShare,
  modes: ["get", "run", "count"],
  cardinalities: ["one", "many"],
  maxLimit: 100,
  allow: {
    select: ["id", "experiment", "run", "status", "createdAt"],
    filter: {
      id: ["eq", "in"],
      experiment: ["eq", "in"],
      run: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: ["createdAt"],
  },
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    if (!authority.experimentResultShare) return selectionNone();
    return selection(entity, (share) =>
      share.id.eq(authority.experimentResultShare!.token),
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
    select: [
      "id",
      "experiment",
      "status",
      "analyzerVersion",
      "schemaVersion",
      "rubricSnapshot",
      "completedAt",
      "sourceResponseCount",
      "createdAt",
    ],
    filter: {
      id: ["eq", "in"],
      experiment: ["eq", "in"],
      status: ["eq", "in"],
    },
    order: ["createdAt"],
  },
  scope: ({ authority, entity }) => {
    if (authority.principal) return selectionAll();
    if (!authority.experimentResultShare) return selectionNone();
    return selection(entity, (run) =>
      run.id.eq(authority.experimentResultShare!.runId),
    );
  },
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
      "semanticAssessment",
      "semanticSummary",
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
    if (authority.experimentResultShare) {
      return selection(entity, (analysis) =>
        analysis.run.eq(
          AnalysisRun.refById(authority.experimentResultShare!.runId),
        ),
      );
    }
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
  ExperimentResultShareReadPolicy,
  ShareChannelReadPolicy,
] as const;

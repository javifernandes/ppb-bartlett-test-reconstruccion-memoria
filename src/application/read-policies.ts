import type { GraphReadPolicy } from "@ontahi/core/data-graph";

import { Experiment } from "./experiment";

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
    status: { select: true, filter: ["eq", "in"] },
    createdAt: { select: true, order: true },
  },
  scope: "all",
} satisfies GraphReadPolicy<typeof Experiment, LocalRuntimeAuthority>;

export const localGraphReadPolicies = [ExperimentReadPolicy] as const;

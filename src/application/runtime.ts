import { createRuntimeProtocolDispatcher } from "@ontahi/core/runtime/protocol";
import { createOperationInvocationDispatcher } from "@ontahi/core/runtime/server";

import { BartlettApplication } from "./graph";
import {
  localGraphReadPolicies,
  type LocalRuntimeAuthority,
} from "./read-policies";

const operationDispatcher =
  createOperationInvocationDispatcher(BartlettApplication);
const graphReadDispatcher =
  BartlettApplication.createGraphReadDispatcher<LocalRuntimeAuthority>(
    localGraphReadPolicies,
  );

export const localRuntimeProtocolDispatcher =
  createRuntimeProtocolDispatcher<LocalRuntimeAuthority>({
    handlers: {
      operation: (request, authority) =>
        BartlettApplication.app.runtime.withInvocationContext(authority, () =>
          operationDispatcher(request),
        ),
      "graph.read": (request, authority) =>
        graphReadDispatcher(request, { authority }),
    },
  });

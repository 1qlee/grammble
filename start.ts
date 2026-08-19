import { createStart } from "@tanstack/react-start";
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { validateServerEnv } from "~/utils/env";

// Fail fast at server boot if the production environment is misconfigured.
validateServerEnv();

// Sentry middleware capture server request + server-function errors. They are
// no-ops until the server SDK is initialized (see instrument.server.mjs), and
// must be first in each array so they wrap everything downstream.
export const startInstance = createStart(() => {
  return {
    requestMiddleware: [sentryGlobalRequestMiddleware],
    functionMiddleware: [sentryGlobalFunctionMiddleware],
  };
});

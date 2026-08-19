import { createStart } from "@tanstack/react-start";
import { validateServerEnv } from "~/utils/env";

// Fail fast at server boot if the production environment is misconfigured.
validateServerEnv();

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [],
  };
});

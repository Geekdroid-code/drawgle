import { defineConfig } from "@trigger.dev/sdk";

import { getTriggerProjectRef } from "@/lib/env/server";

export default defineConfig({
  project: getTriggerProjectRef(),
  dirs: ["./trigger"],
  runtime: "node-22",
  logLevel: "info",
  enableConsoleLogging: true,
  legacyDevProcessCwdBehaviour: false,
  maxDuration: 900,
  ttl: "1h",
  processKeepAlive: {
    enabled: true,
    maxExecutionsPerProcess: 50,
    devMaxPoolSize: 10,
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
});
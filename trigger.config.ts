import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "drawgle-local",
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
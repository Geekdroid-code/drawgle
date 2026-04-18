import { logger, tasks } from "@trigger.dev/sdk";

tasks.onStartAttempt(({ ctx, task }) => {
  logger.info("Trigger task attempt started", {
    task,
    runId: ctx.run.id,
  });
});

tasks.onFailure(({ ctx, task, error }) => {
  logger.error("Trigger task failed", {
    task,
    runId: ctx.run.id,
    error: error instanceof Error ? error.message : String(error),
  });
});


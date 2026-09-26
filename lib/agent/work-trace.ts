export type WorkTraceStep = {
  id: string;
  kind: "stage" | "tool";
  title: string;
  detail: string | null;
  status: "active" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
};

export type WorkTrace = {
  version: 1;
  turnId: string;
  sequence: number;
  status: "active" | "completed" | "failed";
  steps: WorkTraceStep[];
};

const MAX_STEPS = 16;
const short = (value: string, limit: number) => value.replace(/[\r\n\t]+/g, " ").trim().slice(0, limit);
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function readWorkTrace(metadata: Record<string, unknown>): WorkTrace | null {
  const value = record(metadata.workTrace);
  if (value?.version !== 1 || typeof value.turnId !== "string" || !value.turnId ||
    typeof value.sequence !== "number" || !Number.isInteger(value.sequence) || value.sequence < 1 ||
    !["active", "completed", "failed"].includes(String(value.status)) || !Array.isArray(value.steps)) return null;
  const steps = value.steps.slice(-MAX_STEPS).flatMap((entry) => {
    const step = record(entry);
    if (!step || typeof step.id !== "string" || typeof step.title !== "string" ||
      typeof step.startedAt !== "string" || !["stage", "tool"].includes(String(step.kind)) ||
      !["active", "completed", "failed"].includes(String(step.status))) return [];
    return [{
      id: short(step.id, 100), kind: step.kind as WorkTraceStep["kind"], title: short(step.title, 100),
      detail: typeof step.detail === "string" ? short(step.detail, 240) : null,
      status: step.status as WorkTraceStep["status"], startedAt: step.startedAt,
      completedAt: typeof step.completedAt === "string" ? step.completedAt : null,
    }];
  });
  return { version: 1, turnId: value.turnId, sequence: value.sequence,
    status: value.status as WorkTrace["status"], steps };
}

export function updateWorkTrace(current: WorkTrace | null, input: {
  turnId: string;
  id: string;
  title: string;
  detail?: string | null;
  kind?: WorkTraceStep["kind"];
  stepStatus?: WorkTraceStep["status"];
  turnStatus?: WorkTrace["status"];
}, at = new Date().toISOString()): WorkTrace {
  const prior = current?.turnId === input.turnId ? current : null;
  const status = input.stepStatus ?? "active";
  const steps = prior?.steps.map((step) => ({ ...step })) ?? [];
  const id = short(input.id, 100);
  const existing = steps.find((step) => step.id === id);
  if (status === "active") {
    for (const step of steps) {
      if (step.id !== id && step.status === "active") {
        step.status = "completed";
        step.completedAt = at;
      }
    }
  }
  if (existing) {
    existing.kind = input.kind ?? existing.kind;
    existing.title = short(input.title, 100);
    existing.detail = input.detail ? short(input.detail, 240) : null;
    existing.status = status;
    existing.completedAt = status === "active" ? null : at;
  } else {
    steps.push({ id, kind: input.kind ?? "stage", title: short(input.title, 100),
      detail: input.detail ? short(input.detail, 240) : null, status,
      startedAt: at, completedAt: status === "active" ? null : at });
  }
  const turnStatus = input.turnStatus ?? (status === "active" ? "active" : prior?.status ?? "active");
  if (turnStatus !== "active") {
    for (const step of steps) {
      if (step.status === "active") {
        step.status = turnStatus;
        step.completedAt = at;
      }
    }
  }
  return { version: 1, turnId: input.turnId, sequence: (prior?.sequence ?? 0) + 1,
    status: turnStatus, steps: steps.slice(-MAX_STEPS) };
}

export function preferNewerWorkTrace<T extends { metadata: Record<string, unknown> }>(
  current: T, incoming: T,
): T {
  const existing = readWorkTrace(current.metadata);
  const next = readWorkTrace(incoming.metadata);
  return existing && next && existing.turnId === next.turnId && existing.sequence > next.sequence
    ? current : incoming;
}

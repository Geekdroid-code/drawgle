import { z } from "zod";

export const historyTargetSchema = z.discriminatedUnion("context", [
  z.object({ context: z.literal("screen"), screenId: z.string().uuid() }),
  z.object({ context: z.literal("tokens") }), z.object({ context: z.literal("navigation") }),
]);
export type HistoryTarget = z.infer<typeof historyTargetSchema>;
export const screenSnapshotSchema = z.object({ code: z.string().min(1) }).strict();
export const tokensSnapshotSchema = z.object({ tokens: z.record(z.string(), z.unknown()).nullable() }).strict();
export const navigationSnapshotSchema = z.object({
  plan: z.record(z.string(), z.unknown()), shellCode: z.string(),
  assignments: z.array(z.object({ screenId: z.string().uuid(), chromePolicy: z.record(z.string(), z.unknown()).nullable(),
    navigationItemId: z.string().nullable(), parentScreenId: z.string().uuid().nullable(),
    stateKey: z.string().nullable(), roadmapItemId: z.string().uuid().nullable() }).strict()),
}).strict();
export const historyResultSchema = z.object({
  status: z.enum(["success", "stale_revision", "busy_target", "unavailable_entry", "incompatible_navigation"]),
  revision: z.number().int().nonnegative().optional(), replayed: z.boolean().optional(), unchanged: z.boolean().optional(),
});
export type HistoryResult = z.infer<typeof historyResultSchema>;
export const snapshotSchemaFor = (target: HistoryTarget) => target.context === "screen" ? screenSnapshotSchema : target.context === "tokens" ? tokensSnapshotSchema : navigationSnapshotSchema;

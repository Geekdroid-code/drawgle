import { applyProductPatch, createProductPlanning } from "./model";
import { functionalItemSchema } from "./functional-plan";
import type { FlowReview } from "./flow-review";

export function appointmentFlow() {
  const state = applyProductPatch(createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null }), { operations: [
    ...[
      ["identity", "clinic", "Book clinic appointments"], ["actors", "patient", "Patient booking care"],
      ["jobs", "book", "Obtain a confirmed appointment"], ["journeys", "booking", "Choose availability and confirm a reservation"],
      ["surfaces", "appointments", "Appointment availability and reservation"],
    ].map(([section, id, detail]) => ({ op: "put_fact", fact: { section, id, label: id, detail, source: "assumption" } })),
    { op: "set_scope", goal: "The complete booking app", rationale: "Complete the patient's job", surfaceIds: ["appointments"],
      outputKeys: ["screen:availability", "state:availability:reserved"] },
  ] }, "11111111-1111-4111-8111-111111111111");
  const availability = functionalItemSchema.parse({ stableKey: "screen:availability", kind: "screen", name: "Availability",
    surfaceIds: ["appointments"], journeyIds: ["booking"], description: "Choose a time and reserve it",
    information: "Doctor, date and available times", entryCondition: "Patient opens booking", outcome: "Appointment reserved",
    actions: [{ label: "Reserve", destinationKey: "state:availability:reserved", outcome: "Reserve the selected appointment" }],
    inlineStates: ["If the slot was taken, refresh availability and keep the date"], sequence: 0 });
  const reserved = functionalItemSchema.parse({ ...availability, stableKey: "state:availability:reserved", kind: "state", name: "Reserved",
    parentStableKey: availability.stableKey, stateKey: "reserved", triggerLabel: "Reservation succeeds",
    editInstruction: "Show the confirmed appointment details in place of available times", actions: [], sequence: 1 });
  const review: FlowReview = { ready: true, issues: [], requestedScope: "whole_product", scopeEvidence: "Build the complete booking app",
    journeys: [{ actorId: "patient", jobId: "book", journeyId: "booking", outcome: "Patient has a confirmed appointment",
      outputKeys: [availability.stableKey, reserved.stableKey], entryKey: availability.stableKey, completionKeys: [reserved.stableKey] }] };
  return { state, roadmap: [availability, reserved], review, messages: [review.scopeEvidence] };
}

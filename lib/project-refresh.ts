// Realtime remains the main update path; completed requests also refresh local state
// so a missed subscription event cannot strand an approval or initial conversation.
export const PROJECT_REFRESH_EVENT = "drawgle:project-refresh";
export function notifyProjectChanged(projectId: string) {
  window.dispatchEvent(new CustomEvent(PROJECT_REFRESH_EVENT, { detail: { projectId } }));
}
export function isProjectRefresh(event: Event, projectId: string) {
  return (event as CustomEvent<{ projectId?: string }>).detail?.projectId === projectId;
}

import type { ScreenData } from "@/lib/types";

export function sameScreenSourceVersion(a: ScreenData, b: ScreenData) {
  return a.designRevision !== undefined && b.designRevision !== undefined
    ? a.designRevision === b.designRevision : a.updatedAt === b.updatedAt;
}
export function mergeScreenCatalog(catalog: ScreenData[], current: ScreenData[]) {
  const byId = new Map(current.map(screen => [screen.id, screen]));
  return catalog.map(screen => {
    const existing = byId.get(screen.id);
    if (existing?.designRevision !== undefined && screen.designRevision !== undefined && existing.designRevision > screen.designRevision) return existing;
    return existing?.sourceLoaded && sameScreenSourceVersion(existing, screen)
      ? { ...screen, code: existing.code, blockIndex: existing.blockIndex, sourceLoaded: true } : screen;
  });
}
export function acceptFetchedSource(entries: ScreenData[], source: ScreenData) {
  return entries.map(current => {
    if (current.id !== source.id) return current;
    if (current.designRevision !== undefined && source.designRevision !== undefined) {
      return source.designRevision >= current.designRevision ? source : current;
    }
    return new Date(source.updatedAt).getTime() >= new Date(current.updatedAt).getTime() ? source : current;
  });
}

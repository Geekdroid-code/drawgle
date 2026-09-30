import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";
import { mapProjectNavigationRow, mapScreenRow } from "@/lib/supabase/mappers";
import { normalizeRadiusClass } from "@/lib/generation/design-classes";
import type { NormalizedBox } from "@/lib/generation/reference-palette";
import type { DesignTokens, ProjectCharter, ProjectNavigationData, RadiusClass, ScreenData } from "@/lib/types";

import type { ReferenceElevation } from "./checks";

/**
 * Everything the harness needs to judge a project, as plain JSON. Loading it needs
 * the database; judging it does not, so a saved bundle can be replayed offline.
 */
export type EvalReference = {
  source: "curated" | "upload" | "none";
  id: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  /** File name of the saved reference image inside a bundle directory. */
  file: string | null;
};

export type ProjectBundle = {
  version: 1;
  fetchedAt: string;
  project: {
    id: string;
    name: string;
    prompt: string;
    designTokens: DesignTokens | null;
    charter: ProjectCharter | null;
    productPlanning: Record<string, unknown> | null;
  };
  screens: ScreenData[];
  navigation: ProjectNavigationData | null;
  reference: EvalReference;
};

export type ReferenceImage = { bytes: Buffer; extension: string };

const ELEVATIONS = new Set<string>(["flat-tone", "hairline", "soft-shadow", "strong-shadow"]);

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** The reference's elevation class as stored in the project's reference DNA, or unknown. */
export const referenceElevationOf = (charter: ProjectCharter | null | undefined): ReferenceElevation => {
  const analysis = record(record(charter?.referenceDna)?.analysis);
  const value = analysis?.surfaceElevation;
  return typeof value === "string" && ELEVATIONS.has(value) ? value as ReferenceElevation : "unknown";
};

/** The reference's radius class as stored in the reference DNA, or null. */
export const referenceRadiusClassOf = (charter: ProjectCharter | null | undefined): RadiusClass | null =>
  normalizeRadiusClass(record(record(charter?.referenceDna)?.analysis)?.radiusClass);

/** The screen boxes the reference analysis reported, for measuring the palette. */
export const referenceBoxesOf = (charter: ProjectCharter | null | undefined): NormalizedBox[] => {
  const screens = record(record(charter?.referenceDna)?.analysis)?.screenReferences;
  if (!Array.isArray(screens)) return [];
  return screens.flatMap((screen) => {
    const box = record(record(screen)?.boundingBox);
    const numbers = [box?.x, box?.y, box?.width, box?.height];
    return numbers.every((value) => typeof value === "number" && Number.isFinite(value))
      ? [{ x: box!.x as number, y: box!.y as number, width: box!.width as number, height: box!.height as number }]
      : [];
  });
};

/**
 * Whether the approved product flow describes persistent navigation, or null when
 * it does not say. A structured decision on the approved scope wins over the
 * discovery designer's free-text description of the navigation.
 */
export const flowHasNavigation = (productPlanning: Record<string, unknown> | null): boolean | null => {
  const structured = record(record(productPlanning?.scope)?.navigation);
  if (typeof structured?.persistent === "boolean") return structured.persistent;
  const description = record(productPlanning?.experience)?.navigation;
  if (typeof description !== "string" || !description.trim()) return null;
  if (/\b(?:no|without|avoid)\b[^.]{0,30}\b(?:persistent|bottom|tab|navigation|nav)\b/i.test(description)) return false;
  return /\b(?:persistent|bottom (?:bar|nav|navigation|tab)|tab bar|dock|icon bar)\b/i.test(description) ? true : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_PREFIX = /^[0-9a-f]{6,8}(?:-[0-9a-f]{1,4}){0,3}$/i;

/** Expands a project id or a unique prefix such as "0ce99a06" to the full id. */
export const projectIdRange = (value: string) => {
  const trimmed = value.trim().toLowerCase().replace(/…$/, "");
  if (UUID.test(trimmed)) return { exact: trimmed };
  if (!UUID_PREFIX.test(trimmed)) throw new Error(`"${value}" is not a project id or an id prefix of at least 6 hex characters.`);
  const digits = trimmed.replace(/-/g, "");
  const fill = (character: string) => (digits + character.repeat(32 - digits.length))
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  return { from: fill("0"), to: fill("f") };
};

/** createAdminClient() is untyped on purpose, and so is this. */
type Admin = any;

export async function resolveProjectId(admin: Admin, value: string) {
  const range = projectIdRange(value);
  if ("exact" in range) return range.exact;
  const { data, error } = await admin.from("projects").select("id,name").gte("id", range.from).lte("id", range.to).limit(5);
  if (error) throw new Error("The project lookup failed.");
  if (!data?.length) throw new Error(`No project id starts with ${value}.`);
  if (data.length > 1) {
    throw new Error(`More than one project id starts with ${value}: ${data.map((row: { id: string }) => row.id).join(", ")}.`);
  }
  return data[0].id as string;
}

const isCurated = (id: unknown): id is string =>
  typeof id === "string" && CURATED_STYLE_REFERENCES.some((reference) => reference.id === id);

export async function loadProjectBundle(admin: Admin, projectRef: string): Promise<ProjectBundle> {
  const projectId = await resolveProjectId(admin, projectRef);
  const { data: project, error: projectError } = await admin.from("projects")
    .select("id,name,prompt,design_tokens,project_charter,product_planning").eq("id", projectId).single();
  if (projectError || !project) throw new Error("The project could not be read.");

  const { data: screenRows, error: screenError } = await admin.from("screens").select("*")
    .eq("project_id", projectId).order("sort_index", { ascending: true }).order("created_at", { ascending: true });
  if (screenError) throw new Error("The project's screens could not be read.");

  const { data: navigationRow } = await admin.from("project_navigation").select("*").eq("project_id", projectId).maybeSingle();

  const charter = (project.project_charter as ProjectCharter | null) ?? null;
  const productPlanning = record(project.product_planning);
  const dna = record(charter?.referenceDna);
  const experience = record(productPlanning?.experience);
  const curatedId = [dna?.sourceReferenceId, experience?.referenceId].find(isCurated) ?? null;

  let imagePath = [dna?.sourceImagePath, experience?.referencePath, record(productPlanning?.input)?.imagePath]
    .find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
  if (!imagePath && !curatedId) {
    const { data: runs } = await admin.from("generation_runs").select("image_path").eq("project_id", projectId)
      .not("image_path", "is", null).order("created_at", { ascending: false }).limit(1);
    imagePath = runs?.[0]?.image_path ?? null;
  }
  const curated = curatedId ? CURATED_STYLE_REFERENCES.find((reference) => reference.id === curatedId) ?? null : null;

  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      prompt: project.prompt ?? "",
      designTokens: (project.design_tokens as DesignTokens | null) ?? null,
      charter,
      productPlanning,
    },
    screens: (screenRows ?? []).map(mapScreenRow),
    navigation: navigationRow ? mapProjectNavigationRow(navigationRow) : null,
    reference: {
      source: curated ? "curated" : imagePath ? "upload" : "none",
      id: curated?.id ?? null,
      imageUrl: curated?.imageUrl ?? null,
      imagePath: curated ? null : imagePath,
      file: null,
    },
  };
}

const extensionOf = (mimeType: string | null | undefined, fallback = "jpg") => {
  if (!mimeType) return fallback;
  if (/png/i.test(mimeType)) return "png";
  if (/webp/i.test(mimeType)) return "webp";
  if (/gif/i.test(mimeType)) return "gif";
  return /jpe?g/i.test(mimeType) ? "jpg" : fallback;
};

export async function loadReferenceImage(admin: Admin | null, reference: EvalReference): Promise<ReferenceImage | null> {
  if (reference.imageUrl) {
    const response = await fetch(reference.imageUrl);
    if (!response.ok) throw new Error(`The curated reference image could not be downloaded (${response.status}).`);
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      extension: extensionOf(response.headers.get("content-type"), path.extname(reference.imageUrl).slice(1) || "jpg"),
    };
  }
  if (reference.imagePath && admin) {
    const { data, error } = await admin.storage.from("generation-assets").download(reference.imagePath);
    if (error || !data) throw new Error("The stored reference image could not be downloaded.");
    return { bytes: Buffer.from(await data.arrayBuffer()), extension: extensionOf(data.type) };
  }
  return null;
}

export async function saveBundle(directory: string, bundle: ProjectBundle, image: ReferenceImage | null) {
  await mkdir(directory, { recursive: true });
  const file = image ? `reference.${image.extension}` : null;
  if (image && file) await writeFile(path.join(directory, file), image.bytes);
  const saved: ProjectBundle = { ...bundle, reference: { ...bundle.reference, file } };
  await writeFile(path.join(directory, "bundle.json"), JSON.stringify(saved, null, 2));
  return saved;
}

export async function readBundle(directory: string): Promise<{ bundle: ProjectBundle; image: ReferenceImage | null }> {
  const bundle = JSON.parse(await readFile(path.join(directory, "bundle.json"), "utf8")) as ProjectBundle;
  if (bundle.version !== 1) throw new Error(`Unsupported bundle version ${String(bundle.version)}.`);
  const file = bundle.reference.file;
  const image = file
    ? { bytes: await readFile(path.join(directory, file)), extension: path.extname(file).slice(1) || "jpg" }
    : null;
  return { bundle, image };
}

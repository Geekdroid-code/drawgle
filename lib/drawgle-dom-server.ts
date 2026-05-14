import "server-only";

import { createHash } from "node:crypto";

import { load } from "cheerio";

export type SelectedElementDomMergeDiagnostics = {
  selectedDrawgleId: string;
  sourceIdCount: number;
  replacementIdCount: number;
  finalIdCount: number;
  hadMarkdownFence: boolean;
  replacementRootTag: string | null;
  replacementRootCount: number;
  changed: boolean;
  rawReplacementPreview: string;
  outputHash: string;
  restoredMissingRootId: boolean;
  movedIdToRoot: boolean;
  removedDuplicateDescendantIds: number;
};

const RAW_REPLACEMENT_PREVIEW_LIMIT = 2400;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function countDrawgleIdOccurrencesInHtml(code: string, drawgleId: string) {
  if (!drawgleId) {
    return 0;
  }

  const escapedId = escapeRegExp(drawgleId);
  const regex = new RegExp(`\\sdata-drawgle-id\\s*=\\s*(?:"${escapedId}"|'${escapedId}'|${escapedId})(?=\\s|>|/)`, "gi");
  return Array.from(code.matchAll(regex)).length;
}

const stripMarkdownBackticks = (value: string) =>
  value
    .replace(/```[a-zA-Z0-9_-]*/g, "")
    .replace(/`+/g, "")
    .trim();

const createOutputHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const previewRawReplacement = (value: string) => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > RAW_REPLACEMENT_PREVIEW_LIMIT
    ? `${collapsed.slice(0, RAW_REPLACEMENT_PREVIEW_LIMIT)}...`
    : collapsed;
};

const findElementsByDrawgleId = ($: ReturnType<typeof load>, drawgleId: string) =>
  $("*")
    .filter((_, element) => $(element).attr("data-drawgle-id") === drawgleId)
    .toArray();

const getTopLevelElementNodes = ($: ReturnType<typeof load>) =>
  $.root()
    .contents()
    .toArray()
    .filter((node) => node.type === "tag");

export function replaceSelectedDrawgleElement({
  sourceCode,
  replacementHtml,
  rawReplacementHtml,
  drawgleId,
}: {
  sourceCode: string;
  replacementHtml: string;
  rawReplacementHtml?: string | null;
  drawgleId: string;
}) {
  const rawReplacement = rawReplacementHtml ?? replacementHtml;
  const sanitizedReplacement = stripMarkdownBackticks(replacementHtml);
  const hadMarkdownFence = /```|`/.test(rawReplacement);
  const sourceIdCount = countDrawgleIdOccurrencesInHtml(sourceCode, drawgleId);
  const replacementIdCount = countDrawgleIdOccurrencesInHtml(sanitizedReplacement, drawgleId);

  if (sourceIdCount !== 1) {
    throw new Error(
      sourceIdCount === 0
        ? "Selected element target is stale. Please reselect the element."
        : "Selected element target is ambiguous because the saved source has duplicate Drawgle ids.",
    );
  }

  if (!sanitizedReplacement) {
    throw new Error("Selected-region edit returned an empty replacement.");
  }

  const $source = load(sourceCode, {}, false);
  const $replacement = load(sanitizedReplacement, {}, false);
  const sourceMatches = findElementsByDrawgleId($source, drawgleId);
  if (sourceMatches.length !== 1) {
    throw new Error(
      sourceMatches.length === 0
        ? "Selected element target could not be found in the parsed source."
        : "Selected element target is ambiguous in the parsed source.",
    );
  }

  const replacementRoots = getTopLevelElementNodes($replacement);
  if (replacementRoots.length !== 1) {
    throw new Error("Selected-region edit must return exactly one root HTML element.");
  }

  const replacementRoot = replacementRoots[0];
  const $replacementRoot = $replacement(replacementRoot);
  const replacementRootTagValue = $replacementRoot.prop("tagName");
  const replacementRootTag = typeof replacementRootTagValue === "string"
    ? replacementRootTagValue.toLowerCase()
    : null;
  const originalRootId = $replacementRoot.attr("data-drawgle-id") ?? null;
  let restoredMissingRootId = false;
  let movedIdToRoot = false;

  if (originalRootId !== drawgleId) {
    const selectedDescendants = $replacementRoot
      .find("*")
      .filter((_, element) => $replacement(element).attr("data-drawgle-id") === drawgleId);

    movedIdToRoot = selectedDescendants.length > 0;
    restoredMissingRootId = !originalRootId && selectedDescendants.length === 0;
    $replacementRoot.attr("data-drawgle-id", drawgleId);
  }

  let removedDuplicateDescendantIds = 0;
  $replacementRoot
    .find("*")
    .filter((_, element) => $replacement(element).attr("data-drawgle-id") === drawgleId)
    .each((_, element) => {
      $replacement(element).removeAttr("data-drawgle-id");
      removedDuplicateDescendantIds += 1;
    });

  const originalTargetHtml = $source.html(sourceMatches[0]) ?? "";
  const replacementRootHtml = $replacement.html($replacementRoot);
  if (!replacementRootHtml?.trim()) {
    throw new Error("Selected-region edit produced an empty replacement root.");
  }

  $source(sourceMatches[0]).replaceWith(replacementRootHtml);
  const nextCode = $source.root().html() ?? "";
  const finalIdCount = countDrawgleIdOccurrencesInHtml(nextCode, drawgleId);
  if (finalIdCount !== 1) {
    throw new Error("Selected-region edit failed Drawgle id integrity checks.");
  }

  return {
    code: nextCode,
    diagnostics: {
      selectedDrawgleId: drawgleId,
      sourceIdCount,
      replacementIdCount,
      finalIdCount,
      hadMarkdownFence,
      replacementRootTag,
      replacementRootCount: replacementRoots.length,
      changed: replacementRootHtml.trim() !== originalTargetHtml.trim(),
      rawReplacementPreview: previewRawReplacement(rawReplacement),
      outputHash: createOutputHash(rawReplacement),
      restoredMissingRootId,
      movedIdToRoot,
      removedDuplicateDescendantIds,
    } satisfies SelectedElementDomMergeDiagnostics,
  };
}

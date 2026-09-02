import type {
  ScreenBlock,
  ScreenBlockIndex,
  ScreenChromeKind,
  TopChromeContinuityEvidence,
} from "@/lib/types";

const MAX_EVIDENCE_CHARS = 1800;
const CLIPPED_SUFFIX = "<!-- clipped -->";

const CONTINUITY_CHROME_KINDS = new Set<ScreenChromeKind>([
  "top-bar",
  "top-bar-back",
  "modal-sheet",
  "immersive",
]);

export type RunChromeEvidence = Partial<Record<ScreenChromeKind, TopChromeContinuityEvidence>>;

export const supportsTopChromeContinuity = (
  chromeKind: ScreenChromeKind | null | undefined,
): chromeKind is ScreenChromeKind => Boolean(chromeKind && CONTINUITY_CHROME_KINDS.has(chromeKind));

const blockHint = (block: ScreenBlock) => [
  block.name,
  block.tagName,
  block.kind,
  block.keywords.join(" "),
].join(" ").toLowerCase();

const isTopChromeBlock = (block: ScreenBlock) => {
  if (block.kind === "header" || block.tagName === "header") return true;

  const hint = blockHint(block);
  const explicitlyTopChrome = /\b(top[\s-]?bar|app[\s-]?bar|tool[\s-]?bar|title[\s-]?bar|header)\b/.test(hint);
  const explicitlyBottomChrome = /\b(bottom|tab[\s-]?bar|footer)\b/.test(hint);
  return explicitlyTopChrome && !explicitlyBottomChrome;
};

const scoreTopChromeBlock = (block: ScreenBlock, blockIndex: ScreenBlockIndex, codeLength: number) => {
  const hint = blockHint(block);
  const root = blockIndex.blocks.find((entry) => entry.id === blockIndex.rootId);
  const rootStart = root?.startOffset ?? 0;
  const rootLength = Math.max(1, (root?.endOffset ?? codeLength) - rootStart);
  const relativeStart = Math.max(0, block.startOffset - rootStart) / rootLength;

  let score = 0;
  if (block.kind === "header") score += 120;
  if (block.tagName === "header") score += 80;
  if (block.parentId === blockIndex.rootId) score += 45;
  if (/\b(top[\s-]?bar|app[\s-]?bar|tool[\s-]?bar|title[\s-]?bar)\b/.test(hint)) score += 40;
  if (relativeStart <= 0.12) score += 35;
  else if (relativeStart <= 0.3) score += 15;
  score -= block.depth * 3;
  score -= Math.round(relativeStart * 20);
  return score;
};

const compactHtml = (html: string) => html
  .replace(/>\s+</g, "><")
  .replace(/\s+/g, " ")
  .trim();

const capEvidenceHtml = (html: string) => {
  if (html.length <= MAX_EVIDENCE_CHARS) return html;
  return `${html.slice(0, MAX_EVIDENCE_CHARS - CLIPPED_SUFFIX.length).trimEnd()}${CLIPPED_SUFFIX}`;
};

export function extractTopChromeContinuityEvidence({
  screenName,
  chromeKind,
  code,
  blockIndex,
}: {
  screenName: string;
  chromeKind: ScreenChromeKind | null | undefined;
  code: string;
  blockIndex: ScreenBlockIndex;
}): TopChromeContinuityEvidence | null {
  if (!supportsTopChromeContinuity(chromeKind) || !code.trim() || !blockIndex.rootId) return null;

  const candidate = blockIndex.blocks
    .filter((block) =>
      block.id !== blockIndex.rootId
      && (block.parentId === blockIndex.rootId || block.depth <= 2)
      && isTopChromeBlock(block))
    .sort((left, right) => {
      const scoreDifference = scoreTopChromeBlock(right, blockIndex, code.length)
        - scoreTopChromeBlock(left, blockIndex, code.length);
      return scoreDifference || left.startOffset - right.startOffset;
    })[0];

  if (!candidate) return null;

  const start = Math.max(0, Math.min(code.length, candidate.startOffset));
  const end = Math.max(start, Math.min(code.length, candidate.endOffset));
  const html = capEvidenceHtml(compactHtml(code.slice(start, end)));
  if (!html) return null;

  return {
    chromeKind,
    screenName,
    html,
  };
}

export function rememberFirstRunChromeEvidence(
  runEvidence: RunChromeEvidence,
  evidence: TopChromeContinuityEvidence | null | undefined,
) {
  if (!evidence || runEvidence[evidence.chromeKind]) return false;
  runEvidence[evidence.chromeKind] = evidence;
  return true;
}

export function buildTopChromeContinuityEvidenceSection(evidence: TopChromeContinuityEvidence) {
  return [
    "TOP CHROME CONTINUITY EVIDENCE",
    "",
    "This is the actual top chrome already established in this app:",
    evidence.html,
    "",
    "Preserve its established construction, leading-control treatment, icon choice where semantically equivalent, sizing, spacing, title placement, surface treatment, and alignment.",
    "Adapt only the title/content/trailing actions required by THIS screen.",
    "Do not copy unrelated screen body topology.",
  ].join("\n");
}

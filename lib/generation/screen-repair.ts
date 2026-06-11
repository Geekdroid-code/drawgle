import { detectTargetBlocks, indexScreenCode } from "@/lib/generation/block-index";
import type { ScreenBlockIndex } from "@/lib/types";

export type RepairTarget = {
  startOffset: number;
  endOffset: number;
  snippet: string;
  reason: string;
  blockId?: string | null;
  drawgleId?: string | null;
};

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const clampRegion = (code: string, startOffset: number, endOffset: number) => {
  const start = Math.max(0, Math.min(code.length, startOffset));
  const end = Math.max(start, Math.min(code.length, endOffset));
  return {
    startOffset: start,
    endOffset: end,
    snippet: code.slice(start, end).trim(),
  };
};

function findElementRegionByDrawgleId(code: string, drawgleId: string): RepairTarget | null {
  const attrPattern = new RegExp(`\\sdata-drawgle-id=(["'])${escapeRegExp(drawgleId)}\\1`, "i");
  const attrMatch = attrPattern.exec(code);
  if (!attrMatch || attrMatch.index == null) {
    return null;
  }

  const openStart = code.lastIndexOf("<", attrMatch.index);
  const openEnd = code.indexOf(">", attrMatch.index);
  if (openStart < 0 || openEnd < 0) {
    return null;
  }

  const tagMatch = /^<([a-zA-Z][\w:-]*)\b/.exec(code.slice(openStart, openEnd + 1));
  const tagName = tagMatch?.[1]?.toLowerCase();
  if (!tagName) {
    return null;
  }

  if (VOID_TAGS.has(tagName) || code[openEnd - 1] === "/") {
    const region = clampRegion(code, openStart, openEnd + 1);
    return { ...region, reason: "selected_drawgle_id", drawgleId };
  }

  const tagRegex = new RegExp(`</?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  tagRegex.lastIndex = openStart;
  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(code)) !== null) {
    const token = match[0];
    const selfClosing = token.endsWith("/>");
    const closing = token.startsWith("</");

    if (!closing && !selfClosing) {
      depth += 1;
    } else if (closing) {
      depth -= 1;
      if (depth === 0) {
        const region = clampRegion(code, openStart, tagRegex.lastIndex);
        return { ...region, reason: "selected_drawgle_id", drawgleId };
      }
    }
  }

  const fallbackEnd = Math.min(code.length, openEnd + 1 + 1800);
  const region = clampRegion(code, openStart, fallbackEnd);
  return { ...region, reason: "selected_drawgle_id_unclosed", drawgleId };
}

const findBlockRegion = (code: string, blockIndex: ScreenBlockIndex, blockId: string, reason: string): RepairTarget | null => {
  const block = blockIndex.blocks.find((entry) => entry.id === blockId);
  if (!block) {
    return null;
  }

  const region = clampRegion(code, block.startOffset, block.endOffset);
  return {
    ...region,
    reason,
    blockId,
  };
};

const chooseFallbackBlock = (blockIndex: ScreenBlockIndex) => {
  const blocks = blockIndex.blocks
    .filter((block) => block.id !== blockIndex.rootId)
    .sort((left, right) => {
      const leftSpan = left.endOffset - left.startOffset;
      const rightSpan = right.endOffset - right.startOffset;
      const leftScore = left.startOffset + leftSpan * 0.15;
      const rightScore = right.startOffset + rightSpan * 0.15;
      return rightScore - leftScore;
    });

  return blocks[0] ?? blockIndex.blocks.find((block) => block.id === blockIndex.rootId) ?? null;
};

export function findRepairTarget({
  code,
  drawgleId,
  blockIndex,
  prompt,
  preferContainer = false,
  allowFallback = true,
}: {
  code: string;
  drawgleId?: string | null;
  blockIndex?: ScreenBlockIndex | null;
  prompt?: string | null;
  preferContainer?: boolean;
  allowFallback?: boolean;
}): RepairTarget | null {
  if (drawgleId) {
    const selectedRegion = findElementRegionByDrawgleId(code, drawgleId);
    if (selectedRegion) {
      return selectedRegion;
    }
  }

  const resolvedBlockIndex = blockIndex ?? indexScreenCode(code);
  if (prompt?.trim()) {
    const resolution = detectTargetBlocks(prompt, resolvedBlockIndex);
    const initialBlockId = resolution.scope === "scoped" ? resolution.targetBlockIds[0] : null;
    const initialBlock = initialBlockId
      ? resolvedBlockIndex.blocks.find((entry) => entry.id === initialBlockId)
      : null;
    const parentBlock = initialBlock?.parentId
      ? resolvedBlockIndex.blocks.find((entry) => entry.id === initialBlock.parentId)
      : null;
    const blockId = preferContainer && parentBlock && parentBlock.id !== resolvedBlockIndex.rootId
      ? parentBlock.id
      : initialBlockId;

    if (blockId) {
      const blockRegion = findBlockRegion(code, resolvedBlockIndex, blockId, "prompt_block_match");
      if (blockRegion) {
        return blockRegion;
      }
    }
  }

  if (allowFallback === false) {
    return null;
  }

  const fallbackBlock = chooseFallbackBlock(resolvedBlockIndex);
  if (fallbackBlock) {
    return findBlockRegion(code, resolvedBlockIndex, fallbackBlock.id, "fallback_late_block");
  }

  return null;
}

export function replaceSourceRegion(code: string, target: Pick<RepairTarget, "startOffset" | "endOffset">, replacement: string) {
  const before = code.slice(0, target.startOffset);
  const after = code.slice(target.endOffset);
  return `${before}${replacement.trim()}${after}`;
}

export function buildRepairSurroundingContext(code: string, target: Pick<RepairTarget, "startOffset" | "endOffset">, chars = 1600) {
  const before = code.slice(Math.max(0, target.startOffset - chars), target.startOffset).trim();
  const after = code.slice(target.endOffset, Math.min(code.length, target.endOffset + chars)).trim();
  return { before, after };
}

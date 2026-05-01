import type { ScreenBlock, ScreenBlockIndex, ScreenBlockKind } from "@/lib/types";

type ParsedElement = {
  tempId: number;
  tagName: string;
  attributes: Record<string, string>;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  depth: number;
  parentTempId: number | null;
};

export type TargetBlockResolution = {
  scope: "scoped" | "full" | "ambiguous";
  targetBlockIds: string[];
};

const ROOT_BLOCK_ID = "screen-shell";
const MAX_BLOCKS = 24;
const MAX_PREVIEW_CHARS = 140;
const MAX_PARENT_CONTEXT_LINES = 80;

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

const INLINE_TAGS = new Set([
  "a",
  "b",
  "button",
  "em",
  "i",
  "label",
  "small",
  "span",
  "strong",
]);

const STRUCTURAL_TAGS = new Set([
  "article",
  "aside",
  "footer",
  "form",
  "header",
  "main",
  "nav",
  "section",
]);

const IGNORE_TAGS = new Set([
  "clippath",
  "defs",
  "lineargradient",
  "mask",
  "script",
  "style",
  "svg",
]);

const GLOBAL_EDIT_PATTERNS = [
  /entire\s+(screen|page|layout)/i,
  /whole\s+(screen|page|layout)/i,
  /full\s+(screen|page|layout)/i,
  /redesign\s+(the\s+)?(screen|page|layout)/i,
  /rework\s+(the\s+)?(screen|page|layout)/i,
  /across\s+the\s+screen/i,
  /throughout\s+the\s+screen/i,
  /overall\s+(screen|layout)/i,
  /every\s+section/i,
];

const KIND_SYNONYMS: Record<ScreenBlockKind, string[]> = {
  shell: ["screen", "page", "layout", "overall"],
  header: ["header", "top bar", "app bar", "toolbar", "title bar"],
  hero: ["hero", "banner", "intro"],
  nav: ["nav", "navigation", "navbar", "tab bar", "tabs", "menu", "bottom nav"],
  section: ["section", "content", "body", "container", "panel"],
  form: ["form", "input", "field", "fields", "search", "filter", "cta", "button"],
  list: ["list", "feed", "items", "rows", "results", "cards"],
  grid: ["grid", "gallery", "tiles", "collection"],
  stats: ["stats", "metrics", "analytics", "kpi"],
  chart: ["chart", "graph", "trend", "visualization"],
  profile: ["profile", "account", "avatar", "user"],
  settings: ["settings", "preferences", "toggle", "toggles"],
  modal: ["modal", "dialog", "sheet", "drawer", "overlay"],
  footer: ["footer", "bottom"],
};

const KEYWORD_HINTS: Array<{ kind: ScreenBlockKind; patterns: RegExp[] }> = [
  { kind: "header", patterns: [/header/i, /top[-_\s]?bar/i, /app[-_\s]?bar/i, /toolbar/i] },
  { kind: "hero", patterns: [/hero/i, /banner/i, /intro/i] },
  { kind: "nav", patterns: [/nav/i, /tab/i, /menu/i, /bottom[-_\s]?bar/i] },
  { kind: "footer", patterns: [/footer/i, /bottom/i] },
  { kind: "form", patterns: [/form/i, /input/i, /field/i, /search/i, /filter/i, /cta/i, /button/i] },
  { kind: "list", patterns: [/list/i, /feed/i, /row/i, /card/i, /result/i] },
  { kind: "grid", patterns: [/grid/i, /gallery/i, /tile/i, /collection/i] },
  { kind: "stats", patterns: [/stat/i, /metric/i, /analytics/i, /summary/i] },
  { kind: "chart", patterns: [/chart/i, /graph/i, /trend/i] },
  { kind: "profile", patterns: [/profile/i, /account/i, /avatar/i, /user/i] },
  { kind: "settings", patterns: [/setting/i, /preference/i, /toggle/i] },
  { kind: "modal", patterns: [/modal/i, /dialog/i, /sheet/i, /drawer/i, /overlay/i] },
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const stripHtml = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " "),
  );

const tokenize = (value: string) =>
  Array.from(new Set(
    value
      .toLowerCase()
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  ));

const humanize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildLineStarts = (screenCode: string) => {
  const lineStarts = [0];

  for (let index = 0; index < screenCode.length; index += 1) {
    if (screenCode[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }

  return lineStarts;
};

const offsetToLine = (lineStarts: number[], offset: number) => {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineStart = lineStarts[mid];
    const nextLineStart = lineStarts[mid + 1] ?? Number.MAX_SAFE_INTEGER;

    if (offset >= lineStart && offset < nextLineStart) {
      return mid + 1;
    }

    if (offset < lineStart) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return lineStarts.length;
};

const parseAttributes = (source: string) => {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([:@a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null = null;
  while ((match = attributeRegex.exec(source)) !== null) {
    const [, rawName, doubleQuotedValue, singleQuotedValue, bareValue] = match;
    if (!rawName) {
      continue;
    }

    attributes[rawName.toLowerCase()] = doubleQuotedValue ?? singleQuotedValue ?? bareValue ?? "";
  }

  return attributes;
};

const parseElements = (screenCode: string) => {
  const elements: ParsedElement[] = [];
  const lineStarts = buildLineStarts(screenCode);
  const stack: Array<Omit<ParsedElement, "endOffset" | "endLine">> = [];
  const tagRegex = /<!--[^]*?-->|<\/?([A-Za-z][\w:-]*)([^<>]*?)>/g;
  let nextId = 0;
  let match: RegExpExecArray | null = null;

  while ((match = tagRegex.exec(screenCode)) !== null) {
    const token = match[0];
    if (token.startsWith("<!--")) {
      continue;
    }

    const tagName = match[1]?.toLowerCase();
    if (!tagName || IGNORE_TAGS.has(tagName)) {
      continue;
    }

    const isClosingTag = token.startsWith("</");

    if (isClosingTag) {
      const matchingIndex = stack.findLastIndex((entry) => entry.tagName === tagName);
      if (matchingIndex < 0) {
        continue;
      }

      while (stack.length > matchingIndex) {
        const openElement = stack.pop()!;
        elements.push({
          ...openElement,
          endOffset: tagRegex.lastIndex,
          endLine: offsetToLine(lineStarts, Math.max(0, tagRegex.lastIndex - 1)),
        });

        if (openElement.tagName === tagName) {
          break;
        }
      }

      continue;
    }

    const startOffset = match.index;
    const attributes = parseAttributes(match[2] ?? "");
    const openElement = {
      tempId: ++nextId,
      tagName,
      attributes,
      startOffset,
      startLine: offsetToLine(lineStarts, startOffset),
      depth: stack.length,
      parentTempId: stack[stack.length - 1]?.tempId ?? null,
    };

    const isSelfClosing = token.endsWith("/>") || VOID_TAGS.has(tagName);
    if (isSelfClosing) {
      elements.push({
        ...openElement,
        endOffset: tagRegex.lastIndex,
        endLine: offsetToLine(lineStarts, Math.max(0, tagRegex.lastIndex - 1)),
      });
      continue;
    }

    stack.push(openElement);
  }

  while (stack.length > 0) {
    const openElement = stack.pop()!;
    elements.push({
      ...openElement,
      endOffset: screenCode.length,
      endLine: offsetToLine(lineStarts, Math.max(0, screenCode.length - 1)),
    });
  }

  return elements.sort((left, right) => {
    if (left.startOffset !== right.startOffset) {
      return left.startOffset - right.startOffset;
    }

    return right.endOffset - left.endOffset;
  });
};

const classifyBlockKind = (element: ParsedElement, preview: string, isRoot: boolean): ScreenBlockKind => {
  if (isRoot) {
    return "shell";
  }

  if (element.tagName === "header") return "header";
  if (element.tagName === "nav") return "nav";
  if (element.tagName === "footer") return "footer";
  if (element.tagName === "form") return "form";
  if (element.tagName === "main") return "section";

  const hintSource = [
    element.tagName,
    element.attributes.class ?? "",
    element.attributes.id ?? "",
    element.attributes.role ?? "",
    element.attributes["aria-label"] ?? "",
    element.attributes["data-section"] ?? "",
    preview,
  ].join(" ");

  for (const hint of KEYWORD_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(hintSource))) {
      return hint.kind;
    }
  }

  return "section";
};

const extractCandidateLabel = (element: ParsedElement) => {
  const labelSources = [
    element.attributes["aria-label"],
    element.attributes["data-section"],
    element.attributes.id,
  ].filter(Boolean) as string[];

  for (const source of labelSources) {
    if (source && source.length > 0) {
      return humanize(source);
    }
  }

  const classTokens = tokenize(element.attributes.class ?? "");
  const interestingToken = classTokens.find((token) => !["flex", "grid", "items", "center", "justify", "full", "screen", "white", "slate", "gray", "blue"].includes(token));

  return interestingToken ? humanize(interestingToken) : null;
};

const buildBlockName = (kind: ScreenBlockKind, element: ParsedElement, preview: string, ordinal: number) => {
  if (kind === "shell") {
    return "Screen Shell";
  }

  const labeledName = extractCandidateLabel(element);
  if (labeledName) {
    return labeledName;
  }

  if (preview) {
    const previewWords = preview.split(" ").slice(0, 4).join(" ");
    if (previewWords.length > 0 && kind === "section") {
      return `Section ${ordinal}: ${previewWords}`;
    }
  }

  switch (kind) {
    case "header":
      return ordinal === 1 ? "Header" : `Header ${ordinal}`;
    case "hero":
      return ordinal === 1 ? "Hero" : `Hero ${ordinal}`;
    case "nav":
      return ordinal === 1 ? "Navigation" : `Navigation ${ordinal}`;
    case "footer":
      return ordinal === 1 ? "Footer" : `Footer ${ordinal}`;
    case "form":
      return ordinal === 1 ? "Form" : `Form ${ordinal}`;
    case "list":
      return ordinal === 1 ? "List" : `List ${ordinal}`;
    case "grid":
      return ordinal === 1 ? "Grid" : `Grid ${ordinal}`;
    case "stats":
      return ordinal === 1 ? "Stats" : `Stats ${ordinal}`;
    case "chart":
      return ordinal === 1 ? "Chart" : `Chart ${ordinal}`;
    case "profile":
      return ordinal === 1 ? "Profile Section" : `Profile Section ${ordinal}`;
    case "settings":
      return ordinal === 1 ? "Settings Section" : `Settings Section ${ordinal}`;
    case "modal":
      return ordinal === 1 ? "Modal" : `Modal ${ordinal}`;
    case "section":
    default:
      return `Section ${ordinal}`;
  }
};

const isCandidateElement = (element: ParsedElement, rootElement: ParsedElement | null, preview: string) => {
  const lineSpan = element.endLine - element.startLine + 1;
  const hintSource = [
    element.attributes.class ?? "",
    element.attributes.id ?? "",
    element.attributes.role ?? "",
    element.attributes["aria-label"] ?? "",
    element.attributes["data-section"] ?? "",
    preview,
  ].join(" ");

  const hasStructureHint = KEYWORD_HINTS.some((hint) => hint.patterns.some((pattern) => pattern.test(hintSource)));

  if (rootElement && element.tempId === rootElement.tempId) {
    return true;
  }

  if (INLINE_TAGS.has(element.tagName) && !hasStructureHint) {
    return false;
  }

  if (STRUCTURAL_TAGS.has(element.tagName)) {
    return true;
  }

  if (element.parentTempId === rootElement?.tempId && lineSpan >= 2) {
    return true;
  }

  if (hasStructureHint) {
    return true;
  }

  return lineSpan >= 8 && element.depth <= 3;
};

const extractSnippet = (screenCode: string, block: Pick<ScreenBlock, "startOffset" | "endOffset">) => {
  const start = Math.max(0, Math.min(screenCode.length, block.startOffset));
  const end = Math.max(start, Math.min(screenCode.length, block.endOffset));

  return screenCode.slice(start, end).trim();
};

const getOrderedSiblings = (blockIndex: ScreenBlockIndex, parentId: string | null | undefined) =>
  blockIndex.blocks
    .filter((block) => (block.parentId ?? null) === (parentId ?? null))
    .sort((left, right) => left.startOffset - right.startOffset);

export function indexScreenCode(screenCode: string): ScreenBlockIndex {
  if (!screenCode.trim()) {
    return {
      version: 1,
      rootId: null,
      blocks: [],
    };
  }

  const elements = parseElements(screenCode);
  const rootElement = elements.find((element) => element.depth === 0) ?? null;

  const scoredCandidates = elements
    .map((element) => {
      const preview = truncate(stripHtml(screenCode.slice(element.startOffset, element.endOffset)), MAX_PREVIEW_CHARS);
      return {
        element,
        preview,
      };
    })
    .filter(({ element, preview }) => isCandidateElement(element, rootElement, preview));

  const prunedCandidates = scoredCandidates
    .sort((left, right) => {
      const leftSpan = left.element.endLine - left.element.startLine;
      const rightSpan = right.element.endLine - right.element.startLine;

      if (left.element.tempId === rootElement?.tempId) return -1;
      if (right.element.tempId === rootElement?.tempId) return 1;
      if (left.element.startOffset !== right.element.startOffset) return left.element.startOffset - right.element.startOffset;
      return rightSpan - leftSpan;
    })
    .slice(0, MAX_BLOCKS);

  const elementByTempId = new Map(elements.map((element) => [element.tempId, element]));
  const kindOrdinals = new Map<ScreenBlockKind, number>();

  const draftedBlocks = prunedCandidates.map(({ element, preview }) => {
    const kind = classifyBlockKind(element, preview, element.tempId === rootElement?.tempId);
    const ordinal = (kindOrdinals.get(kind) ?? 0) + 1;
    kindOrdinals.set(kind, ordinal);

    const blockId = element.tempId === rootElement?.tempId ? ROOT_BLOCK_ID : `${kind}-${ordinal}`;
    const keywords = Array.from(new Set([
      kind,
      element.tagName,
      ...tokenize(extractCandidateLabel(element) ?? ""),
      ...tokenize(element.attributes.class ?? ""),
      ...tokenize(element.attributes.id ?? ""),
      ...tokenize(preview),
    ])).slice(0, 20);

    return {
      tempId: element.tempId,
      parentTempId: element.parentTempId,
      block: {
        id: blockId,
        name: buildBlockName(kind, element, preview, ordinal),
        kind,
        tagName: element.tagName,
        depth: element.depth,
        startOffset: element.startOffset,
        endOffset: element.endOffset,
        startLine: element.startLine,
        endLine: element.endLine,
        parentId: null,
        preview,
        keywords,
      },
    };
  });

  const blockIdByTempId = new Map(draftedBlocks.map(({ tempId, block }) => [tempId, block.id]));
  const rootBlockId = rootElement ? blockIdByTempId.get(rootElement.tempId) ?? null : null;
  const blocks: ScreenBlock[] = draftedBlocks
    .map(({ block, parentTempId }) => {
      if (block.id === ROOT_BLOCK_ID) {
        return block;
      }

      let ancestorTempId = parentTempId;

      while (ancestorTempId) {
        const mappedParentId = blockIdByTempId.get(ancestorTempId);
        if (mappedParentId) {
          return {
            ...block,
            parentId: mappedParentId,
          };
        }

        ancestorTempId = elementByTempId.get(ancestorTempId)?.parentTempId ?? null;
      }

      return {
        ...block,
        parentId: rootBlockId,
      };
    })
    .sort((left, right) => left.startOffset - right.startOffset);

  return {
    version: 1,
    rootId: rootBlockId,
    blocks,
  };
}

const trimmedSourceBounds = (code: string) => {
  const start = code.search(/\S/);
  if (start < 0) {
    return { start: 0, end: 0 };
  }

  let end = code.length;
  while (end > start && /\s/.test(code[end - 1] ?? "")) {
    end -= 1;
  }

  return { start, end };
};

export function isScreenBlockIndexUsable(code: string, blockIndex: ScreenBlockIndex | null | undefined) {
  if (!blockIndex?.rootId || blockIndex.blocks.length === 0) {
    return false;
  }

  const rootBlock = blockIndex.blocks.find((block) => block.id === blockIndex.rootId);
  if (!rootBlock) {
    return false;
  }

  const { start, end } = trimmedSourceBounds(code);
  if (rootBlock.startOffset > start || rootBlock.endOffset < end) {
    return false;
  }

  return blockIndex.blocks.every((block) => {
    const offsetsAreValid =
      block.startOffset >= 0 &&
      block.endOffset <= code.length &&
      block.startOffset < block.endOffset;

    if (!offsetsAreValid) {
      return false;
    }

    if (block.id !== blockIndex.rootId && block.depth === 0) {
      return false;
    }

    if (block.id !== blockIndex.rootId && (block.startOffset < rootBlock.startOffset || block.endOffset > rootBlock.endOffset)) {
      return false;
    }

    return true;
  });
}

export function isBroadScreenChange(prompt: string) {
  return GLOBAL_EDIT_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function detectTargetBlocks(prompt: string, blockIndex: ScreenBlockIndex | null | undefined): TargetBlockResolution {
  if (!blockIndex || blockIndex.blocks.length === 0) {
    return { scope: "ambiguous", targetBlockIds: [] };
  }

  if (isBroadScreenChange(prompt)) {
    return { scope: "full", targetBlockIds: [] };
  }

  const normalizedPrompt = prompt.toLowerCase();
  const promptTokens = tokenize(prompt);
  const candidates = blockIndex.blocks.filter((block) => block.id !== blockIndex.rootId);

  if (candidates.length === 0) {
    return { scope: "ambiguous", targetBlockIds: [] };
  }

  const scoredBlocks = candidates
    .map((block) => {
      let score = 0;
      const normalizedName = block.name.toLowerCase();
      const joinedKeywords = block.keywords.join(" ");

      if (normalizedPrompt.includes(normalizedName)) {
        score += 10;
      }

      if (normalizedPrompt.includes(block.kind)) {
        score += 6;
      }

      for (const synonym of KIND_SYNONYMS[block.kind]) {
        if (normalizedPrompt.includes(synonym)) {
          score += 4;
        }
      }

      for (const token of promptTokens) {
        if (joinedKeywords.includes(token)) {
          score += 2;
        }
      }

      if (block.preview && normalizedPrompt.includes(block.preview.toLowerCase())) {
        score += 2;
      }

      return {
        block,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || left.block.startOffset - right.block.startOffset);

  const topScore = scoredBlocks[0]?.score ?? 0;
  if (topScore < 4) {
    return { scope: "ambiguous", targetBlockIds: [] };
  }

  const targetBlockIds = scoredBlocks
    .filter(({ score }) => score >= topScore - 1 && score >= 4)
    .slice(0, 3)
    .map(({ block }) => block.id);

  if (targetBlockIds.length === 0) {
    return { scope: "ambiguous", targetBlockIds: [] };
  }

  return {
    scope: "scoped",
    targetBlockIds,
  };
}

export function buildScopedEditContext({
  screenCode,
  blockIndex,
  targetBlockIds,
}: {
  screenCode: string;
  blockIndex: ScreenBlockIndex;
  targetBlockIds: string[];
}) {
  const blockMap = new Map(blockIndex.blocks.map((block) => [block.id, block]));
  const targetBlocks = targetBlockIds
    .map((blockId) => blockMap.get(blockId) ?? null)
    .filter((block): block is ScreenBlock => block !== null && block.id !== blockIndex.rootId);

  if (targetBlocks.length === 0) {
    return null;
  }

  const contextIds = new Set<string>();
  for (const targetBlock of targetBlocks) {
    if (targetBlock.parentId && targetBlock.parentId !== blockIndex.rootId) {
      const parentBlock = blockMap.get(targetBlock.parentId);
      const parentLineSpan = parentBlock ? parentBlock.endLine - parentBlock.startLine + 1 : 0;

      if (parentBlock && parentLineSpan <= MAX_PARENT_CONTEXT_LINES) {
        contextIds.add(parentBlock.id);
      }
    }

    const siblings = getOrderedSiblings(blockIndex, targetBlock.parentId);
    const targetIndex = siblings.findIndex((sibling) => sibling.id === targetBlock.id);

    if (targetIndex > 0) {
      contextIds.add(siblings[targetIndex - 1].id);
    }

    if (targetIndex >= 0 && targetIndex < siblings.length - 1) {
      contextIds.add(siblings[targetIndex + 1].id);
    }
  }

  for (const targetBlockId of targetBlockIds) {
    contextIds.delete(targetBlockId);
  }

  const contextBlocks = Array.from(contextIds)
    .map((blockId) => blockMap.get(blockId))
    .filter((block): block is ScreenBlock => Boolean(block))
    .sort((left, right) => left.startOffset - right.startOffset)
    .slice(0, 6);

  const blockCatalog = blockIndex.blocks
    .filter((block) => block.id !== blockIndex.rootId)
    .map((block) => `- ${block.id}: ${block.name} [${block.kind}] lines ${block.startLine}-${block.endLine}. Preview: ${block.preview || "No preview available."}`)
    .join("\n");

  const formatBlockSection = (block: ScreenBlock, role: "target" | "context") => {
    const snippet = extractSnippet(screenCode, block);
    if (!snippet) {
      return null;
    }

    return [
      `Block ${block.id}`,
      `Name: ${block.name}`,
      `Kind: ${block.kind}`,
      `Lines: ${block.startLine}-${block.endLine}`,
      `Role: ${role}`,
      "Code:",
      "```html",
      snippet,
      "```",
    ].join("\n");
  };

  const targetSections = targetBlocks.map((block) => formatBlockSection(block, "target")).filter(Boolean).join("\n\n");
  const contextSections = contextBlocks.map((block) => formatBlockSection(block, "context")).filter(Boolean).join("\n\n");

  if (!targetSections) {
    return null;
  }

  return [
    "The current screen has been indexed into named blocks.",
    "Focus on the TARGET blocks first. Only edit CONTEXT blocks when the requested change clearly requires neighboring layout adjustments.",
    `BLOCK MAP:\n${blockCatalog}`,
    `TARGET BLOCKS:\n${targetSections}`,
    contextSections ? `SURROUNDING CONTEXT:\n${contextSections}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

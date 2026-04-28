import type { ScreenPlan } from "@/lib/types";

export const REQUIRED_ANCHORS_LABEL = "Required screen anchors:";

export type ScreenHealthStatus =
  | "healthy"
  | "incomplete"
  | "structurally_broken"
  | "missing_required_content";

export type StaticDrawgleHtmlDiagnosticCode =
  | "empty_code"
  | "jsx_leak"
  | "script_tag"
  | "duplicated_screen_fragment"
  | "duplicate_drawgle_ids"
  | "tag_imbalance"
  | "rendered_code_text";

const NON_CLOSING_TAGS = new Set([
  "area",
  "base",
  "br",
  "circle",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "line",
  "link",
  "meta",
  "param",
  "path",
  "polygon",
  "polyline",
  "rect",
  "source",
  "stop",
  "track",
  "use",
  "wbr",
]);

const COMMON_ANCHOR_NOISE = new Set([
  "screen",
  "screens",
  "layout",
  "visual",
  "goal",
  "styling",
  "interaction",
  "notes",
  "components",
  "inside",
  "below",
  "above",
  "left",
  "right",
  "center",
  "top",
  "bottom",
  "create",
  "place",
  "insert",
  "include",
]);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9%+:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanAnchor = (value: string) => {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/^[\s"'`.,:;()[\]{}<>-]+|[\s"'`.,:;()[\]{}<>-]+$/g, "")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 48) {
    return null;
  }

  const normalized = normalize(cleaned);
  if (!normalized || COMMON_ANCHOR_NOISE.has(normalized)) {
    return null;
  }

  return cleaned;
};

const pushUnique = (anchors: string[], value: string | null) => {
  if (!value) return;
  const key = normalize(value);
  if (!key || anchors.some((anchor) => normalize(anchor) === key)) return;
  anchors.push(value);
};

export function extractRequiredAnchors(text: string, limit = 18) {
  const anchors: string[] = [];

  for (const match of text.matchAll(/["'“”‘’]([^"'“”‘’]{2,48})["'“”‘’]/g)) {
    pushUnique(anchors, cleanAnchor(match[1]));
  }

  for (const match of text.matchAll(/\(([^)]{3,180})\)/g)) {
    const parts = match[1].split(/,|;|\band\b/gi);
    for (const part of parts) {
      pushUnique(anchors, cleanAnchor(part.replace(/\b(orange|blue|white|gray|grey|charcoal|burnt|light|dark)\b/gi, "")));
    }
  }

  for (const match of text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z0-9+:%]+){0,2}\b/g)) {
    pushUnique(anchors, cleanAnchor(match[0]));
  }

  return anchors.slice(0, limit);
}

export function appendRequiredAnchors(description: string, anchors: string[]) {
  const cleanedAnchors = anchors
    .map((anchor) => cleanAnchor(anchor))
    .filter((anchor): anchor is string => Boolean(anchor))
    .slice(0, 18);

  if (cleanedAnchors.length === 0 || description.includes(REQUIRED_ANCHORS_LABEL)) {
    return description;
  }

  return `${description.trim()}\n\n${REQUIRED_ANCHORS_LABEL} ${cleanedAnchors.join("; ")}`;
}

export function readRequiredAnchors(description: string) {
  const markerIndex = description.indexOf(REQUIRED_ANCHORS_LABEL);
  if (markerIndex < 0) {
    return [];
  }

  const anchorText = description.slice(markerIndex + REQUIRED_ANCHORS_LABEL.length).split(/\n/)[0] ?? "";
  return anchorText
    .split(";")
    .map((anchor) => cleanAnchor(anchor))
    .filter((anchor): anchor is string => Boolean(anchor))
    .slice(0, 18);
}

const anchorSatisfied = (normalizedCode: string, anchor: string) => {
  const normalizedAnchor = normalize(anchor);
  if (!normalizedAnchor) {
    return true;
  }

  if (normalizedCode.includes(normalizedAnchor)) {
    return true;
  }

  const words = normalizedAnchor.split(" ").filter((word) => word.length > 2);
  if (words.length <= 1) {
    return false;
  }

  return words.every((word) => normalizedCode.includes(word));
};

const pushDiagnostic = (
  issues: string[],
  codes: StaticDrawgleHtmlDiagnosticCode[],
  code: StaticDrawgleHtmlDiagnosticCode,
  issue: string,
) => {
  if (!codes.includes(code)) {
    codes.push(code);
  }
  issues.push(issue);
};

export function validateStaticDrawgleHtml({
  code,
  requireSingleScreenRoot = false,
}: {
  code: string;
  requireSingleScreenRoot?: boolean;
}) {
  const trimmedCode = code.trim();
  const issues: string[] = [];
  const codes: StaticDrawgleHtmlDiagnosticCode[] = [];

  if (!trimmedCode) {
    pushDiagnostic(issues, codes, "empty_code", "Screen code is empty.");
  }

  const jsxPatterns: Array<[RegExp, string]> = [
    [/\{\s*\[/, "Contains JSX array expression syntax."],
    [/\]\s*\.map\s*\(/, "Contains JSX .map(...) rendering syntax."],
    [/\)\s*=>\s*\(?\s*</, "Contains JSX arrow-rendering syntax."],
    [/\bclassName\s*=/, "Contains React className attribute."],
    [/\bclass\s*=\s*\{[^}]+\}/, "Contains JSX class expression."],
    [/\bstyle\s*=\s*\{\{[\s\S]*?\}\}/, "Contains JSX style object syntax."],
    [/\bdata-[\w-]+\s*=\s*\{[^}]+\}/, "Contains JSX attribute expression."],
    [/\{[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+\}/, "Contains JSX data interpolation syntax."],
    [/`[^`]*\$\{[^}]+\}[^`]*`/, "Contains JavaScript template literal syntax."],
  ];

  for (const [pattern, message] of jsxPatterns) {
    if (pattern.test(trimmedCode)) {
      pushDiagnostic(issues, codes, "jsx_leak", message);
      break;
    }
  }

  if (/<script\b/i.test(trimmedCode)) {
    pushDiagnostic(issues, codes, "script_tag", "Screen code contains a <script> tag.");
  }

  if (/\{\s*\[[\s\S]*?\]\s*\.map\s*\(|\{[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\}/.test(trimmedCode)) {
    pushDiagnostic(issues, codes, "rendered_code_text", "Screen code contains rendered JavaScript/JSX text.");
  }

  const screenRootMatches = trimmedCode.match(/<div\b[^>]*\bmin-h-screen\b/gi) ?? [];
  if (screenRootMatches.length > 1) {
    pushDiagnostic(
      issues,
      codes,
      "duplicated_screen_fragment",
      `Screen code contains ${screenRootMatches.length} min-h-screen root fragments.`,
    );
  }

  if (requireSingleScreenRoot && screenRootMatches.length === 0) {
    pushDiagnostic(issues, codes, "duplicated_screen_fragment", "Screen code is missing the expected min-h-screen root.");
  }

  const drawgleIds = Array.from(trimmedCode.matchAll(/\sdata-drawgle-id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g))
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter(Boolean);
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const id of drawgleIds) {
    if (seenIds.has(id)) {
      duplicateIds.add(id);
    }
    seenIds.add(id);
  }
  if (duplicateIds.size > 0) {
    pushDiagnostic(
      issues,
      codes,
      "duplicate_drawgle_ids",
      `Screen code contains duplicate data-drawgle-id values: ${Array.from(duplicateIds).slice(0, 8).join(", ")}.`,
    );
  }

  const openTags = (trimmedCode.match(/<([a-z][\w:-]*)(?:\s|>|\/)/gi) ?? [])
    .filter((tag) => {
      const tagName = /^<([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase();
      return tagName && !NON_CLOSING_TAGS.has(tagName) && !/\/>$/.test(tag);
    })
    .length;
  const closeTags = (trimmedCode.match(/<\/[a-z][\w:-]*>/gi) ?? []).length;
  if (Math.abs(openTags - closeTags) > 3) {
    pushDiagnostic(
      issues,
      codes,
      "tag_imbalance",
      `Screen code has suspicious tag imbalance (${openTags} opening tags, ${closeTags} closing tags).`,
    );
  }

  const unrecoverable = codes.some((code) =>
    code === "jsx_leak" ||
    code === "script_tag" ||
    code === "duplicated_screen_fragment" ||
    code === "tag_imbalance",
  );

  return {
    valid: issues.length === 0,
    issues,
    codes,
    unrecoverable,
  };
}

export function validateGeneratedScreenCode({
  code,
  screenPlan,
}: {
  code: string;
  screenPlan: Pick<ScreenPlan, "name" | "description">;
}) {
  const issues: string[] = [];
  const missingAnchors: string[] = [];
  const trimmedCode = code.trim();
  const staticValidation = validateStaticDrawgleHtml({ code, requireSingleScreenRoot: true });

  issues.push(...staticValidation.issues);

  if (screenPlan.description.length > 800 && trimmedCode.length < 1400) {
    issues.push("Generated HTML is too short for the detailed screen brief.");
  }

  if (/[…]|TODO|placeholder content|lorem ipsum/i.test(trimmedCode)) {
    issues.push("Generated HTML contains placeholder or truncated-looking content.");
  }

  const openDivs = (trimmedCode.match(/<div\b/gi) ?? []).length;
  const closeDivs = (trimmedCode.match(/<\/div>/gi) ?? []).length;
  if (Math.abs(openDivs - closeDivs) > 2) {
    issues.push(`Generated HTML looks structurally unbalanced (${openDivs} opening divs, ${closeDivs} closing divs).`);
  }

  const anchors = readRequiredAnchors(screenPlan.description);
  if (anchors.length > 0) {
    const normalizedCode = normalize(trimmedCode);
    for (const anchor of anchors) {
      if (!anchorSatisfied(normalizedCode, anchor)) {
        missingAnchors.push(anchor);
      }
    }
  }

  if (missingAnchors.length > 0) {
    issues.push(`Missing required brief anchors: ${missingAnchors.join(", ")}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    missingAnchors,
    staticValidation,
  };
}

export function detectScreenHealth({
  code,
  screenPrompt,
}: {
  code: string;
  screenPrompt: string;
}) {
  const validation = validateGeneratedScreenCode({
    code,
    screenPlan: {
      name: "Screen",
      description: screenPrompt,
    },
  });
  const trimmedCode = code.trim();
  const issues = [...validation.issues];
  const warnings: string[] = [];
  const staticValidation = validateStaticDrawgleHtml({ code, requireSingleScreenRoot: true });

  const openTags = (trimmedCode.match(/<([a-z][\w:-]*)(?:\s|>|\/)/gi) ?? [])
    .filter((tag) => !/\/>$/.test(tag) && !/^<(img|input|br|hr|path|circle|rect|line|polyline|polygon|use|stop|meta|link|source|area|base|col|embed|param|track|wbr)\b/i.test(tag))
    .length;
  const closeTags = (trimmedCode.match(/<\/[a-z][\w:-]*>/gi) ?? []).length;

  if (Math.abs(openTags - closeTags) > 3) {
    issues.push(`Generated HTML has suspicious tag imbalance (${openTags} opening tags, ${closeTags} closing tags).`);
  }

  if (/class=["'][^"']*\bmin-h-screen\b[^"']*\boverflow-hidden\b/i.test(trimmedCode) && trimmedCode.length > 5000) {
    warnings.push("Outermost screen wrapper may clip required lower content with overflow-hidden.");
  }

  let status: ScreenHealthStatus = "healthy";
  if (staticValidation.unrecoverable || issues.some((issue) => /unbalanced|imbalance|structurally/i.test(issue))) {
    status = "structurally_broken";
  } else if (validation.missingAnchors.length > 0) {
    status = "missing_required_content";
  } else if (issues.length > 0) {
    status = "incomplete";
  }

  return {
    status,
    healthy: status === "healthy",
    issues,
    warnings,
    missingAnchors: validation.missingAnchors,
    staticValidation,
  };
}

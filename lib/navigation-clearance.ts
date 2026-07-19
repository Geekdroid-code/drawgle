export const SHARED_NAV_CLEARANCE_CLASS = "dg-shared-nav-clearance";
export const SHARED_NAV_CLEARANCE_ATTRIBUTE = "data-drawgle-nav-clearance-owner";

const NAVIGATION_CLEARANCE_SIGNAL =
  /bottom[-_\s]?nav|navigation[-_\s]?(?:clearance|spacer)|shared[-_\s]?nav|safe[-_\s]?area[-_\s]?bottom|dg-sizing-bottom-nav-height|dg-navigation-clearance/i;

const LEGACY_PADDING_CLASS =
  /^pb-\[(?=[^\]]*(?:bottom[-_]?nav|safe[-_]?area[-_]?bottom|navigation[-_]?clearance|dg-sizing-bottom-nav-height|dg-navigation-clearance))[^\]]+\]$/i;

export const hasNavigationClearanceSignal = (value: string | null | undefined) =>
  NAVIGATION_CLEARANCE_SIGNAL.test(value ?? "");

export const stripLegacyNavigationPaddingClasses = (className: string | null | undefined) =>
  (className ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((entry) => !LEGACY_PADDING_CLASS.test(entry))
    .join(" ");

export const stripLegacyNavigationPaddingStyle = (style: string | null | undefined) =>
  (style ?? "")
    .replace(
      /(?:^|;)\s*padding-bottom\s*:[^;]*(?:bottom[-_\s]?nav|safe[-_\s]?area[-_\s]?bottom|navigation[-_\s]?clearance|dg-sizing-bottom-nav-height|dg-navigation-clearance)[^;]*;?/gi,
      ";",
    )
    .replace(/;;+/g, ";")
    .replace(/^;|;$/g, "")
    .trim();

export const isLegacyNavigationClearanceAttributes = ({
  className,
  id,
  style,
  dataRole,
}: {
  className?: string | null;
  id?: string | null;
  style?: string | null;
  dataRole?: string | null;
}) => hasNavigationClearanceSignal([className, id, style, dataRole].filter(Boolean).join(" "));

export type NavigationClearanceNormalizationDiagnostics = {
  changed: boolean;
  ownerAdded: boolean;
  ownerSelector: string | null;
  legacyPaddingReplacedCount: number;
  spacerRemovedCount: number;
  ambiguousOwnerCount: number;
};

const domElementAttributes = (element: Element) => ({
  className: element.getAttribute("class"),
  id: element.getAttribute("id"),
  style: element.getAttribute("style"),
  dataRole: [
    element.getAttribute("data-role"),
    element.getAttribute("data-purpose"),
    element.getAttribute("aria-label"),
  ].filter(Boolean).join(" "),
});

const isEmptyLegacySpacerElement = (element: Element) =>
  !element.textContent?.trim() &&
  element.children.length === 0 &&
  isLegacyNavigationClearanceAttributes(domElementAttributes(element));

export function normalizeSharedNavigationClearanceDom({
  root,
  enabled,
}: {
  root: Element;
  enabled: boolean;
}): NavigationClearanceNormalizationDiagnostics {
  const diagnostics: NavigationClearanceNormalizationDiagnostics = {
    changed: false,
    ownerAdded: false,
    ownerSelector: null,
    legacyPaddingReplacedCount: 0,
    spacerRemovedCount: 0,
    ambiguousOwnerCount: 0,
  };
  if (!enabled) return diagnostics;

  const elements = Array.from(root.querySelectorAll("*"));
  const spacerElements = new Set(elements.filter(isEmptyLegacySpacerElement));
  const comments: Comment[] = [];
  for (const parent of [root, ...elements]) {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== 8 || !hasNavigationClearanceSignal(node.textContent)) continue;
      comments.push(node as Comment);
      let sibling = node.nextSibling;
      while (sibling?.nodeType === 3 && !sibling.textContent?.trim()) sibling = sibling.nextSibling;
      if (sibling instanceof Element && isEmptyLegacySpacerElement(sibling)) spacerElements.add(sibling);
    }
  }

  const canonicalOwners = elements.filter((element) =>
    element.getAttribute(SHARED_NAV_CLEARANCE_ATTRIBUTE) === "true" ||
    element.classList.contains(SHARED_NAV_CLEARANCE_CLASS),
  );
  const legacyPaddingOwners = elements.filter((element) =>
    !spacerElements.has(element) &&
    hasNavigationClearanceSignal(
      `${(element.getAttribute("class") ?? "").split(/\s+/).filter((entry) => entry !== SHARED_NAV_CLEARANCE_CLASS).join(" ")} ${element.getAttribute("style") ?? ""}`,
    ),
  );
  const mainScrollOwners = elements.filter((element) =>
    element.tagName === "MAIN" &&
    /overflow-y-auto|overflow-auto|overflow-y:\s*auto/i.test(`${element.getAttribute("class") ?? ""} ${element.getAttribute("style") ?? ""}`),
  );
  const scrollOwners = elements.filter((element) =>
    /overflow-y-auto|overflow-auto|overflow-y:\s*auto/i.test(`${element.getAttribute("class") ?? ""} ${element.getAttribute("style") ?? ""}`),
  );
  const mainOwners = elements.filter((element) => element.tagName === "MAIN");
  const ownerCandidates = [
    ...canonicalOwners,
    ...legacyPaddingOwners,
    ...mainScrollOwners,
    ...scrollOwners,
    ...mainOwners,
    ...(root.firstElementChild ? [root.firstElementChild] : []),
  ].filter((element, index, values) => values.indexOf(element) === index && !spacerElements.has(element));
  const owner = ownerCandidates[0];
  const ownerHadCompleteMarker = Boolean(
    owner &&
    owner.classList.contains(SHARED_NAV_CLEARANCE_CLASS) &&
    owner.getAttribute(SHARED_NAV_CLEARANCE_ATTRIBUTE) === "true",
  );
  let markerChanged = false;

  for (const element of [...canonicalOwners, ...legacyPaddingOwners].filter((entry, index, values) => values.indexOf(entry) === index)) {
    const isOwner = element === owner;
    const currentClass = element.getAttribute("class") ?? "";
    const currentStyle = element.getAttribute("style") ?? "";
    const nextClass = stripLegacyNavigationPaddingClasses(currentClass)
      .split(/\s+/)
      .filter(Boolean)
      .filter((entry) => isOwner || entry !== SHARED_NAV_CLEARANCE_CLASS)
      .join(" ");
    const nextStyle = stripLegacyNavigationPaddingStyle(currentStyle);
    if (legacyPaddingOwners.includes(element) && (nextClass !== currentClass || nextStyle !== currentStyle)) {
      diagnostics.legacyPaddingReplacedCount += 1;
    }
    if (!isOwner && canonicalOwners.includes(element)) markerChanged = true;
    if (nextClass) element.setAttribute("class", nextClass); else element.removeAttribute("class");
    if (nextStyle) element.setAttribute("style", nextStyle); else element.removeAttribute("style");
    if (!isOwner) element.removeAttribute(SHARED_NAV_CLEARANCE_ATTRIBUTE);
  }

  for (const comment of comments) comment.remove();
  for (const spacer of spacerElements) spacer.remove();

  if (owner) {
    diagnostics.ownerAdded = !ownerHadCompleteMarker;
    owner.classList.add(SHARED_NAV_CLEARANCE_CLASS);
    owner.setAttribute(SHARED_NAV_CLEARANCE_ATTRIBUTE, "true");
    diagnostics.ownerSelector = owner.id
      ? `${owner.tagName.toLowerCase()}#${owner.id}`
      : owner.getAttribute("data-drawgle-id")
        ? `${owner.tagName.toLowerCase()}[data-drawgle-id="${owner.getAttribute("data-drawgle-id")}"]`
        : owner.tagName.toLowerCase();
  }

  diagnostics.spacerRemovedCount = spacerElements.size;
  diagnostics.ambiguousOwnerCount = Math.max(0, ownerCandidates.length - 1);
  diagnostics.changed = diagnostics.ownerAdded ||
    markerChanged ||
    diagnostics.legacyPaddingReplacedCount > 0 ||
    diagnostics.spacerRemovedCount > 0 ||
    comments.length > 0;
  return diagnostics;
}

type MarkupElementCandidate = {
  index: number;
  tagName: string;
  openingTag: string;
  canonical: boolean;
  legacyPadding: boolean;
  mainScroll: boolean;
  scroll: boolean;
  main: boolean;
};

const readMarkupAttribute = (openingTag: string, name: string) => {
  const match = openingTag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
};

const removeMarkupAttribute = (openingTag: string, name: string) =>
  openingTag.replace(new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>]+)`, "gi"), "");

const writeMarkupAttribute = (openingTag: string, name: string, value: string) => {
  const withoutAttribute = removeMarkupAttribute(openingTag, name);
  return withoutAttribute.replace(/\s*\/?>$/, (ending) => ` ${name}="${value}"${ending}`);
};

const normalizeMarkupOpeningTag = ({
  openingTag,
  isOwner,
}: {
  openingTag: string;
  isOwner: boolean;
}) => {
  const originalClass = readMarkupAttribute(openingTag, "class") ?? "";
  const originalStyle = readMarkupAttribute(openingTag, "style") ?? "";
  const classNames = stripLegacyNavigationPaddingClasses(originalClass)
    .split(/\s+/)
    .filter(Boolean)
    .filter((entry) => entry !== SHARED_NAV_CLEARANCE_CLASS);
  if (isOwner) classNames.push(SHARED_NAV_CLEARANCE_CLASS);
  const style = stripLegacyNavigationPaddingStyle(originalStyle);

  let normalized = removeMarkupAttribute(openingTag, SHARED_NAV_CLEARANCE_ATTRIBUTE);
  normalized = removeMarkupAttribute(normalized, "class");
  normalized = removeMarkupAttribute(normalized, "style");
  if (classNames.length > 0) normalized = writeMarkupAttribute(normalized, "class", classNames.join(" "));
  if (style) normalized = writeMarkupAttribute(normalized, "style", style);
  if (isOwner) normalized = writeMarkupAttribute(normalized, SHARED_NAV_CLEARANCE_ATTRIBUTE, "true");
  return normalized;
};

/**
 * Browser/export adapter for saved HTML. Generation and edit persistence use the
 * Cheerio adapter; this adapter keeps previews, code view and client exports in
 * sync without pulling a server-only HTML parser into the browser bundle.
 */
export function normalizeSharedNavigationClearanceMarkup({
  code,
  enabled,
}: {
  code: string;
  enabled: boolean;
}): { code: string; diagnostics: NavigationClearanceNormalizationDiagnostics } {
  const unchanged: NavigationClearanceNormalizationDiagnostics = {
    changed: false,
    ownerAdded: false,
    ownerSelector: null,
    legacyPaddingReplacedCount: 0,
    spacerRemovedCount: 0,
    ambiguousOwnerCount: 0,
  };
  if (!enabled || !code.trim()) return { code, diagnostics: unchanged };

  // Deterministic string adapter shared by SSR, hydration, code view and export.
  // It intentionally touches only explicit navigation-clearance signals; the
  // generation/edit pipeline uses the structural Cheerio adapter as well.
  let spacerRemovedCount = 0;
  let working = code
    .replace(
      /<!--[\s\S]*?(?:bottom[-_\s]?nav|navigation[-_\s]?(?:clearance|spacer)|shared[-_\s]?nav|safe[-_\s]?area[-_\s]?bottom|dg-sizing-bottom-nav-height|dg-navigation-clearance)[\s\S]*?-->\s*<(div|section)\b([^>]*)>\s*<\/\1>/gi,
      (match, _tagName: string, attributes: string) => {
        if (!hasNavigationClearanceSignal(attributes)) return match;
        spacerRemovedCount += 1;
        return "";
      },
    )
    .replace(
      /<(div|section)\b([^>]*(?:bottom[-_\s]?nav|navigation[-_\s]?(?:clearance|spacer)|shared[-_\s]?nav|safe[-_\s]?area[-_\s]?bottom|dg-sizing-bottom-nav-height|dg-navigation-clearance)[^>]*)>\s*<\/\1>/gi,
      () => {
        spacerRemovedCount += 1;
        return "";
      },
    );

  const candidates: MarkupElementCandidate[] = [];
  let elementIndex = 0;
  working.replace(/<([a-z][a-z0-9-]*)\b[^>]*>/gi, (openingTag, tagName: string) => {
    const className = readMarkupAttribute(openingTag, "class") ?? "";
    const style = readMarkupAttribute(openingTag, "style") ?? "";
    const normalizedTagName = tagName.toLowerCase();
    const canonical = readMarkupAttribute(openingTag, SHARED_NAV_CLEARANCE_ATTRIBUTE) === "true" ||
      className.split(/\s+/).includes(SHARED_NAV_CLEARANCE_CLASS);
    const classWithoutCanonical = className
      .split(/\s+/)
      .filter((entry) => entry !== SHARED_NAV_CLEARANCE_CLASS)
      .join(" ");
    const legacyPadding = hasNavigationClearanceSignal(`${classWithoutCanonical} ${style}`);
    const scroll = /overflow-y-auto|overflow-auto|overflow-y:\s*auto/i.test(`${className} ${style}`);
    candidates.push({
      index: elementIndex++,
      tagName: normalizedTagName,
      openingTag,
      canonical,
      legacyPadding,
      mainScroll: normalizedTagName === "main" && scroll,
      scroll,
      main: normalizedTagName === "main",
    });
    return openingTag;
  });

  const ordered = [
    ...candidates.filter((candidate) => candidate.canonical),
    ...candidates.filter((candidate) => candidate.legacyPadding),
    ...candidates.filter((candidate) => candidate.mainScroll),
    ...candidates.filter((candidate) => candidate.scroll),
    ...candidates.filter((candidate) => candidate.main),
    ...candidates.slice(0, 1),
  ].filter((candidate, index, values) =>
    values.findIndex((value) => value.index === candidate.index) === index,
  );
  const owner = ordered[0] ?? null;
  let legacyPaddingReplacedCount = 0;
  elementIndex = 0;
  working = working.replace(/<([a-z][a-z0-9-]*)\b[^>]*>/gi, (openingTag) => {
    const candidate = candidates[elementIndex++];
    if (!candidate) return openingTag;
    const isOwner = candidate.index === owner?.index;
    const shouldNormalize = candidate.canonical || candidate.legacyPadding || isOwner;
    if (!shouldNormalize) return openingTag;
    const normalized = normalizeMarkupOpeningTag({ openingTag, isOwner });
    if (candidate.legacyPadding && normalized !== openingTag) legacyPaddingReplacedCount += 1;
    return normalized;
  });

  const ownerAdded = Boolean(owner && !owner.canonical);
  const changed = working !== code;
  return {
    code: changed ? working.trim() : code,
    diagnostics: {
      changed,
      ownerAdded,
      ownerSelector: owner?.tagName ?? null,
      legacyPaddingReplacedCount,
      spacerRemovedCount,
      ambiguousOwnerCount: Math.max(0, ordered.length - 1),
    },
  };
}

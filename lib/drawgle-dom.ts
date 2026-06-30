import {
  classNameMatchesUtilityFamily,
  DRAWGLE_STYLE_PROPERTY_SET,
  validateStyleValue,
  type DrawgleClassUtilityFamily,
  type DrawgleRawStyleInspection,
  type DrawgleStyleProperty,
} from "@/lib/element-style-inspection";

export type DrawgleElementTargetType = "screen" | "navigation";

export type DrawgleTextNodeMeta = {
  drawgleId: string;
  tagName: string;
  text: string;
};

export type DrawgleImageTargetMeta = {
  drawgleId: string;
  kind: "img" | "background" | "inline_svg" | "visual_placeholder";
  tagName: string;
  src: string;
  alt?: string;
  label: string;
  targetIndex?: number;
};

export type DrawgleStyleMeta = {
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  borderRadius?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  gap?: string;
  borderColor?: string;
  borderWidth?: string;
  boxShadow?: string;
  fontFamily?: string;
  width?: string;
  height?: string;
  minHeight?: string;
  maxWidth?: string;
  opacity?: string;
};

export type DrawgleBoundingRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type DrawgleElementLayoutContext = {
  parentTagName: string | null;
  parentDisplay: string | null;
  parentFlexDirection: string | null;
  childIndex: number;
  siblingCount: number;
  childrenCount: number;
};

export type DrawgleEditableRiskFlags = {
  isRootLike?: boolean;
  isNavigationRoot?: boolean;
  affectsManyChildren?: boolean;
  absolutePositioned?: boolean;
};

export type DrawgleEditableMetadata = {
  tagName: string;
  textNodes: DrawgleTextNodeMeta[];
  imageTargets?: DrawgleImageTargetMeta[];
  style: DrawgleStyleMeta;
  styleInspection?: DrawgleRawStyleInspection | null;
  layoutContext?: DrawgleElementLayoutContext | null;
  riskFlags?: DrawgleEditableRiskFlags | null;
};

export type DeterministicEditOperation =
  | {
      type: "replaceText";
      drawgleId?: string;
      text: string;
    }
  | {
      type: "setStyle";
      drawgleId?: string;
      property: DrawgleStyleProperty;
      value: string;
    }
  | {
      type: "clearStyle";
      drawgleId?: string;
      property: DrawgleStyleProperty;
    }
  | {
      type: "setClassUtility";
      drawgleId?: string;
      family: DrawgleClassUtilityFamily;
      className: string;
      property?: DrawgleStyleProperty;
    }
  | {
      type: "removeClassUtility";
      drawgleId?: string;
      family: DrawgleClassUtilityFamily;
    }
  | {
      type: "replaceClassList";
      drawgleId?: string;
      className: string;
    }
  | {
      type: "setAttribute";
      drawgleId?: string;
      name: string;
      value: string | null;
    }
  | {
      type: "replaceImage";
      drawgleId?: string;
      mode: "src" | "background" | "inline_svg" | "visual_placeholder";
      src: string;
      alt?: string | null;
      targetIndex?: number | null;
    }
  | {
      type: "deleteElement";
      drawgleId?: string;
    }
  | {
      type: "duplicateElement";
      drawgleId?: string;
    };

export type { DrawgleStyleProperty };

type ParsedElement = {
  tagName: string;
  attributes: Record<string, string>;
  startOffset: number;
  openEndOffset: number;
  innerStartOffset: number;
  innerEndOffset: number;
  endOffset: number;
};

const SELECTABLE_TAGS = new Set([
  "a",
  "article",
  "aside",
  "button",
  "div",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "img",
  "input",
  "label",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "section",
  "select",
  "span",
  "textarea",
  "ul",
]);

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

const IGNORED_TAGS = new Set([
  "body",
  "circle",
  "defs",
  "ellipse",
  "g",
  "head",
  "html",
  "line",
  "lineargradient",
  "path",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "script",
  "stop",
  "style",
  "svg",
  "title",
  "use",
]);

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

const parseElements = (code: string): ParsedElement[] => {
  const elements: ParsedElement[] = [];
  const stack: Array<Omit<ParsedElement, "innerEndOffset" | "endOffset">> = [];
  const tagRegex = /<!--[^]*?-->|<\/?([A-Za-z][\w:-]*)([^<>]*?)>/g;

  let match: RegExpExecArray | null = null;
  while ((match = tagRegex.exec(code)) !== null) {
    const token = match[0];
    if (token.startsWith("<!--")) {
      continue;
    }

    const tagName = match[1]?.toLowerCase();
    if (!tagName || IGNORED_TAGS.has(tagName)) {
      continue;
    }

    if (token.startsWith("</")) {
      while (stack.length > 0) {
        const openElement = stack.pop()!;
        elements.push({
          ...openElement,
          innerEndOffset: match.index,
          endOffset: tagRegex.lastIndex,
        });

        if (openElement.tagName === tagName) {
          break;
        }
      }
      continue;
    }

    const openElement = {
      tagName,
      attributes: parseAttributes(match[2] ?? ""),
      startOffset: match.index,
      openEndOffset: tagRegex.lastIndex,
      innerStartOffset: tagRegex.lastIndex,
    };

    const isSelfClosing = token.endsWith("/>") || VOID_TAGS.has(tagName);
    if (isSelfClosing) {
      elements.push({
        ...openElement,
        innerEndOffset: tagRegex.lastIndex,
        endOffset: tagRegex.lastIndex,
      });
      continue;
    }

    stack.push(openElement);
  }

  while (stack.length > 0) {
    const openElement = stack.pop()!;
    elements.push({
      ...openElement,
      innerEndOffset: code.length,
      endOffset: code.length,
    });
  }

  return elements.sort((left, right) => left.startOffset - right.startOffset || right.endOffset - left.endOffset);
};

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const shouldReceiveDrawgleId = (tagName: string) => SELECTABLE_TAGS.has(tagName);

export function ensureDrawgleIds(inputCode: string, prefix = "dg") {
  if (!inputCode.trim()) {
    return { code: inputCode, changed: false };
  }

  let cleanInputCode = inputCode;
  if (prefix === "dg-nav") {
    // Strip any data-drawgle-id attributes that do not start with "dg-nav-" to force re-generation
    cleanInputCode = inputCode.replace(
      /\sdata-drawgle-id\s*=\s*(?:"dg-([a-z0-9-]+)"|'dg-([a-z0-9-]+)'|dg-([a-z0-9-]+))/gi,
      (match, g1, g2, g3) => {
        const id = g1 ?? g2 ?? g3;
        if (id && !id.startsWith("nav-")) {
          return "";
        }
        return match;
      }
    );
  } else if (prefix === "dg") {
    // Strip any data-drawgle-id attributes that start with "dg-nav-" to force re-generation as screen IDs
    cleanInputCode = inputCode.replace(
      /\sdata-drawgle-id\s*=\s*(?:"dg-([a-z0-9-]+)"|'dg-([a-z0-9-]+)'|dg-([a-z0-9-]+))/gi,
      (match, g1, g2, g3) => {
        const id = g1 ?? g2 ?? g3;
        if (id && id.startsWith("nav-")) {
          return "";
        }
        return match;
      }
    );
  }

  const usedIds = new Set(
    Array.from(cleanInputCode.matchAll(/\sdata-drawgle-id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g))
      .map((match) => match[1] ?? match[2] ?? match[3])
      .filter(Boolean),
  );

  let nextIndex = 1;
  let changed = cleanInputCode !== inputCode;
  const buildDrawgleId = (index: number) => `${prefix}-${index.toString(36)}`;

  const code = cleanInputCode.replace(/<!--[^]*?-->|<\/?([A-Za-z][\w:-]*)([^<>]*?)>/g, (token, rawTagName) => {
    if (token.startsWith("<!--") || token.startsWith("</")) {
      return token;
    }

    const tagName = String(rawTagName ?? "").toLowerCase();
    if (!shouldReceiveDrawgleId(tagName) || /\sdata-drawgle-id\s*=/.test(token)) {
      return token;
    }

    let drawgleId = buildDrawgleId(nextIndex++);
    while (usedIds.has(drawgleId)) {
      drawgleId = buildDrawgleId(nextIndex++);
    }

    usedIds.add(drawgleId);
    changed = true;

    return token.endsWith("/>")
      ? token.replace(/\s*\/>$/, ` data-drawgle-id="${drawgleId}" />`)
      : token.replace(/\s*>$/, ` data-drawgle-id="${drawgleId}">`);
  });

  return { code, changed };
}

export function findDrawgleElement(code: string, drawgleId: string) {
  return parseElements(code).find((element) => element.attributes["data-drawgle-id"] === drawgleId) ?? null;
}

const getOpeningTag = (code: string, element: ParsedElement) =>
  code.slice(element.startOffset, element.openEndOffset);

const getAttributeValue = (openingTag: string, attributeName: string) => {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("\\s" + escapedName + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))", "i");
  const match = openingTag.match(regex);
  return match ? match[1] ?? match[2] ?? match[3] ?? "" : "";
};

const setOpeningTagAttribute = (openingTag: string, attributeName: string, value: string) => {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("\\s" + escapedName + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\"'=<>`]+)", "i");
  const attribute = ` ${attributeName}="${escapeAttribute(value)}"`;

  if (regex.test(openingTag)) {
    return openingTag.replace(regex, attribute);
  }

  return openingTag.endsWith("/>")
    ? openingTag.replace(/\s*\/>$/, `${attribute} />`)
    : openingTag.replace(/\s*>$/, `${attribute}>`);
};

const removeOpeningTagAttribute = (openingTag: string, attributeName: string) => {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("\\s" + escapedName + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\"'=<>`]+)", "i");
  return openingTag.replace(regex, "");
};

const sanitizeClassToken = (value: string) => {
  const normalized = value.trim();
  if (!normalized || /\s/.test(normalized) || /[<>"`;{}]/.test(normalized)) {
    throw new Error("Unsupported class utility value.");
  }
  return normalized;
};

const sanitizeClassList = (value: string) =>
  value
    .split(/\s+/)
    .map((className) => className.trim())
    .filter(Boolean)
    .map(sanitizeClassToken)
    .filter((className, index, list) => list.indexOf(className) === index)
    .join(" ");

const sanitizeAttributeName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (!/^(?:aria-[a-z0-9_-]+|data-[a-z0-9_-]+|role|title|alt|href|src|type|value|placeholder|target|rel)$/i.test(normalized)) {
    throw new Error(`Unsupported attribute: ${name}`);
  }
  return normalized;
};

function applySetClassUtility(code: string, drawgleId: string, family: DrawgleClassUtilityFamily, className: string) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected design target is stale. Please reselect the element.");
  }

  const openingTag = getOpeningTag(code, element);
  const nextClass = sanitizeClassToken(className);
  const classes = getAttributeValue(openingTag, "class")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !classNameMatchesUtilityFamily(family, item));

  classes.push(nextClass);
  const nextOpeningTag = setOpeningTagAttribute(openingTag, "class", Array.from(new Set(classes)).join(" "));
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

function applyRemoveClassUtility(code: string, drawgleId: string, family: DrawgleClassUtilityFamily) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected design target is stale. Please reselect the element.");
  }

  const openingTag = getOpeningTag(code, element);
  const classes = getAttributeValue(openingTag, "class")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !classNameMatchesUtilityFamily(family, item));

  const nextOpeningTag = classes.length > 0
    ? setOpeningTagAttribute(openingTag, "class", classes.join(" "))
    : removeOpeningTagAttribute(openingTag, "class");
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

function applyReplaceClassList(code: string, drawgleId: string, className: string) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected design target is stale. Please reselect the element.");
  }

  const openingTag = getOpeningTag(code, element);
  const nextClassName = sanitizeClassList(className);
  const nextOpeningTag = nextClassName
    ? setOpeningTagAttribute(openingTag, "class", nextClassName)
    : removeOpeningTagAttribute(openingTag, "class");
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

function applySetAttribute(code: string, drawgleId: string, name: string, value: string | null) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected design target is stale. Please reselect the element.");
  }

  const openingTag = getOpeningTag(code, element);
  const attributeName = sanitizeAttributeName(name);
  const nextOpeningTag = value === null || value === ""
    ? removeOpeningTagAttribute(openingTag, attributeName)
    : setOpeningTagAttribute(openingTag, attributeName, value.replace(/[<>]/g, "").slice(0, 500));
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}
const parseStyle = (style: string) => {
  const entries = new Map<string, string>();
  for (const declaration of style.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();
    if (property && value) {
      entries.set(property, value);
    }
  }
  return entries;
};

const serializeStyle = (style: Map<string, string>) =>
  Array.from(style.entries())
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

const setOpeningTagStyle = (openingTag: string, style: Map<string, string>) => {
  const serialized = serializeStyle(style);
  return serialized
    ? setOpeningTagAttribute(openingTag, "style", serialized)
    : removeOpeningTagAttribute(openingTag, "style");
};

const normalizeStyleValue = (value: string) => value.trim().replace(/[<>]/g, "");

const normalizeImageUrl = (value: string) => {
  const normalized = value.trim().replace(/[<>"']/g, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("Image replacement requires a stored HTTPS image URL.");
  }
  return normalized;
};

const buildReplacementImageMarkup = (src: string, alt?: string | null) =>
  `<img src="${escapeAttribute(src)}" alt="${escapeAttribute((alt?.trim() || "Replacement image").slice(0, 160))}" class="h-full w-full object-contain" />`;

const assertStyleProperty = (property: string): DrawgleStyleProperty => {
  if (!DRAWGLE_STYLE_PROPERTY_SET.has(property as DrawgleStyleProperty)) {
    throw new Error(`Unsupported style property: ${property}`);
  }
  return property as DrawgleStyleProperty;
};

function replaceOpeningTagInCode(code: string, element: ParsedElement, nextOpeningTag: string) {
  return `${code.slice(0, element.startOffset)}${nextOpeningTag}${code.slice(element.openEndOffset)}`;
}

function applyReplaceText(code: string, drawgleId: string, text: string) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected text target is stale. Please reselect the element.");
  }

  const currentInner = code.slice(element.innerStartOffset, element.innerEndOffset);
  if (/<[A-Za-z][\w:-]*(?:\s|>|\/)/.test(currentInner)) {
    throw new Error("Manual text editing only supports simple text nodes. Use AI edit for this selection.");
  }

  return `${code.slice(0, element.innerStartOffset)}${escapeText(text)}${code.slice(element.innerEndOffset)}`;
}

function applySetStyle(code: string, drawgleId: string, property: DrawgleStyleProperty, value: string) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected design target is stale. Please reselect the element.");
  }

  const openingTag = getOpeningTag(code, element);
  const style = parseStyle(getAttributeValue(openingTag, "style"));
  const nextValue = validateStyleValue(property, normalizeStyleValue(value));

  if (nextValue) {
    style.set(property, nextValue);
  } else {
    style.delete(property);
  }

  const nextOpeningTag = setOpeningTagStyle(openingTag, style);
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

function applyClearStyle(code: string, drawgleId: string, property: DrawgleStyleProperty) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected design target is stale. Please reselect the element.");
  }

  const openingTag = getOpeningTag(code, element);
  const style = parseStyle(getAttributeValue(openingTag, "style"));
  style.delete(property);

  const nextOpeningTag = setOpeningTagStyle(openingTag, style);
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

function replaceNthInlineSvg(innerHtml: string, targetIndex: number, replacement: string) {
  const matches = Array.from(innerHtml.matchAll(/<svg\b[\s\S]*?<\/svg>/gi));
  const match = matches[targetIndex] ?? matches[0];
  if (!match || match.index === undefined) {
    throw new Error("This replacement target no longer contains an SVG placeholder.");
  }

  return `${innerHtml.slice(0, match.index)}${replacement}${innerHtml.slice(match.index + match[0].length)}`;
}

function applyReplaceImage(
  code: string,
  drawgleId: string,
  mode: "src" | "background" | "inline_svg" | "visual_placeholder",
  src: string,
  alt?: string | null,
  targetIndex?: number | null,
) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) {
    throw new Error("Selected image target is stale. Please reselect the element.");
  }

  const nextSrc = normalizeImageUrl(src);
  const openingTag = getOpeningTag(code, element);

  if (mode === "src") {
    if (element.tagName !== "img") {
      throw new Error("This replacement target is no longer an image element.");
    }

    let nextOpeningTag = setOpeningTagAttribute(openingTag, "src", nextSrc);
    if (typeof alt === "string" && alt.trim()) {
      nextOpeningTag = setOpeningTagAttribute(nextOpeningTag, "alt", alt.trim().slice(0, 160));
    }
    return replaceOpeningTagInCode(code, element, nextOpeningTag);
  }

  if (mode === "inline_svg") {
    const replacement = buildReplacementImageMarkup(nextSrc, alt);
    const currentInner = code.slice(element.innerStartOffset, element.innerEndOffset);
    const nextInner = replaceNthInlineSvg(currentInner, Math.max(0, Number(targetIndex ?? 0)), replacement);
    return `${code.slice(0, element.innerStartOffset)}${nextInner}${code.slice(element.innerEndOffset)}`;
  }

  if (mode === "visual_placeholder") {
    const replacement = buildReplacementImageMarkup(nextSrc, alt);
    return `${code.slice(0, element.innerStartOffset)}${replacement}${code.slice(element.innerEndOffset)}`;
  }

  const style = parseStyle(getAttributeValue(openingTag, "style"));
  style.set("background-image", `url('${nextSrc.replaceAll("'", "%27")}')`);
  const nextOpeningTag = setOpeningTagStyle(openingTag, style);
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

export function applyDeleteElement(code: string, drawgleId: string): string {
  const elements = parseElements(code);
  const element = elements.find((el) => el.attributes["data-drawgle-id"] === drawgleId);
  if (!element) {
    throw new Error(`Target element with drawgle ID "${drawgleId}" not found.`);
  }

  const hasParent = elements.some(
    (el) => el.startOffset < element.startOffset && el.endOffset > element.endOffset
  );
  if (!hasParent) {
    throw new Error("Deleting the root-level screen container is not allowed.");
  }

  return code.slice(0, element.startOffset) + code.slice(element.endOffset);
}

export function applyDuplicateElement(code: string, drawgleId: string): string {
  const elements = parseElements(code);
  const element = elements.find((el) => el.attributes["data-drawgle-id"] === drawgleId);
  if (!element) {
    throw new Error(`Target element with drawgle ID "${drawgleId}" not found.`);
  }

  const hasParent = elements.some(
    (el) => el.startOffset < element.startOffset && el.endOffset > element.endOffset
  );
  if (!hasParent) {
    throw new Error("Duplicating the root-level screen container is not allowed.");
  }

  const outerHtml = code.slice(element.startOffset, element.endOffset);
  const cleanedCopy = stripDrawgleIds(outerHtml);

  return code.slice(0, element.endOffset) + cleanedCopy + code.slice(element.endOffset);
}

export function applyDeterministicEdits({
  code,
  drawgleId,
  operations,
  prefix = "dg",
}: {
  code: string;
  drawgleId: string;
  operations: DeterministicEditOperation[];
  prefix?: string;
}) {
  let nextCode = ensureDrawgleIds(code, prefix).code;

  for (const operation of operations) {
    const targetDrawgleId = operation.drawgleId || drawgleId;
    if (!targetDrawgleId) {
      throw new Error("A selected element id is required.");
    }

    if (operation.type === "replaceText") {
      nextCode = applyReplaceText(nextCode, targetDrawgleId, operation.text);
    } else if (operation.type === "setStyle") {
      nextCode = applySetStyle(nextCode, targetDrawgleId, assertStyleProperty(operation.property), operation.value);
    } else if (operation.type === "clearStyle") {
      nextCode = applyClearStyle(nextCode, targetDrawgleId, assertStyleProperty(operation.property));
    } else if (operation.type === "setClassUtility") {
      nextCode = applySetClassUtility(nextCode, targetDrawgleId, operation.family, operation.className);
    } else if (operation.type === "removeClassUtility") {
      nextCode = applyRemoveClassUtility(nextCode, targetDrawgleId, operation.family);
    } else if (operation.type === "replaceClassList") {
      nextCode = applyReplaceClassList(nextCode, targetDrawgleId, operation.className);
    } else if (operation.type === "setAttribute") {
      nextCode = applySetAttribute(nextCode, targetDrawgleId, operation.name, operation.value);
    } else if (operation.type === "replaceImage") {
      nextCode = applyReplaceImage(nextCode, targetDrawgleId, operation.mode, operation.src, operation.alt, operation.targetIndex);
    } else if (operation.type === "deleteElement") {
      nextCode = applyDeleteElement(nextCode, targetDrawgleId);
    } else if (operation.type === "duplicateElement") {
      nextCode = applyDuplicateElement(nextCode, targetDrawgleId);
    }
  }

  return nextCode;
}

export function stripDrawgleIds(code: string) {
  return code.replace(/\sdata-drawgle-id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/g, "");
}

export function getElementOuterHtml(code: string, drawgleId: string) {
  const element = findDrawgleElement(ensureDrawgleIds(code).code, drawgleId);
  return element ? ensureDrawgleIds(code).code.slice(element.startOffset, element.endOffset) : null;
}

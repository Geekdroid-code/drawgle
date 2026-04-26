export type DrawgleElementTargetType = "screen" | "navigation";

export type DrawgleTextNodeMeta = {
  drawgleId: string;
  tagName: string;
  text: string;
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
  gap?: string;
  borderColor?: string;
  borderWidth?: string;
  boxShadow?: string;
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

export type DrawgleEditableMetadata = {
  tagName: string;
  textNodes: DrawgleTextNodeMeta[];
  style: DrawgleStyleMeta;
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
    };

export type DrawgleStyleProperty =
  | "background-color"
  | "color"
  | "font-size"
  | "font-weight"
  | "line-height"
  | "border-radius"
  | "padding-top"
  | "padding-right"
  | "padding-bottom"
  | "padding-left"
  | "gap"
  | "border-color"
  | "border-width"
  | "box-shadow";

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

const STYLE_PROPERTY_SET = new Set<DrawgleStyleProperty>([
  "background-color",
  "color",
  "font-size",
  "font-weight",
  "line-height",
  "border-radius",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "border-color",
  "border-width",
  "box-shadow",
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

const buildDrawgleId = (index: number) => `dg-${index.toString(36)}`;

export function ensureDrawgleIds(inputCode: string) {
  if (!inputCode.trim()) {
    return { code: inputCode, changed: false };
  }

  const usedIds = new Set(
    Array.from(inputCode.matchAll(/\sdata-drawgle-id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g))
      .map((match) => match[1] ?? match[2] ?? match[3])
      .filter(Boolean),
  );

  let nextIndex = 1;
  let changed = false;
  const code = inputCode.replace(/<!--[^]*?-->|<\/?([A-Za-z][\w:-]*)([^<>]*?)>/g, (token, rawTagName) => {
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

const normalizeStyleValue = (value: string) => value.trim().replace(/[<>]/g, "");

const assertStyleProperty = (property: string): DrawgleStyleProperty => {
  if (!STYLE_PROPERTY_SET.has(property as DrawgleStyleProperty)) {
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
  const nextValue = normalizeStyleValue(value);

  if (nextValue) {
    style.set(property, nextValue);
  } else {
    style.delete(property);
  }

  const nextOpeningTag = setOpeningTagAttribute(openingTag, "style", serializeStyle(style));
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

  const nextOpeningTag = setOpeningTagAttribute(openingTag, "style", serializeStyle(style));
  return replaceOpeningTagInCode(code, element, nextOpeningTag);
}

export function applyDeterministicEdits({
  code,
  drawgleId,
  operations,
}: {
  code: string;
  drawgleId: string;
  operations: DeterministicEditOperation[];
}) {
  let nextCode = ensureDrawgleIds(code).code;

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

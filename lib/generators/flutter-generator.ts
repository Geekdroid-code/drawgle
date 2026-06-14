import {
  TranspileNode,
  ParsedStyles,
  isRedundantWrapper,
  toFlutterColor,
  toFlutterIconName,
  gradientDirectionToFlutter,
  resolveColorToStandard,
  getStyleTokenKey,
  hasIdenticalBackground
} from "../mobile-transpiler";

// ---------------------------------------------------------------------------
// FLUTTER-SPECIFIC AST PRE-PASS: CONTAINER FLATTENING
// ---------------------------------------------------------------------------
// Recursively merges single-child layout wrappers into their parent to
// eliminate redundant nested Container widgets ("Widget tree bloat").
// Only merges when styles are compatible (no conflicting background colors,
// border radii, or sizing constraints).
// ---------------------------------------------------------------------------

function collapseFlutterTree(node: TranspileNode): TranspileNode {
  const processedChildren = node.children.map(child => {
    if (typeof child === 'string') return child;
    return collapseFlutterTree(child);
  });

  const updatedNode: TranspileNode = { ...node, children: processedChildren };

  const isLayoutTag = ['div', 'section', 'main', 'article', 'aside', 'nav', 'header', 'footer', 'form', 'fieldset', 'ul', 'ol', 'li'].includes(updatedNode.tagName);
  if (!isLayoutTag) return updatedNode;

  if (updatedNode.pattern) return updatedNode;
  if (updatedNode.styles.isGrid) return updatedNode;
  if (updatedNode.styles.isAbsolute || updatedNode.styles.isFixedBottom) return updatedNode;

  const nonStringChildren = updatedNode.children.filter(c => typeof c !== 'string') as TranspileNode[];
  if (updatedNode.children.length !== 1 || nonStringChildren.length !== 1) return updatedNode;

  const child = nonStringChildren[0];

  const childIsLayout = ['div', 'section', 'main', 'article', 'aside', 'nav', 'header', 'footer', 'form', 'fieldset', 'ul', 'ol', 'li'].includes(child.tagName);
  if (!childIsLayout) return updatedNode;
  if (child.pattern) return updatedNode;
  if (child.styles.isGrid) return updatedNode;
  if (child.styles.isAbsolute || child.styles.isFixedBottom) return updatedNode;

  const parentHasBg = hasExplicitBackground(updatedNode);
  const childHasBg = hasExplicitBackground(child);
  if (parentHasBg && childHasBg) return updatedNode;

  const parentHasRadius = (updatedNode.styles.borderRadiusToken || updatedNode.styles.borderRadius > 0);
  const childHasRadius = (child.styles.borderRadiusToken || child.styles.borderRadius > 0);
  if (parentHasRadius && childHasRadius) return updatedNode;

  const parentHasExplicitSize = (typeof updatedNode.styles.width === 'number' || typeof updatedNode.styles.height === 'number');
  const childHasExplicitSize = (typeof child.styles.width === 'number' || typeof child.styles.height === 'number');
  if (parentHasExplicitSize && childHasExplicitSize) return updatedNode;

  if (updatedNode.styles.flexDirection !== child.styles.flexDirection && child.children.length > 1) return updatedNode;
  if (updatedNode.styles.shadow) return updatedNode;

  // Safe to merge parent and child styles
  const mergedStyles: ParsedStyles = { ...child.styles };

  mergedStyles.padding = {
    top: updatedNode.styles.padding.top + child.styles.padding.top,
    right: updatedNode.styles.padding.right + child.styles.padding.right,
    bottom: updatedNode.styles.padding.bottom + child.styles.padding.bottom,
    left: updatedNode.styles.padding.left + child.styles.padding.left,
  };
  mergedStyles.paddingTopToken = child.styles.paddingTopToken || updatedNode.styles.paddingTopToken;
  mergedStyles.paddingBottomToken = child.styles.paddingBottomToken || updatedNode.styles.paddingBottomToken;
  mergedStyles.paddingLeftToken = child.styles.paddingLeftToken || updatedNode.styles.paddingLeftToken;
  mergedStyles.paddingRightToken = child.styles.paddingRightToken || updatedNode.styles.paddingRightToken;

  mergedStyles.margin = { ...updatedNode.styles.margin };
  mergedStyles.marginTopToken = updatedNode.styles.marginTopToken || child.styles.marginTopToken;
  mergedStyles.marginBottomToken = updatedNode.styles.marginBottomToken || child.styles.marginBottomToken;
  mergedStyles.marginLeftToken = updatedNode.styles.marginLeftToken || child.styles.marginLeftToken;
  mergedStyles.marginRightToken = updatedNode.styles.marginRightToken || child.styles.marginRightToken;

  if (parentHasBg && !childHasBg) {
    mergedStyles.backgroundColor = updatedNode.styles.backgroundColor;
    mergedStyles.backgroundColorToken = updatedNode.styles.backgroundColorToken;
  }
  if (parentHasRadius && !childHasRadius) {
    mergedStyles.borderRadius = updatedNode.styles.borderRadius;
    mergedStyles.borderRadiusToken = updatedNode.styles.borderRadiusToken;
  }
  if (parentHasExplicitSize && !childHasExplicitSize) {
    mergedStyles.width = updatedNode.styles.width;
    mergedStyles.height = updatedNode.styles.height;
  }

  if (updatedNode.styles.hasFlex1 && !child.styles.hasFlex1) mergedStyles.hasFlex1 = true;
  if (updatedNode.styles.width === '100%' && child.styles.width !== '100%') mergedStyles.width = '100%';

  if (!child.styles.gap && !child.styles.gapToken && (updatedNode.styles.gap || updatedNode.styles.gapToken)) {
    mergedStyles.gap = updatedNode.styles.gap;
    mergedStyles.gapToken = updatedNode.styles.gapToken;
  }

  mergedStyles.opacity = updatedNode.styles.opacity * child.styles.opacity;

  if (updatedNode.styles.shadow && !child.styles.shadow) {
    mergedStyles.shadow = updatedNode.styles.shadow;
  }

  return {
    tagName: updatedNode.tagName,
    classes: [...updatedNode.classes, ...child.classes],
    id: updatedNode.id || child.id,
    styleText: updatedNode.styleText || child.styleText,
    styles: mergedStyles,
    attributes: { ...updatedNode.attributes, ...child.attributes },
    children: child.children,
    pattern: child.pattern || updatedNode.pattern,
  };
}

// ---------------------------------------------------------------------------
// EXPLICIT BACKGROUND CHECK
// ---------------------------------------------------------------------------
// Determines if a node has an explicitly set background (via class or inline
// style), as opposed to an inherited/resolved default. Prevents background
// pollution where inner containers incorrectly emit the page-level
// background color over colored parent cards.
// ---------------------------------------------------------------------------

function hasExplicitBackground(node: TranspileNode): boolean {
  if (node.styles.backgroundColorToken) return true;

  if (node.classes.some(c =>
    c.startsWith('bg-') ||
    c.startsWith('dg-bg-') ||
    c.startsWith('dg-surface-') ||
    c.startsWith('dg-action-')
  )) return true;

  if (node.styleText && (
    node.styleText.includes('background:') ||
    node.styleText.includes('background-color:')
  )) return true;

  return false;
}

// ---------------------------------------------------------------------------
// TOKEN NAMESPACE ROUTER
// ---------------------------------------------------------------------------
// Routes AST token strings to the correct AppTheme namespace.
// Maps short/variable keys (bgPrimary, screenPadding, etc.) safely.
// ---------------------------------------------------------------------------

const TOKEN_NAME_MAP: Record<string, string> = {
  'bgPrimary': 'backgroundPrimary',
  'bgSecondary': 'backgroundSecondary',
  'surfaceCard': 'surfaceCard',
  'actionPrimary': 'actionPrimary',
  'actionOnPrimary': 'actionOnPrimary',
  'textHigh': 'textHigh',
  'textMedium': 'textMedium',
  'textLow': 'textLow',
  'borderDivider': 'borderDivider',
  'borderRadiusApp': 'borderRadiusApp',
  'borderRadiusPill': 'borderRadiusPill',
  'screenPadding': 'screenPadding',
  'sectionGap': 'sectionGap',
  'elementGap': 'elementGap',
};

export function toFlutterThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  const mapped = TOKEN_NAME_MAP[token] || token;
  return `AppTheme.${mapped}`;
}

// ---------------------------------------------------------------------------
// LUCIDE TO MATERIAL ICON RESOLVER
// ---------------------------------------------------------------------------
// Maps common Lucide web icons to their valid, compilable Flutter counterparts.
// Avoids compiler errors from non-existent icon names.
// ---------------------------------------------------------------------------

const FLUTTER_ICON_MAP: Record<string, string> = {
  'home': 'Icons.home',
  'search': 'Icons.search',
  'plus': 'Icons.add',
  'more-horizontal': 'Icons.more_horiz',
  'more-vertical': 'Icons.more_vert',
  'calendar': 'Icons.calendar_today',
  'utensils': 'Icons.restaurant',
  'salad': 'Icons.spa', // SPA leaf is closest Material icon for salad/health
  'cookie': 'Icons.cookie',
  'flame': 'Icons.local_fire_department',
  'glass-water': 'Icons.local_drink',
  'coffee': 'Icons.coffee',
  'chevron-left': 'Icons.chevron_left',
  'chevron-right': 'Icons.chevron_right',
  'chevron-down': 'Icons.keyboard_arrow_down',
  'chevron-up': 'Icons.keyboard_arrow_up',
  'bell': 'Icons.notifications',
  'user': 'Icons.person',
  'settings': 'Icons.settings',
  'heart': 'Icons.favorite',
  'edit': 'Icons.edit',
  'trash': 'Icons.delete',
  'check': 'Icons.check',
  'x': 'Icons.close',
};

function resolveFlutterIconName(lucideName: string): string {
  const norm = lucideName.toLowerCase().trim();
  if (FLUTTER_ICON_MAP[norm]) return FLUTTER_ICON_MAP[norm];
  
  // Normalize snake case names as secondary option, fallback to safe help icon on mismatch
  const snake = norm.replace(/-/g, '_');
  return `Icons.${snake}`;
}

// ---------------------------------------------------------------------------
// WIDTH & CONSTRAINT PARSER
// ---------------------------------------------------------------------------
// Extracts exact pixel dimension constraints from CSS strings (e.g. min(356px, ...))
// to prevent layout stretching on wide viewport systems.
// ---------------------------------------------------------------------------

interface SizeConstraints {
  width?: number;
  maxWidth?: number;
  isPercentWidth?: boolean;
}

function parseWidthConstraint(widthVal: string | number | undefined, styleText?: string): SizeConstraints {
  const result: SizeConstraints = {};
  if (typeof widthVal === 'number') {
    result.width = widthVal;
    return result;
  }
  if (typeof widthVal === 'string') {
    if (widthVal === '100%') {
      result.isPercentWidth = true;
      return result;
    }
    const minMatch = widthVal.match(/min\(\s*(\d+)px/);
    if (minMatch) {
      result.maxWidth = parseFloat(minMatch[1]);
      return result;
    }
    const pxMatch = widthVal.match(/^(\d+)px$/);
    if (pxMatch) {
      result.width = parseFloat(pxMatch[1]);
      return result;
    }
  }

  if (styleText) {
    const widthMatch = styleText.match(/width:\s*min\(\s*(\d+)px/);
    if (widthMatch) {
      result.maxWidth = parseFloat(widthMatch[1]);
      return result;
    }
    const maxWMatch = styleText.match(/max-width:\s*(\d+)px/);
    if (maxWMatch) {
      result.maxWidth = parseFloat(maxWMatch[1]);
      return result;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// TYPOGRAPHY MAPPER
// ---------------------------------------------------------------------------
// Maps class typographic names directly to Material 3 TextStyle schemes.
// ---------------------------------------------------------------------------

function getFlutterTypographyStyle(classes: string[]): string | undefined {
  for (const c of classes) {
    if (c.includes('screen-title') || c.includes('dg-type-screen-title')) return 'Theme.of(context).textTheme.headlineLarge';
    if (c.includes('section-title') || c.includes('dg-type-section-title')) return 'Theme.of(context).textTheme.titleLarge';
    if (c.includes('card-title') || c.includes('dg-type-card-title')) return 'Theme.of(context).textTheme.titleMedium';
    if (c.includes('subtitle') || c.includes('dg-type-subtitle')) return 'Theme.of(context).textTheme.titleSmall';
    if (c.includes('heading') || c.includes('dg-type-heading')) return 'Theme.of(context).textTheme.headlineMedium';
    if (c.includes('display') || c.includes('dg-type-display')) return 'Theme.of(context).textTheme.displaySmall';
    if (c.includes('body') || c.includes('dg-type-body')) return 'Theme.of(context).textTheme.bodyLarge';
    if (c.includes('caption') || c.includes('dg-type-caption')) return 'Theme.of(context).textTheme.bodyMedium';
    if (c.includes('metadata') || c.includes('dg-type-metadata')) return 'Theme.of(context).textTheme.labelSmall';
    if (c.includes('label') || c.includes('dg-type-label')) return 'Theme.of(context).textTheme.labelMedium';
  }
  return undefined;
}

// Post-processing string sanitizer
function sanitizeFlutterCode(code: string): string {
  return code
    .replace(/color:\s*Colors\.transparent,?\n/g, "")
    .replace(/,\s*\n\s*\),\n/g, "\n    ),\n")
    .replace(/,\s*\),\n\s*\)/g, "),\n)");
}

export function transpileToFlutter(root: TranspileNode): string {
  // Pre-pass: flatten tree to remove visual container bloat
  const flattenedRoot = collapseFlutterTree(root);
  
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function wrapExpandedIfNeeded(node: TranspileNode, outCode: string, indent: string, isGridChild = false): string {
    if (node.styles.hasFlex1 && !node.styles.isAbsolute && !isGridChild) {
      return `${indent}Expanded(\n` +
             `${indent}  child: ${outCode.trim()},\n` +
             `${indent})\n`;
    }
    return outCode;
  }

  function walk(
    node: TranspileNode | string, 
    parentIsFixedBottomRow = false, 
    parentStyles?: ParsedStyles,
    isGridChild = false
  ): string {
    if (typeof node === "string") {
      return `${getIndent()}Text('${node.replace(/'/g, "\\'")}')\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentIsFixedBottomRow, parentStyles, isGridChild);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    let out = "";
    
    // ---------------------------------------------------------
    // SEMANTIC PATTERNS RESOLUTION
    // ---------------------------------------------------------
    
    // Pattern 1: Divider
    if (node.pattern?.type === 'divider') {
      const isVertical = node.pattern.metadata.orientation === 'vertical';
      const borderCol = styles.borderColorToken 
        ? toFlutterThemeToken(styles.borderColorToken, "") 
        : (styles.backgroundColor && styles.backgroundColor !== "transparent" 
            ? toFlutterColor(styles.backgroundColor) 
            : toFlutterColor(styles.borderColor));
            
      let divCode = "";
      if (isVertical) {
        divCode = `${getIndent()}VerticalDivider(width: 1.0, thickness: 1.0, color: ${borderCol})\n`;
      } else {
        divCode = `${getIndent()}Divider(height: 1.0, thickness: 1.0, color: ${borderCol})\n`;
      }
      
      const mt = styles.marginTopToken ? toFlutterThemeToken(styles.marginTopToken, "") : `${styles.margin.top}.0`;
      const mb = styles.marginBottomToken ? toFlutterThemeToken(styles.marginBottomToken, "") : `${styles.margin.bottom}.0`;
      if (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.marginTopToken || styles.marginBottomToken) {
        divCode = `${getIndent()}Padding(\n` +
                  `${getIndent()}  padding: EdgeInsets.only(top: ${mt}, bottom: ${mb}),\n` +
                  `${getIndent()}  child: ${divCode.trim()},\n` +
                  `${getIndent()})\n`;
      }
      return wrapExpandedIfNeeded(node, divCode, getIndent(), isGridChild);
    }

    // Pattern 2: Status Dot
    if (node.pattern?.type === 'status-dot') {
      const { size, color, colorToken } = node.pattern.metadata;
      const fillCol = colorToken ? toFlutterThemeToken(colorToken, "") : toFlutterColor(color);
      
      let dotCode = `${getIndent()}Container(\n`;
      dotCode += `${getIndent()}  width: ${size}.0,\n`;
      dotCode += `${getIndent()}  height: ${size}.0,\n`;
      dotCode += `${getIndent()}  decoration: BoxDecoration(\n`;
      dotCode += `${getIndent()}    color: ${fillCol},\n`;
      dotCode += `${getIndent()}    shape: BoxShape.circle,\n`;
      dotCode += `${getIndent()}  ),\n`;
      dotCode += `${getIndent()})\n`;
      
      if (styles.opacity < 1) {
        dotCode = `${getIndent()}Opacity(\n` +
                  `${getIndent()}  opacity: ${styles.opacity},\n` +
                  `${getIndent()}  child: ${dotCode.trim()},\n` +
                  `${getIndent()})\n`;
      }
      if (styles.isAbsolute && styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        let posAttrs = "";
        if (top !== undefined || topToken) posAttrs += `top: ${topToken ? toFlutterThemeToken(topToken, "") : `${top}.0`}, `;
        if (right !== undefined || rightToken) posAttrs += `right: ${rightToken ? toFlutterThemeToken(rightToken, "") : `${right}.0`}, `;
        if (bottom !== undefined || bottomToken) posAttrs += `bottom: ${bottomToken ? toFlutterThemeToken(bottomToken, "") : `${bottom}.0`}, `;
        if (left !== undefined || leftToken) posAttrs += `left: ${leftToken ? toFlutterThemeToken(leftToken, "") : `${left}.0`}, `;
        
        dotCode = `${getIndent()}Positioned(\n` +
                  `${getIndent()}  ${posAttrs.trim()}\n` +
                  `${getIndent()}  child: ${dotCode.trim()},\n` +
                  `${getIndent()})\n`;
      }
      
      return wrapExpandedIfNeeded(node, dotCode, getIndent(), isGridChild);
    }

    // Pattern 3: Progress Bar
    if (node.pattern?.type === 'progress-bar') {
      const { value, outerColor, outerColorToken, innerColor, innerColorToken, outerHeight, borderRadius, borderRadiusToken } = node.pattern.metadata;
      const outBg = outerColorToken ? toFlutterThemeToken(outerColorToken, "") : toFlutterColor(outerColor);
      const inBg = innerColorToken ? toFlutterThemeToken(innerColorToken, "") : toFlutterColor(innerColor);
      const radius = borderRadiusToken ? toFlutterThemeToken(borderRadiusToken, "") : `${borderRadius}.0`;
      
      let pbCode = `${getIndent()}ClipRRect(\n`;
      pbCode += `${getIndent()}  borderRadius: BorderRadius.circular(${radius}),\n`;
      pbCode += `${getIndent()}  child: LinearProgressIndicator(\n`;
      pbCode += `${getIndent()}    value: ${value.toFixed(3)},\n`;
      pbCode += `${getIndent()}    backgroundColor: ${outBg},\n`;
      pbCode += `${getIndent()}    valueColor: AlwaysStoppedAnimation<Color>(${inBg}),\n`;
      pbCode += `${getIndent()}    minHeight: ${outerHeight}.0,\n`;
      pbCode += `${getIndent()}  ),\n`;
      pbCode += `${getIndent()})\n`;
      
      const pt = styles.paddingTopToken ? toFlutterThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.0`;
      const pb = styles.paddingBottomToken ? toFlutterThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.0`;
      if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.paddingTopToken || styles.paddingBottomToken) {
        pbCode = `${getIndent()}Padding(\n` +
                  `${getIndent()}  padding: EdgeInsets.only(top: ${pt}, bottom: ${pb}),\n` +
                  `${getIndent()}  child: ${pbCode.trim()},\n` +
                  `${getIndent()})\n`;
      }
      
      return wrapExpandedIfNeeded(node, pbCode, getIndent(), isGridChild);
    }

    // Lucide Icon Resolver
    if (lucide) {
      const tintColor = styles.textColorToken ? toFlutterThemeToken(styles.textColorToken, "") : toFlutterColor(styles.textColor);
      const resolvedIcon = resolveFlutterIconName(lucide);
      let outCode = `${getIndent()}Icon(${resolvedIcon}, size: ${styles.fontSize || 24}.0, color: ${tintColor})\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent(), isGridChild);
    }

    // Raw SVG Circular Progress Rings
    if (styles.isRawSvg) {
      const svgW = typeof styles.width === 'number' ? styles.width : 48;
      const svgH = typeof styles.height === 'number' ? styles.height : 48;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let svgOut = `${getIndent()}Stack(\n`;
        svgOut += `${getIndent()}  alignment: Alignment.center,\n`;
        svgOut += `${getIndent()}  children: [\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toFlutterThemeToken(tokenKey, "") 
            : toFlutterColor(resolveColorToStandard(strokeColorStr));
            
          const strokeLinecap = circle.attributes["stroke-linecap"] === "round" ? "StrokeCap.round" : "StrokeCap.square";
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;
          
          let progress = 1.0;
          if (dashArray > 0) {
            progress = 1.0 - (dashOffset / dashArray);
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
          }
          
          svgOut += `${getIndent()}  SizedBox(\n`;
          svgOut += `${getIndent()}    width: ${svgW}.0,\n`;
          svgOut += `${getIndent()}    height: ${svgH}.0,\n`;
          svgOut += `${getIndent()}    child: CircularProgressIndicator(\n`;
          svgOut += `${getIndent()}      value: ${progress.toFixed(2)},\n`;
          svgOut += `${getIndent()}      valueColor: AlwaysStoppedAnimation<Color>(${strokeColor}),\n`;
          svgOut += `${getIndent()}      strokeWidth: ${strokeWidth}.0,\n`;
          if (strokeLinecap === "StrokeCap.round") {
            svgOut += `${getIndent()}      strokeCap: StrokeCap.round,\n`;
          }
          svgOut += `${getIndent()}    ),\n`;
          svgOut += `${getIndent()}  ),\n`;
        });
        indentLevel--;
        svgOut += `${getIndent()}  ],\n`;
        svgOut += `${getIndent()})\n`;
        return wrapExpandedIfNeeded(node, svgOut, getIndent(), isGridChild);
      }
      
      let outCode = `${getIndent()}SizedBox(width: ${svgW}.0, height: ${svgH}.0) // TODO: Add custom SVG/Asset\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent(), isGridChild);
    }

    // Image Node with object-fit classes & double.infinity support
    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      const rad = styles.borderRadiusToken ? toFlutterThemeToken(styles.borderRadiusToken, "") : `${(styles.borderRadius || 0)}.0`;
      
      let fitVal = "BoxFit.cover";
      if (node.classes.includes("object-contain")) {
        fitVal = "BoxFit.contain";
      } else if (node.classes.includes("object-fill")) {
        fitVal = "BoxFit.fill";
      }
      
      let wVal = "";
      if (typeof styles.width === "number") wVal = `width: ${styles.width}.0, `;
      else if (styles.width === "100%" || node.classes.includes("w-full")) wVal = `width: double.infinity, `;
      
      let hVal = "";
      if (typeof styles.height === "number") hVal = `height: ${styles.height}.0, `;
      else if (styles.height === "100%" || node.classes.includes("h-full")) hVal = `height: double.infinity, `;

      let outCode = `${getIndent()}ClipRRect(\n`;
      outCode += `${getIndent()}  borderRadius: BorderRadius.circular(${rad}),\n`;
      outCode += `${getIndent()}  child: Image.network(\n`;
      outCode += `${getIndent()}    '${src}',\n`;
      if (wVal) outCode += `${getIndent()}    ${wVal.trim()}\n`;
      if (hVal) outCode += `${getIndent()}    ${hVal.trim()}\n`;
      outCode += `${getIndent()}    fit: ${fitVal},\n`;
      outCode += `${getIndent()})\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent(), isGridChild);
    }

    // Button Sizing & Shadow Fidelity
    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toFlutterThemeToken(styles.backgroundColorToken, "") : toFlutterColor(styles.backgroundColor);
      const btnRadius = styles.borderRadiusToken ? toFlutterThemeToken(styles.borderRadiusToken, "") : `${(styles.borderRadius || 12)}.0`;
      const paddingX = styles.paddingLeftToken ? toFlutterThemeToken(styles.paddingLeftToken, "") : `${(styles.padding.left || 16)}.0`;
      const paddingY = styles.paddingTopToken ? toFlutterThemeToken(styles.paddingTopToken, "") : `${(styles.padding.top || 12)}.0`;

      // Set elevation & shadowColor for surface/overlay shadows
      let shadowAttrs = "";
      if (styles.shadow === "surface") {
        shadowAttrs = `\n${getIndent()}    elevation: 4.0,\n${getIndent()}    shadowColor: Color(0x0A000000),`;
      } else if (styles.shadow === "overlay") {
        shadowAttrs = `\n${getIndent()}    elevation: 8.0,\n${getIndent()}    shadowColor: Color(0x1F000000),`;
      } else {
        shadowAttrs = `\n${getIndent()}    elevation: 0.0,`;
      }

      // Check if button has explicit width/height
      const hasExplicitSize = typeof styles.width === 'number' || typeof styles.height === 'number';
      
      let buttonStyle = `ElevatedButton.styleFrom(\n` +
                        `${getIndent()}    backgroundColor: ${containerColor},\n` +
                        `${getIndent()}    shape: RoundedRectangleBorder(\n` +
                        `${getIndent()}      borderRadius: BorderRadius.circular(${btnRadius}),\n` +
                        `${getIndent()}    ),${shadowAttrs}\n`;

      if (hasExplicitSize) {
        // Zero out padding so button conforms perfectly to SizedBox
        buttonStyle += `${getIndent()}    padding: EdgeInsets.zero,\n` +
                       `${getIndent()}    minimumSize: Size.zero,\n` +
                       `${getIndent()}    tapTargetSize: MaterialTapTargetSize.shrinkWrap,\n`;
      } else {
        buttonStyle += `${getIndent()}    padding: EdgeInsets.symmetric(horizontal: ${paddingX}, vertical: ${paddingY}),\n`;
      }
      buttonStyle += `${getIndent()}  )`;

      let buttonOut = `${getIndent()}ElevatedButton(\n` +
                      `${getIndent()}  onPressed: () {},\n` +
                      `${getIndent()}  style: ${buttonStyle},\n` +
                      `${getIndent()}  child: Row(\n` +
                      `${getIndent()}    mainAxisSize: MainAxisSize.min,\n` +
                      `${getIndent()}    mainAxisAlignment: MainAxisAlignment.center,\n` +
                      `${getIndent()}    children: [\n`;
      
      indentLevel += 3;
      node.children.forEach((c, idx) => {
        buttonOut += walk(c, parentIsFixedBottomRow, styles, isGridChild);
        if (idx < node.children.length - 1) {
          buttonOut = buttonOut.trimEnd() + ",\n";
          const btnGap = styles.gapToken ? toFlutterThemeToken(styles.gapToken, "") : `${(styles.gap || 8)}.0`;
          buttonOut += `${getIndent()}SizedBox(width: ${btnGap}),\n`;
        }
      });
      indentLevel -= 3;
      buttonOut += `${getIndent()}    ],\n`;
      buttonOut += `${getIndent()}  ),\n`;
      buttonOut += `${getIndent()})\n`;

      if (hasExplicitSize) {
        const wVal = typeof styles.width === 'number' ? `${styles.width}.0` : 'double.infinity';
        const hVal = typeof styles.height === 'number' ? `${styles.height}.0` : 'double.infinity';
        buttonOut = `${getIndent()}SizedBox(\n` +
                    `${getIndent()}  width: ${wVal},\n` +
                    `${getIndent()}  height: ${hVal},\n` +
                    `${getIndent()}  child: ${buttonOut.trim()},\n` +
                    `${getIndent()})\n`;
      }

      return wrapExpandedIfNeeded(node, buttonOut, getIndent(), isGridChild);
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    // Typography & copyWith Mapping
    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      let textOut = `${getIndent()}Text(\n`;
      textOut += `${getIndent()}  '${textVal.replace(/'/g, "\\'")}',\n`;
      
      const baseStyle = getFlutterTypographyStyle(node.classes);
      
      let styleProperties: string[] = [];
      if (!baseStyle && styles.fontSize !== undefined) {
        styleProperties.push(`fontSize: ${styles.fontSize}.0`);
      }
      if (styles.textColorToken || (styles.textColor && styles.textColor !== "transparent")) {
        const textTint = styles.textColorToken ? toFlutterThemeToken(styles.textColorToken, "") : toFlutterColor(styles.textColor);
        styleProperties.push(`color: ${textTint}`);
      }
      if (styles.fontWeight !== undefined) {
        if (styles.fontWeight === "heavy") {
          styleProperties.push(`fontWeight: FontWeight.w800`);
        } else if (styles.fontWeight === "bold") {
          styleProperties.push(`fontWeight: FontWeight.bold`);
        } else if (styles.fontWeight === "semibold") {
          styleProperties.push(`fontWeight: FontWeight.w600`);
        } else if (styles.fontWeight === "medium") {
          styleProperties.push(`fontWeight: FontWeight.w500`);
        } else {
          styleProperties.push(`fontWeight: FontWeight.normal`);
        }
      }

      if (baseStyle) {
        if (styleProperties.length > 0) {
          textOut += `${getIndent()}  style: ${baseStyle}?.copyWith(\n`;
          styleProperties.forEach(p => {
            textOut += `${getIndent()}    ${p},\n`;
          });
          textOut += `${getIndent()}  ),\n`;
        } else {
          textOut += `${getIndent()}  style: ${baseStyle},\n`;
        }
      } else if (styleProperties.length > 0) {
        textOut += `${getIndent()}  style: TextStyle(\n`;
        styleProperties.forEach(p => {
          textOut += `${getIndent()}    ${p},\n`;
        });
        textOut += `${getIndent()}  ),\n`;
      }

      if (styles.textAlign !== undefined) {
        if (styles.textAlign === "center") {
          textOut += `${getIndent()}  textAlign: TextAlign.center,\n`;
        } else if (styles.textAlign === "right") {
          textOut += `${getIndent()}  textAlign: TextAlign.right,\n`;
        } else if (styles.textAlign === "left") {
          textOut += `${getIndent()}  textAlign: TextAlign.left,\n`;
        }
      }
      textOut += `${getIndent()})\n`;
      
      const mt = styles.marginTopToken ? toFlutterThemeToken(styles.marginTopToken, "") : `${styles.margin.top}.0`;
      const mb = styles.marginBottomToken ? toFlutterThemeToken(styles.marginBottomToken, "") : `${styles.margin.bottom}.0`;
      if (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.marginTopToken || styles.marginBottomToken) {
        textOut = `${getIndent()}Padding(\n` +
                  `${getIndent()}  padding: EdgeInsets.only(top: ${mt}, bottom: ${mb}),\n` +
                  `${getIndent()}  child: ${textOut.trim()},\n` +
                  `${getIndent()})\n`;
      }
      return wrapExpandedIfNeeded(node, textOut, getIndent(), isGridChild);
    }

    // Static Grid Layout using Column & Rows to replace GridView.count
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toFlutterThemeToken(styles.gapToken, '') : `${styles.gap}.0`;
      const cols = styles.gridCols;
      
      let gridOut = `${getIndent()}Column(\n`;
      gridOut += `${getIndent()}  crossAxisAlignment: CrossAxisAlignment.stretch,\n`;
      gridOut += `${getIndent()}  children: [\n`;
      indentLevel++;
      
      const gridChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
      
      for (let i = 0; i < gridChildren.length; i += cols) {
        const rowChildren = gridChildren.slice(i, i + cols);
        
        gridOut += `${getIndent()}Row(\n`;
        gridOut += `${getIndent()}  crossAxisAlignment: CrossAxisAlignment.start,\n`;
        gridOut += `${getIndent()}  children: [\n`;
        indentLevel++;
        
        rowChildren.forEach((child, colIdx) => {
          let childCode = walk(child, parentIsFixedBottomRow, styles, true).trim();
          
          gridOut += `${getIndent()}Expanded(\n`;
          gridOut += `${getIndent()}  child: ${childCode},\n`;
          gridOut += `${getIndent()}),\n`;
          
          if (colIdx < rowChildren.length - 1) {
            gridOut += `${getIndent()}SizedBox(width: ${spacing}),\n`;
          }
        });
        
        // Pad incomplete last row with empty Expanded spacer
        if (rowChildren.length < cols) {
          const missing = cols - rowChildren.length;
          for (let m = 0; m < missing; m++) {
            gridOut += `${getIndent()}SizedBox(width: ${spacing}),\n`;
            gridOut += `${getIndent()}Expanded(\n`;
            gridOut += `${getIndent()}  child: SizedBox.shrink(),\n`;
            gridOut += `${getIndent()}),\n`;
          }
        }
        
        indentLevel--;
        gridOut += `${getIndent()}  ],\n`;
        gridOut += `${getIndent()}),\n`;
        
        if (i + cols < gridChildren.length) {
          gridOut += `${getIndent()}SizedBox(height: ${spacing}),\n`;
        }
      }
      
      indentLevel--;
      gridOut += `${getIndent()}  ],\n`;
      gridOut += `${getIndent()})\n`;
      
      return wrapExpandedIfNeeded(node, gridOut, getIndent(), isGridChild);
    }

    // Standard Stack Container (Column / Row)
    let isCol = styles.flexDirection === "column";
    if (parentIsFixedBottomRow && !isButton && !isImage && !lucide && !styles.isRawSvg && !isTextLeaf && !styles.isGrid) {
      isCol = false;
    }
    const widgetName = isCol ? "Column" : "Row";
    
    let containerWrap = false;
    let decoration = "";
    const identicalBg = hasIdenticalBackground(styles, parentStyles);
    
    // Background Inheritance Guard
    const hasBg = (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) ||
                  (hasExplicitBackground(node) && !identicalBg && (styles.backgroundColorToken || styles.backgroundColor !== "transparent"));

    if (hasBg ||
        styles.borderRadiusToken || styles.borderRadius > 0 || 
        styles.borderColorToken || styles.borderWidth > 0 ||
        styles.shadow) {
      containerWrap = true;
      decoration += `    decoration: BoxDecoration(\n`;

      if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
        const { begin, end } = gradientDirectionToFlutter(styles.gradient.direction);
        decoration += `      gradient: LinearGradient(\n`;
        decoration += `        begin: ${begin},\n`;
        decoration += `        end: ${end},\n`;
        decoration += `        colors: [${toFlutterColor(styles.gradient.fromColor)}, ${toFlutterColor(styles.gradient.toColor)}],\n`;
        decoration += `      ),\n`;
      } else if (hasExplicitBackground(node) && !identicalBg && styles.backgroundColorToken) {
        decoration += `      color: ${toFlutterThemeToken(styles.backgroundColorToken, "")},\n`;
      } else if (hasExplicitBackground(node) && !identicalBg && styles.backgroundColor !== "transparent") {
        decoration += `      color: ${toFlutterColor(styles.backgroundColor)},\n`;
      }
      
      if (styles.borderRadiusToken) {
        decoration += `      borderRadius: BorderRadius.circular(${toFlutterThemeToken(styles.borderRadiusToken, "")}),\n`;
      } else if (styles.borderRadius > 0) {
        decoration += `      borderRadius: BorderRadius.circular(${styles.borderRadius}.0),\n`;
      }
      
      if (styles.borderColorToken || styles.borderWidth > 0) {
        const borderCol = styles.borderColorToken ? toFlutterThemeToken(styles.borderColorToken, "") : toFlutterColor(styles.borderColor);
        decoration += `      border: Border.all(color: ${borderCol}, width: ${styles.borderWidth || 1}.0),\n`;
      }

      if (styles.shadow) {
        if (styles.shadow === "surface") {
          decoration += "      boxShadow: [\n" +
                        "        BoxShadow(\n" +
                        "          color: Color(0x0A000000),\n" +
                        "          blurRadius: 30.0,\n" +
                        "          offset: Offset(0.0, 10.0),\n" +
                        "        ),\n" +
                        "      ],\n";
        } else if (styles.shadow === "overlay") {
          decoration += "      boxShadow: [\n" +
                        "        BoxShadow(\n" +
                        "          color: Color(0x1F000000),\n" +
                        "          blurRadius: 40.0,\n" +
                        "          offset: Offset(0.0, 20.0),\n" +
                        "        ),\n" +
                        "      ],\n";
        }
      }
      decoration += `    ),\n`;
    }

    let sizeAttrs = "";
    
    // Parse width and max-width constraints
    const widthConstraints = parseWidthConstraint(styles.width, node.styleText);
    
    if (widthConstraints.width !== undefined) {
      sizeAttrs += `    width: ${widthConstraints.width}.0,\n`;
    } else if (widthConstraints.isPercentWidth || styles.hasFlex1) {
      sizeAttrs += `    width: double.infinity,\n`;
    }
    
    if (typeof styles.height === "number") {
      sizeAttrs += `    height: ${styles.height}.0,\n`;
    } else if (styles.height === "100%") {
      sizeAttrs += `    height: double.infinity,\n`;
    }

    // BoxConstraints builder for minHeight, maxWidth, etc.
    let constraintLines: string[] = [];
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) {
      constraintLines.push(`minHeight: ${styles.minHeight}.0`);
    }
    if (widthConstraints.maxWidth !== undefined) {
      constraintLines.push(`maxWidth: ${widthConstraints.maxWidth}.0`);
    }
    if (constraintLines.length > 0) {
      sizeAttrs += `    constraints: BoxConstraints(${constraintLines.join(', ')}),\n`;
    }
    
    const pt = styles.paddingTopToken ? toFlutterThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.0`;
    const pb = styles.paddingBottomToken ? toFlutterThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.0`;
    const pl = styles.paddingLeftToken ? toFlutterThemeToken(styles.paddingLeftToken, "") : `${styles.padding.left}.0`;
    const pr = styles.paddingRightToken ? toFlutterThemeToken(styles.paddingRightToken, "") : `${styles.padding.right}.0`;
    let paddingWrap = "";

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      paddingWrap = `    padding: EdgeInsets.only(left: AppTheme.screenPadding, top: ${pt}, right: AppTheme.screenPadding, bottom: ${pb}),\n`;
      containerWrap = true;
    } else if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0 ||
               styles.paddingTopToken || styles.paddingBottomToken || styles.paddingLeftToken || styles.paddingRightToken) {
      paddingWrap = `    padding: EdgeInsets.only(left: ${pl}, top: ${pt}, right: ${pr}, bottom: ${pb}),\n`;
      containerWrap = true;
    }

    const alignStr = isCol
      ? `crossAxisAlignment: CrossAxisAlignment.${styles.alignItems === "start" ? "start" : styles.alignItems === "end" ? "end" : styles.alignItems === "center" ? "center" : "stretch"}`
      : `crossAxisAlignment: CrossAxisAlignment.${styles.alignItems === "start" ? "start" : styles.alignItems === "end" ? "end" : "center"}`;
    
    let justifyVal = "start";
    if (styles.justifyContent !== "start") {
      justifyVal = styles.justifyContent === "center" ? "center" : styles.justifyContent === "end" ? "end" : styles.justifyContent === "between" ? "spaceBetween" : "spaceAround";
    }
    if (styles.isFixedBottom && !isCol && styles.justifyContent === "start") {
      justifyVal = "spaceAround";
    }
    const justifyStr = `mainAxisAlignment: MainAxisAlignment.${justifyVal}`;

    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;
    const isCurrentFixedBottomRow = styles.isFixedBottom && !isCol;

    let innerStackOut = "";
    if (normalChildren.length > 0) {
      innerStackOut += `${getIndent()}${widgetName}(\n`;
      innerStackOut += `${getIndent()}  ${alignStr},\n`;
      innerStackOut += `${getIndent()}  ${justifyStr},\n`;
      innerStackOut += `${getIndent()}  children: [\n`;
      
      indentLevel++;
      normalChildren.forEach((c, idx) => {
        innerStackOut += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles, styles.isGrid);
        if (idx < normalChildren.length - 1) {
          innerStackOut = innerStackOut.trimEnd() + ",\n";
          if (styles.gap > 0 || styles.gapToken) {
            const gapVal = styles.gapToken ? toFlutterThemeToken(styles.gapToken, "") : `${styles.gap}.0`;
            const gapSize = isCol ? `height: ${gapVal}` : `width: ${gapVal}`;
            innerStackOut += `${getIndent()}SizedBox(${gapSize}),\n`;
          }
        }
      });
      indentLevel--;
      innerStackOut += `${getIndent()}  ],\n`;
      innerStackOut += `${getIndent()})\n`;
    }

    if (containerWrap || sizeAttrs) {
      if (innerStackOut.trim() !== "") {
        innerStackOut = `${getIndent()}Container(\n` +
                        (sizeAttrs ? getIndent() + "  " + sizeAttrs.trim() + "\n" : "") +
                        (paddingWrap ? getIndent() + "  " + paddingWrap.trim() + "\n" : "") +
                        (decoration ? getIndent() + "  " + decoration.trim() + "\n" : "") +
                        `${getIndent()}  child: ${innerStackOut.trim()},\n` +
                        `${getIndent()})\n`;
      } else {
        innerStackOut = `${getIndent()}Container(\n` +
                        (sizeAttrs ? getIndent() + "  " + sizeAttrs.trim() + "\n" : "") +
                        (paddingWrap ? getIndent() + "  " + paddingWrap.trim() + "\n" : "") +
                        (decoration ? getIndent() + "  " + decoration.trim() + "\n" : "") +
                        `${getIndent()})\n`;
      }
    }

    if (hasAbsolute) {
      const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
      const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

      out += `${getIndent()}Stack(\n`;
      out += `${getIndent()}  children: [\n`;
      indentLevel++;
      
      bgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles, isGridChild).trimEnd() + ",\n";
      });

      if (innerStackOut.trim() !== "") {
        out += innerStackOut.trimEnd() + ",\n";
      }

      fgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles, isGridChild).trimEnd() + ",\n";
      });

      indentLevel--;
      out += `${getIndent()}  ],\n`;
      out += `${getIndent()})\n`;
    } else {
      out += innerStackOut;
    }

    if (typeof node !== "string") {
      if (styles.opacity < 1) {
        out = `${getIndent()}Opacity(\n` +
              `${getIndent()}  opacity: ${styles.opacity},\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
      if (styles.isAbsolute) {
        if (styles.isBackgroundAbsolute) {
          out = `${getIndent()}Positioned.fill(\n` +
                `${getIndent()}  child: ${out.trim()},\n` +
                `${getIndent()})\n`;
        } else if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          let posAttrs = "";
          if (top !== undefined || topToken) posAttrs += `top: ${topToken ? toFlutterThemeToken(topToken, "") : `${top}.0`}, `;
          if (right !== undefined || rightToken) posAttrs += `right: ${rightToken ? toFlutterThemeToken(rightToken, "") : `${right}.0`}, `;
          if (bottom !== undefined || bottomToken) posAttrs += `bottom: ${bottomToken ? toFlutterThemeToken(bottomToken, "") : `${bottom}.0`}, `;
          if (left !== undefined || leftToken) posAttrs += `left: ${leftToken ? toFlutterThemeToken(leftToken, "") : `${left}.0`}, `;
          
          out = `${getIndent()}Positioned(\n` +
                `${getIndent()}  ${posAttrs.trim()}\n` +
                `${getIndent()}  child: ${out.trim()},\n` +
                `${getIndent()})\n`;
        } else {
          out = `${getIndent()}Positioned.fill(\n` +
                `${getIndent()}  child: ${out.trim()},\n` +
                `${getIndent()})\n`;
        }
      }
      if (styles.isFixedBottom) {
        out = `${getIndent()}Align(\n` +
              `${getIndent()}  alignment: Alignment.bottomCenter,\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
      if (styles.hasFlex1 && !styles.isAbsolute && !isGridChild) {
        out = `${getIndent()}Expanded(\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
    }

    return out;
  }

  const rawFlutter = walk(flattenedRoot);
  return sanitizeFlutterCode(rawFlutter);
}

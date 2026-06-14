import {
  TranspileNode,
  ParsedStyles,
  isRedundantWrapper,
  toRNColor,
  toRNIconName,
  resolveColorToStandard,
  getStyleTokenKey,
  hasIdenticalBackground
} from "../mobile-transpiler";

// ---------------------------------------------------------------------------
// REACT NATIVE-SPECIFIC AST PRE-PASS: CONTAINER FLATTENING
// ---------------------------------------------------------------------------
// Recursively merges single-child layout wrappers into their parent to
// eliminate redundant nested <View> containers ("View bloat").
// Only merges when styles are compatible (no conflicting backgrounds,
// border radii, or sizing constraints).
// ---------------------------------------------------------------------------

function collapseRNTree(node: TranspileNode): TranspileNode {
  const processedChildren = node.children.map(child => {
    if (typeof child === 'string') return child;
    return collapseRNTree(child);
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

  // Safe to merge
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
// Determines if a node has an explicitly-set background (via class or inline
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
// Routes AST token strings to the correct AppTheme namespace:
//   Colors → AppTheme.colors.*
//   Radii  → AppTheme.radii.*
//   Layout → AppTheme.layout.*
// Also normalizes short names (bgPrimary → backgroundPrimary).
// ---------------------------------------------------------------------------

const TOKEN_NAME_MAP: Record<string, string> = {
  'bgPrimary': 'backgroundPrimary',
  'bgSecondary': 'backgroundSecondary',
  'surfaceCard': 'surfaceCard',
  'surfaceModal': 'surfaceModal',
  'surfaceBottomSheet': 'surfaceBottomSheet',
  'actionPrimary': 'actionPrimary',
  'actionOnPrimary': 'actionOnPrimary',
  'actionSecondary': 'actionSecondary',
  'textHigh': 'textHigh',
  'textMedium': 'textMedium',
  'textLow': 'textLow',
  'borderDivider': 'borderDivider',
  'borderFocused': 'borderFocused',
};

const RADII_TOKENS = new Set(['borderRadiusApp', 'borderRadiusPill']);
const LAYOUT_TOKENS = new Set(['screenPadding', 'sectionGap', 'elementGap']);

export function toRNThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;

  // Radii namespace — normalize borderRadiusApp → app, borderRadiusPill → pill
  if (RADII_TOKENS.has(token)) {
    const radiiKey = token.replace('borderRadius', '').charAt(0).toLowerCase() + token.replace('borderRadius', '').slice(1);
    return `AppTheme.radii.${radiiKey}`;
  }

  // Layout namespace
  if (LAYOUT_TOKENS.has(token)) {
    return `AppTheme.layout.${token}`;
  }

  // Colors namespace — apply name normalization
  const normalizedName = TOKEN_NAME_MAP[token] || token;
  return `AppTheme.colors.${normalizedName}`;
}

export function gradientDirectionToRN(direction: string): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const norm = direction.toLowerCase().trim();
  if (norm.includes("to bottom right")) return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
  if (norm.includes("to top left")) return { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } };
  if (norm.includes("to right")) return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
  if (norm.includes("to left")) return { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } };
  if (norm.includes("to bottom")) return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
  if (norm.includes("to top")) return { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } };
  return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
}

function getRNShadowStyle(shadow: string | null | undefined, indent: string): string {
  if (!shadow) return "";
  if (shadow === "surface") {
    return `${indent}shadowColor: '#000',\n` +
           `${indent}shadowOffset: { width: 0, height: 4 },\n` +
           `${indent}shadowOpacity: 0.04,\n` +
           `${indent}shadowRadius: 15,\n` +
           `${indent}elevation: 2,\n`;
  }
  if (shadow === "overlay") {
    return `${indent}shadowColor: '#000',\n` +
           `${indent}shadowOffset: { width: 0, height: 10 },\n` +
           `${indent}shadowOpacity: 0.12,\n` +
           `${indent}shadowRadius: 20,\n` +
           `${indent}elevation: 6,\n`;
  }
  return "";
}

// Post-processing string sanitizer
function sanitizeReactNativeCode(code: string): string {
  return code
    .replace(/backgroundColor:\s*'transparent',?\n/g, "")
    .replace(/borderColor:\s*'transparent',?\n/g, "")
    .replace(/,\s*\n\s*\}\}\n/g, "\n  }}\n")
    .replace(/,\s*\}\}/g, " }}");
}

export function transpileToReactNative(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function walk(
    node: TranspileNode | string, 
    isGridChildOfCols?: number, 
    parentIsFixedBottomRow = false, 
    parentStyles?: ParsedStyles
  ): string {
    if (typeof node === "string") {
      return `${getIndent()}<Text>${node.replace(/"/g, '\\"')}</Text>\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], isGridChildOfCols, parentIsFixedBottomRow, parentStyles);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    const widthPercent = isGridChildOfCols && isGridChildOfCols > 0 ? `${Math.floor(100 / isGridChildOfCols) - 2}%` : "100%";
    
    // ---------------------------------------------------------
    // SEMANTIC PATTERNS RESOLUTION
    // ---------------------------------------------------------
    
    // Pattern 1: Divider
    if (node.pattern?.type === 'divider') {
      const isVertical = node.pattern.metadata.orientation === 'vertical';
      const borderCol = styles.borderColorToken 
        ? toRNThemeToken(styles.borderColorToken, '') 
        : (styles.backgroundColor && styles.backgroundColor !== "transparent" 
            ? toRNColor(styles.backgroundColor) 
            : toRNColor(styles.borderColor));
            
      const mt = styles.marginTopToken ? toRNThemeToken(styles.marginTopToken, "") : styles.margin.top;
      const mb = styles.marginBottomToken ? toRNThemeToken(styles.marginBottomToken, "") : styles.margin.bottom;
      
      let divStyles = `flexDirection: 'column', `;
      if (isVertical) {
        divStyles += `width: 1, height: '100%', backgroundColor: ${borderCol}`;
      } else {
        divStyles += `height: 1, width: '100%', backgroundColor: ${borderCol}`;
      }
      if (styles.margin.top > 0 || styles.marginTopToken) divStyles += `, marginTop: ${mt}`;
      if (styles.margin.bottom > 0 || styles.marginBottomToken) divStyles += `, marginBottom: ${mb}`;
      
      return `${getIndent()}<View style={{ ${divStyles} }} />\n`;
    }

    // Pattern 2: Status Dot
    if (node.pattern?.type === 'status-dot') {
      const { size, color, colorToken } = node.pattern.metadata;
      const fillCol = colorToken ? toRNThemeToken(colorToken, "") : toRNColor(color);
      
      let dotStyles = `width: ${size}, height: ${size}, backgroundColor: ${fillCol}, borderRadius: ${size / 2}`;
      if (styles.opacity < 1) dotStyles += `, opacity: ${styles.opacity}`;
      if (styles.isAbsolute && styles.absolutePosition) {
        dotStyles += `, position: 'absolute'`;
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        if (top !== undefined || topToken) dotStyles += `, top: ${topToken ? toRNThemeToken(topToken, "") : top}`;
        if (right !== undefined || rightToken) dotStyles += `, right: ${rightToken ? toRNThemeToken(rightToken, "") : right}`;
        if (bottom !== undefined || bottomToken) dotStyles += `, bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom}`;
        if (left !== undefined || leftToken) dotStyles += `, left: ${leftToken ? toRNThemeToken(leftToken, "") : left}`;
      }
      
      return `${getIndent()}<View style={{ ${dotStyles} }} />\n`;
    }

    // Pattern 3: Progress Bar
    if (node.pattern?.type === 'progress-bar') {
      const { value, outerColor, outerColorToken, innerColor, innerColorToken, outerHeight, borderRadius, borderRadiusToken } = node.pattern.metadata;
      const outBg = outerColorToken ? toRNThemeToken(outerColorToken, "") : toRNColor(outerColor);
      const inBg = innerColorToken ? toRNThemeToken(innerColorToken, "") : toRNColor(innerColor);
      const radius = borderRadiusToken ? toRNThemeToken(borderRadiusToken, "") : borderRadius;
      
      let pbStyles = `width: '100%', height: ${outerHeight}, backgroundColor: ${outBg}, borderRadius: ${radius}, overflow: 'hidden'`;
      
      const pt = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : styles.padding.top;
      const pb = styles.paddingBottomToken ? toRNThemeToken(styles.paddingBottomToken, "") : styles.padding.bottom;
      if (styles.padding.top > 0 || styles.paddingTopToken) pbStyles += `, paddingTop: ${pt}`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) pbStyles += `, paddingBottom: ${pb}`;
      
      let innerStyles = `width: '${(value * 100).toFixed(1)}%', height: '100%', backgroundColor: ${inBg}`;

      let pbCode = `${getIndent()}<View style={{ ${pbStyles} }}>\n`;
      pbCode += `${getIndent()}  <View style={{ ${innerStyles} }} />\n`;
      pbCode += `${getIndent()}</View>\n`;
      return pbCode;
    }

    // Lucide Icon
    if (lucide) {
      const iconSize = styles.fontSize || 24;
      const colorVal = styles.textColorToken ? toRNThemeToken(styles.textColorToken, "") : toRNColor(styles.textColor);
      let out = `${getIndent()}<Icon \n`;
      out += `${getIndent()}  name="${toRNIconName(lucide)}"\n`;
      out += `${getIndent()}  size={${iconSize}}\n`;
      out += `${getIndent()}  color={${colorVal}}\n`;
      out += `${getIndent()}/>\n`;
      return out;
    }

    // Raw SVG — Progress Ring Compilation
    // Calculates actual progress from stroke-dasharray/stroke-dashoffset
    // and differentiates track (background ring) from fill (progress arc).
    if (styles.isRawSvg) {
      const svgSize = typeof styles.width === 'number' ? styles.width : 48;
      const finalWidth = isGridChildOfCols && isGridChildOfCols > 0 ? `'${widthPercent}'` : svgSize;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let svgOut = `${getIndent()}<View style={{ width: ${finalWidth}, height: ${svgSize}, alignItems: 'center', justifyContent: 'center' }}>\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toRNThemeToken(tokenKey, "") 
            : toRNColor(resolveColorToStandard(strokeColorStr));

          // Calculate progress from SVG stroke-dasharray/dashoffset
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;

          let progress = 1.0;
          if (dashArray > 0) {
            progress = 1.0 - (dashOffset / dashArray);
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
          }

          // Only render the border ring if it's visible (progress > 0 for fill arcs,
          // always for track arcs which have no dasharray)
          const isTrackCircle = dashArray === 0; // No dasharray = background track
          const isVisible = isTrackCircle || progress > 0;

          if (isVisible) {
            svgOut += `${getIndent()}<View style={{\n`;
            svgOut += `${getIndent()}  width: '100%',\n`;
            svgOut += `${getIndent()}  height: '100%',\n`;
            svgOut += `${getIndent()}  borderWidth: ${strokeWidth},\n`;
            svgOut += `${getIndent()}  borderColor: ${strokeColor},\n`;
            svgOut += `${getIndent()}  borderRadius: ${svgSize / 2},\n`;
            svgOut += `${getIndent()}  position: 'absolute',\n`;
            if (!isTrackCircle && progress < 1) {
              // Partial progress — add opacity hint and comment for native SVG upgrade
              svgOut += `${getIndent()}  opacity: ${progress.toFixed(2)}, // Progress: ${(progress * 100).toFixed(0)}% — use react-native-svg for arc rendering\n`;
            }
            svgOut += `${getIndent()}}} />\n`;
          } else {
            // Progress is 0 — don't render the fill arc at all
            svgOut += `${getIndent()}{/* Progress arc: ${(progress * 100).toFixed(0)}% — hidden, use react-native-svg for precise rendering */}\n`;
          }
        });
        indentLevel--;
        svgOut += `${getIndent()}</View>\n`;
        return svgOut;
      }
      
      let out = `${getIndent()}<View style={{ width: ${finalWidth}, height: ${svgSize} }}>{/* TODO: Add custom SVG/Asset */}</View>\n`;
      return out;
    }

    // Image — with resizeMode and percentage height support
    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      const altText = node.attributes["alt"] || "";

      // Determine resizeMode from classes (object-contain, object-cover, object-fill)
      let resizeMode = "'cover'"; // default
      if (node.classes.includes('object-contain')) resizeMode = "'contain'";
      else if (node.classes.includes('object-fill')) resizeMode = "'stretch'";

      let out = `${getIndent()}<Image \n`;
      out += `${getIndent()}  source={{ uri: '${src}' }}\n`;
      out += `${getIndent()}  alt="${altText.replace(/"/g, '\\"')}"\n`;
      out += `${getIndent()}  resizeMode={${resizeMode}}\n`;
      
      out += `${getIndent()}  style={{\n`;
      if (isGridChildOfCols && isGridChildOfCols > 0) {
        out += `${getIndent()}    width: '${widthPercent}',\n`;
      }
      if (styles.isAbsolute) {
        out += `${getIndent()}    position: 'absolute',\n`;
        if (styles.isBackgroundAbsolute) {
          out += `${getIndent()}    top: 0,\n`;
          out += `${getIndent()}    left: 0,\n`;
          out += `${getIndent()}    right: 0,\n`;
          out += `${getIndent()}    bottom: 0,\n`;
        } else if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          if (top !== undefined || topToken) out += `${getIndent()}    top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
          if (right !== undefined || rightToken) out += `${getIndent()}    right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
          if (bottom !== undefined || bottomToken) out += `${getIndent()}    bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
          if (left !== undefined || leftToken) out += `${getIndent()}    left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
        }
      }
      if (!(isGridChildOfCols && isGridChildOfCols > 0)) {
        if (styles.isBackgroundAbsolute) {
          out += `${getIndent()}    width: '100%',\n`;
          out += `${getIndent()}    height: '100%',\n`;
        } else {
          if (styles.width === "100%") out += `${getIndent()}    width: '100%',\n`;
          else if (typeof styles.width === "number") out += `${getIndent()}    width: ${styles.width},\n`;
          // Support percentage and numeric heights
          if (styles.height === "100%") out += `${getIndent()}    height: '100%',\n`;
          else if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height},\n`;
        }
      } else if (typeof styles.height === "number") {
        out += `${getIndent()}    height: ${styles.height},\n`;
      } else if (styles.height === "100%") {
        out += `${getIndent()}    height: '100%',\n`;
      }
      
      if (styles.borderRadiusToken) {
        out += `${getIndent()}    borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}    borderRadius: ${styles.borderRadius},\n`;
      }
      out += `${getIndent()}  }}\n`;
      out += `${getIndent()}/>\n`;
      return out;
    }

    // Button — with explicit width/height support and shadow fidelity
    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toRNThemeToken(styles.backgroundColorToken, "") : `'${styles.backgroundColor}'`;
      const btnRadius = styles.borderRadiusToken ? toRNThemeToken(styles.borderRadiusToken, "") : String(styles.borderRadius || 12);

      let out = `${getIndent()}<TouchableOpacity \n`;
      out += `${getIndent()}  onPress={() => {}}\n`;
      out += `${getIndent()}  style={{\n`;
      if (isGridChildOfCols && isGridChildOfCols > 0) {
        out += `${getIndent()}    width: '${widthPercent}',\n`;
      }
      if (styles.isAbsolute) {
        out += `${getIndent()}    position: 'absolute',\n`;
        if (styles.absolutePosition) {
          const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
          if (top !== undefined || topToken) out += `${getIndent()}    top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
          if (right !== undefined || rightToken) out += `${getIndent()}    right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
          if (bottom !== undefined || bottomToken) out += `${getIndent()}    bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
          if (left !== undefined || leftToken) out += `${getIndent()}    left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
        }
      }

      // Explicit width/height takes priority over padding-based sizing
      const hasExplicitWidth = typeof styles.width === 'number';
      const hasExplicitHeight = typeof styles.height === 'number';
      if (hasExplicitWidth) {
        out += `${getIndent()}    width: ${styles.width},\n`;
      }
      if (hasExplicitHeight) {
        out += `${getIndent()}    height: ${styles.height},\n`;
      }

      // Background — use explicit check to avoid inherited bg pollution
      if (hasExplicitBackground(node)) {
        if (styles.backgroundColorToken || styles.backgroundColor !== "transparent") {
          out += `${getIndent()}    backgroundColor: ${containerColor},\n`;
        }
      }

      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        out += `${getIndent()}    borderRadius: ${btnRadius},\n`;
      }
      out += getRNShadowStyle(styles.shadow, getIndent() + "    ");

      // Only emit padding if no explicit width/height (padding-based sizing)
      if (!hasExplicitWidth && !hasExplicitHeight) {
        const paddingY = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : String(styles.padding.top || 12);
        const paddingX = styles.paddingLeftToken ? toRNThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left || 16);
        out += `${getIndent()}    paddingVertical: ${paddingY},\n`;
        out += `${getIndent()}    paddingHorizontal: ${paddingX},\n`;
      }

      out += `${getIndent()}    flexDirection: 'row',\n`;
      out += `${getIndent()}    alignItems: 'center',\n`;
      out += `${getIndent()}    justifyContent: 'center',\n`;
      out += `${getIndent()}  }}\n`;
      out += `${getIndent()}>\n`;
      indentLevel++;
      
      node.children.forEach(c => {
        out += walk(c, undefined, parentIsFixedBottomRow, styles);
      });

      indentLevel--;
      out += `${getIndent()}</TouchableOpacity>\n`;
      return out;
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      const textTint = styles.textColorToken ? toRNThemeToken(styles.textColorToken, "") : `'${styles.textColor}'`;
      
      let out = `${getIndent()}<Text style={{\n`;
      if (styles.fontSize !== undefined) {
        out += `${getIndent()}  fontSize: ${styles.fontSize},\n`;
      }
      if (styles.textColorToken || (styles.textColor && styles.textColor !== "transparent")) {
        out += `${getIndent()}  color: ${textTint},\n`;
      }
      if (styles.fontWeight !== undefined) {
        const wt = styles.fontWeight === "heavy" ? "'800'" : styles.fontWeight === "bold" ? "'bold'" : styles.fontWeight === "semibold" ? "'600'" : styles.fontWeight === "medium" ? "'500'" : "'normal'";
        out += `${getIndent()}  fontWeight: ${wt},\n`;
      }
      if (styles.textAlign !== undefined) {
        out += `${getIndent()}  textAlign: '${styles.textAlign}',\n`;
      }
      
      const mt = styles.marginTopToken ? toRNThemeToken(styles.marginTopToken, "") : styles.margin.top;
      const mb = styles.marginBottomToken ? toRNThemeToken(styles.marginBottomToken, "") : styles.margin.bottom;
      if (styles.margin.top > 0 || styles.marginTopToken) out += `${getIndent()}  marginTop: ${mt},\n`;
      if (styles.margin.bottom > 0 || styles.marginBottomToken) out += `${getIndent()}  marginBottom: ${mb},\n`;
      if (styles.opacity < 1) out += `${getIndent()}  opacity: ${styles.opacity},\n`;
      
      out += `${getIndent()}}}>\n`;
      out += `${getIndent()}  ${textVal.replace(/"/g, '\\"')}\n`;
      out += `${getIndent()}</Text>\n`;
      return out;
    }

    // Grid Container
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toRNThemeToken(styles.gapToken, "") : styles.gap;
      let out = `${getIndent()}<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: ${spacing} }}>\n`;
      indentLevel++;
      node.children.forEach(c => {
        out += walk(c, styles.gridCols, parentIsFixedBottomRow, styles);
      });
      indentLevel--;
      out += `${getIndent()}</View>\n`;
      return out;
    }

    // Standard Stack (View) — with absolute children and gradient support
    const isCol = styles.flexDirection === "column";
    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;

    let out = "";
    if (hasAbsolute) {
      const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
      const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

      out += `${getIndent()}<View style={{\n`;
      out += `${getIndent()}  position: 'relative',\n`;
      
      const pt = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : styles.padding.top;
      const pb = styles.paddingBottomToken ? toRNThemeToken(styles.paddingBottomToken, "") : styles.padding.bottom;
      const pl = styles.paddingLeftToken ? toRNThemeToken(styles.paddingLeftToken, "") : styles.padding.left;
      const pr = styles.paddingRightToken ? toRNThemeToken(styles.paddingRightToken, "") : styles.padding.right;

      if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
        out += `${getIndent()}  paddingHorizontal: AppTheme.layout.screenPadding,\n`;
        if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}  paddingTop: ${pt},\n`;
        if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}  paddingBottom: ${pb},\n`;
      } else {
        if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}  paddingTop: ${pt},\n`;
        if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}  paddingBottom: ${pb},\n`;
        if (styles.padding.left > 0 || styles.paddingLeftToken) out += `${getIndent()}  paddingLeft: ${pl},\n`;
        if (styles.padding.right > 0 || styles.paddingRightToken) out += `${getIndent()}  paddingRight: ${pr},\n`;
      }
      
      // Background — only emit if explicitly set on this node
      if (hasExplicitBackground(node)) {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}  backgroundColor: ${toRNThemeToken(styles.backgroundColorToken, "")},\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}  backgroundColor: ${toRNColor(styles.backgroundColor)},\n`;
        }
      }

      if (styles.borderRadiusToken) {
        out += `${getIndent()}  borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}  borderRadius: ${styles.borderRadius},\n`;
      }
      out += getRNShadowStyle(styles.shadow, getIndent() + "  ");
      out += `${getIndent()}}}>\n`;
      indentLevel++;

      bgAbsoluteChildren.forEach(c => {
        out += walk(c, undefined, parentIsFixedBottomRow, styles);
      });

      out += `${getIndent()}<View style={{\n`;
      out += `${getIndent()}  flexDirection: '${isCol ? 'column' : 'row'}',\n`;
      if (styles.alignItems && styles.alignItems !== "stretch") {
        out += `${getIndent()}  alignItems: '${styles.alignItems === 'start' ? 'flex-start' : styles.alignItems === 'end' ? 'flex-end' : 'center'}',\n`;
      }
      if (styles.justifyContent && styles.justifyContent !== "start") {
        out += `${getIndent()}  justifyContent: '${styles.justifyContent === 'between' ? 'space-between' : styles.justifyContent === 'around' ? 'space-around' : styles.justifyContent === 'end' ? 'flex-end' : 'center'}',\n`;
      }
      if (styles.gap > 0 || styles.gapToken) {
        out += `${getIndent()}  gap: ${styles.gapToken ? toRNThemeToken(styles.gapToken, "") : styles.gap},\n`;
      }
      out += `${getIndent()}  width: '100%',\n`;
      out += `${getIndent()}  height: '100%',\n`;
      out += `${getIndent()}}}>\n`;
      indentLevel++;
      
      normalChildren.forEach(c => {
        out += walk(c, undefined, parentIsFixedBottomRow, styles);
      });

      indentLevel--;
      out += `${getIndent()}</View>\n`;

      fgAbsoluteChildren.forEach(c => {
        out += walk(c, undefined, parentIsFixedBottomRow, styles);
      });

      indentLevel--;
      out += `${getIndent()}</View>\n`;
      return out;
    }

    // ---------------------------------------------------------------
    // NON-ABSOLUTE STANDARD STACK
    // Gradient containers use <LinearGradient> as the outermost
    // component directly, avoiding a redundant wrapper <View> that
    // would break the flex layout of children.
    // ---------------------------------------------------------------

    const isLinearGradient = styles.gradient && styles.gradient.fromColor && styles.gradient.toColor;

    // Open the component tag — LinearGradient or View
    if (isLinearGradient) {
      const { start, end } = gradientDirectionToRN(styles.gradient!.direction);
      out += `${getIndent()}<LinearGradient\n`;
      out += `${getIndent()}  colors={[${toRNColor(styles.gradient!.fromColor)}, ${toRNColor(styles.gradient!.toColor)}]}\n`;
      out += `${getIndent()}  start={{ x: ${start.x}, y: ${start.y} }}\n`;
      out += `${getIndent()}  end={{ x: ${end.x}, y: ${end.y} }}\n`;
    } else {
      out += `${getIndent()}<View\n`;
    }

    out += `${getIndent()}  style={{\n`;
    out += `${getIndent()}    flexDirection: '${isCol ? 'column' : 'row'}',\n`;
    if (styles.alignItems && styles.alignItems !== "stretch") {
      out += `${getIndent()}    alignItems: '${styles.alignItems === 'start' ? 'flex-start' : styles.alignItems === 'end' ? 'flex-end' : 'center'}',\n`;
    }
    if (styles.justifyContent && styles.justifyContent !== "start") {
      out += `${getIndent()}    justifyContent: '${styles.justifyContent === 'between' ? 'space-between' : styles.justifyContent === 'around' ? 'space-around' : styles.justifyContent === 'end' ? 'flex-end' : 'center'}',\n`;
    }
    if (styles.gap > 0 || styles.gapToken) {
      out += `${getIndent()}    gap: ${styles.gapToken ? toRNThemeToken(styles.gapToken, "") : styles.gap},\n`;
    }
    if (isGridChildOfCols && isGridChildOfCols > 0) {
      out += `${getIndent()}    width: '${widthPercent}',\n`;
    } else {
      if (styles.width === "100%" || styles.hasFlex1) out += `${getIndent()}    ${styles.hasFlex1 ? 'flex: 1' : "width: '100%'"},\n`;
      else if (typeof styles.width === "number") out += `${getIndent()}    width: ${styles.width},\n`;
      if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height},\n`;
    }
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) {
      out += `${getIndent()}    minHeight: ${styles.minHeight},\n`;
    }

    // Padding
    const pt = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : styles.padding.top;
    const pb = styles.paddingBottomToken ? toRNThemeToken(styles.paddingBottomToken, "") : styles.padding.bottom;
    const pl = styles.paddingLeftToken ? toRNThemeToken(styles.paddingLeftToken, "") : styles.padding.left;
    const pr = styles.paddingRightToken ? toRNThemeToken(styles.paddingRightToken, "") : styles.padding.right;

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      out += `${getIndent()}    paddingHorizontal: AppTheme.layout.screenPadding,\n`;
      if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}    paddingTop: ${pt},\n`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}    paddingBottom: ${pb},\n`;
    } else {
      if (styles.padding.top > 0 || styles.paddingTopToken) out += `${getIndent()}    paddingTop: ${pt},\n`;
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) out += `${getIndent()}    paddingBottom: ${pb},\n`;
      if (styles.padding.left > 0 || styles.paddingLeftToken) out += `${getIndent()}    paddingLeft: ${pl},\n`;
      if (styles.padding.right > 0 || styles.paddingRightToken) out += `${getIndent()}    paddingRight: ${pr},\n`;
    }

    // Background — only emit for non-gradient containers with explicit backgrounds
    if (!isLinearGradient) {
      if (hasExplicitBackground(node)) {
        const identicalBg = hasIdenticalBackground(styles, parentStyles);
        if (!identicalBg) {
          if (styles.backgroundColorToken) {
            out += `${getIndent()}    backgroundColor: ${toRNThemeToken(styles.backgroundColorToken, "")},\n`;
          } else if (styles.backgroundColor !== "transparent") {
            out += `${getIndent()}    backgroundColor: ${toRNColor(styles.backgroundColor)},\n`;
          }
        }
      }
    }

    if (styles.borderRadiusToken) {
      out += `${getIndent()}    borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
    } else if (styles.borderRadius > 0) {
      out += `${getIndent()}    borderRadius: ${styles.borderRadius},\n`;
    }
    out += getRNShadowStyle(styles.shadow, getIndent() + "    ");

    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toRNThemeToken(styles.borderColorToken, '') : toRNColor(styles.borderColor);
      out += `${getIndent()}    borderWidth: ${styles.borderWidth},\n`;
      out += `${getIndent()}    borderColor: ${borderCol},\n`;
    }

    if (styles.opacity < 1) {
      out += `${getIndent()}    opacity: ${styles.opacity},\n`;
    }

    if (styles.isAbsolute) {
      out += `${getIndent()}    position: 'absolute',\n`;
      if (styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        if (top !== undefined || topToken) out += `${getIndent()}    top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
        if (right !== undefined || rightToken) out += `${getIndent()}    right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
        if (bottom !== undefined || bottomToken) out += `${getIndent()}    bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
        if (left !== undefined || leftToken) out += `${getIndent()}    left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
      }
    }

    if (styles.isFixedBottom) {
      out += `${getIndent()}    position: 'absolute',\n`;
      out += `${getIndent()}    bottom: 0,\n`;
      out += `${getIndent()}    left: 0,\n`;
      out += `${getIndent()}    right: 0,\n`;
      out += `${getIndent()}    width: '100%',\n`;
    }

    out += `${getIndent()}  }}\n`;
    out += `${getIndent()}>\n`;
    indentLevel++;

    // Walk children directly — no nested LinearGradient wrapper needed
    normalChildren.forEach(c => {
      out += walk(c, undefined, parentIsFixedBottomRow, styles);
    });

    indentLevel--;
    out += `${getIndent()}</${isLinearGradient ? 'LinearGradient' : 'View'}>\n`;

    return out;
  }

  // Pre-pass: collapse redundant single-child layout wrappers
  const collapsedRoot = collapseRNTree(root);
  const rawRN = walk(collapsedRoot);
  return sanitizeReactNativeCode(rawRN);
}

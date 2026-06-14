import {
  TranspileNode,
  ParsedStyles,
  isRedundantWrapper,
  toComposeColor,
  toComposeIconName,
  gradientDirectionToCompose,
  cleanHexColor,
  formatSize,
  getStyleTokenKey,
  resolveColorToStandard,
  hasIdenticalBackground
} from "../mobile-transpiler";

// ---------------------------------------------------------------------------
// COMPOSE-SPECIFIC AST PRE-PASS: CONTAINER FLATTENING
// ---------------------------------------------------------------------------
// Recursively merges single-child layout wrappers into their parent to
// eliminate redundant nested Column/Row containers ("AST bloat").
// Only merges when styles are compatible (no conflicting backgrounds,
// border radii, or sizing constraints).
// ---------------------------------------------------------------------------

function collapseComposeTree(node: TranspileNode): TranspileNode {
  // First, recurse into children
  const processedChildren = node.children.map(child => {
    if (typeof child === 'string') return child;
    return collapseComposeTree(child);
  });

  const updatedNode: TranspileNode = { ...node, children: processedChildren };

  // Only attempt to collapse if this is a layout container (not a button, img, text leaf, svg, etc.)
  const isLayoutTag = ['div', 'section', 'main', 'article', 'aside', 'nav', 'header', 'footer', 'form', 'fieldset', 'ul', 'ol', 'li'].includes(updatedNode.tagName);
  if (!isLayoutTag) return updatedNode;

  // Skip if this node has a semantic pattern, is a grid, or has absolute children
  if (updatedNode.pattern) return updatedNode;
  if (updatedNode.styles.isGrid) return updatedNode;
  if (updatedNode.styles.isAbsolute || updatedNode.styles.isFixedBottom) return updatedNode;

  // Only collapse single-child layout containers
  const nonStringChildren = updatedNode.children.filter(c => typeof c !== 'string') as TranspileNode[];
  if (updatedNode.children.length !== 1 || nonStringChildren.length !== 1) return updatedNode;

  const child = nonStringChildren[0];

  // Don't collapse into non-layout children (buttons, images, text nodes, semantic patterns)
  const childIsLayout = ['div', 'section', 'main', 'article', 'aside', 'nav', 'header', 'footer', 'form', 'fieldset', 'ul', 'ol', 'li'].includes(child.tagName);
  if (!childIsLayout) return updatedNode;
  if (child.pattern) return updatedNode;
  if (child.styles.isGrid) return updatedNode;
  if (child.styles.isAbsolute || child.styles.isFixedBottom) return updatedNode;

  // Check for style conflicts — don't merge if both have meaningful backgrounds
  const parentHasBg = (updatedNode.styles.backgroundColorToken || updatedNode.styles.backgroundColor !== 'transparent');
  const childHasBg = (child.styles.backgroundColorToken || child.styles.backgroundColor !== 'transparent');
  if (parentHasBg && childHasBg) return updatedNode;

  // Don't merge if both have border radii (would lose inner/outer corner distinction)
  const parentHasRadius = (updatedNode.styles.borderRadiusToken || updatedNode.styles.borderRadius > 0);
  const childHasRadius = (child.styles.borderRadiusToken || child.styles.borderRadius > 0);
  if (parentHasRadius && childHasRadius) return updatedNode;

  // Don't merge if both have explicit sizing that could conflict
  const parentHasExplicitSize = (typeof updatedNode.styles.width === 'number' || typeof updatedNode.styles.height === 'number');
  const childHasExplicitSize = (typeof child.styles.width === 'number' || typeof child.styles.height === 'number');
  if (parentHasExplicitSize && childHasExplicitSize) return updatedNode;

  // Don't merge if flexDirections conflict and both have meaningful children
  if (updatedNode.styles.flexDirection !== child.styles.flexDirection && child.children.length > 1) return updatedNode;

  // Don't merge if parent has a shadow (shadow needs its own container layer)
  if (updatedNode.styles.shadow) return updatedNode;

  // Safe to merge: hoist child's properties up into parent
  const mergedStyles: ParsedStyles = { ...child.styles };

  // Merge padding: parent outer + child inner = combined padding
  mergedStyles.padding = {
    top: updatedNode.styles.padding.top + child.styles.padding.top,
    right: updatedNode.styles.padding.right + child.styles.padding.right,
    bottom: updatedNode.styles.padding.bottom + child.styles.padding.bottom,
    left: updatedNode.styles.padding.left + child.styles.padding.left,
  };
  // Prefer token-based padding if either has it
  mergedStyles.paddingTopToken = child.styles.paddingTopToken || updatedNode.styles.paddingTopToken;
  mergedStyles.paddingBottomToken = child.styles.paddingBottomToken || updatedNode.styles.paddingBottomToken;
  mergedStyles.paddingLeftToken = child.styles.paddingLeftToken || updatedNode.styles.paddingLeftToken;
  mergedStyles.paddingRightToken = child.styles.paddingRightToken || updatedNode.styles.paddingRightToken;

  // Merge margin: use parent's margin (outer frame)
  mergedStyles.margin = { ...updatedNode.styles.margin };
  mergedStyles.marginTopToken = updatedNode.styles.marginTopToken || child.styles.marginTopToken;
  mergedStyles.marginBottomToken = updatedNode.styles.marginBottomToken || child.styles.marginBottomToken;
  mergedStyles.marginLeftToken = updatedNode.styles.marginLeftToken || child.styles.marginLeftToken;
  mergedStyles.marginRightToken = updatedNode.styles.marginRightToken || child.styles.marginRightToken;

  // Hoist non-conflicting visual styles from parent
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

  // Preserve parent's flex-1 and width=100% if child doesn't already have them
  if (updatedNode.styles.hasFlex1 && !child.styles.hasFlex1) mergedStyles.hasFlex1 = true;
  if (updatedNode.styles.width === '100%' && child.styles.width !== '100%') mergedStyles.width = '100%';

  // Merge gap: prefer child's gap (inner layout concern)
  if (!child.styles.gap && !child.styles.gapToken && (updatedNode.styles.gap || updatedNode.styles.gapToken)) {
    mergedStyles.gap = updatedNode.styles.gap;
    mergedStyles.gapToken = updatedNode.styles.gapToken;
  }

  // Merge opacity: multiply
  mergedStyles.opacity = updatedNode.styles.opacity * child.styles.opacity;

  // Merge shadow: prefer parent shadow (outer)
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
// MATERIAL 3 TYPOGRAPHY RESOLVER
// ---------------------------------------------------------------------------
// Maps `dg-type-*` utility classes to idiomatic Material 3 typography styles.
// Returns undefined if no matching class is found, allowing fallback to
// explicit fontSize/fontWeight values.
// ---------------------------------------------------------------------------

const DG_TYPE_TO_M3: Record<string, string> = {
  'screen-title': 'headlineLarge',
  'screen_title': 'headlineLarge',
  'section-title': 'titleLarge',
  'section_title': 'titleLarge',
  'card-title': 'titleMedium',
  'card_title': 'titleMedium',
  'body': 'bodyLarge',
  'caption': 'bodyMedium',
  'metadata': 'labelSmall',
  'label': 'labelMedium',
  'overline': 'labelSmall',
  'subtitle': 'titleSmall',
  'heading': 'headlineMedium',
  'display': 'displaySmall',
};

function resolveComposeTypography(classes: string[]): string | undefined {
  for (const cls of classes) {
    if (cls.startsWith('dg-type-')) {
      const typeKey = cls.substring(8); // e.g. 'screen-title'
      const m3Style = DG_TYPE_TO_M3[typeKey] || DG_TYPE_TO_M3[typeKey.replace(/-/g, '_')];
      if (m3Style) {
        return `MaterialTheme.typography.${m3Style}`;
      }
    }
  }
  return undefined;
}

export function toComposeThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "bgPrimary") return "AppTheme.BackgroundPrimary";
  if (token === "bgSecondary") return "AppTheme.BackgroundSecondary";
  if (token === "borderDivider") return "AppTheme.BorderDivider";
  if (token === "actionPrimary") return "AppTheme.ActionPrimary";
  if (token === "actionOnPrimary") return "AppTheme.ActionOnPrimary";
  if (token === "textHigh") return "AppTheme.TextHigh";
  if (token === "textMedium") return "AppTheme.TextMedium";
  if (token === "textLow") return "AppTheme.TextLow";
  
  // Convert camelCase to PascalCase for AppTheme fields (e.g. borderRadiusApp, screenPadding)
  const pascal = token.charAt(0).toUpperCase() + token.slice(1);
  return `AppTheme.${pascal}`;
}

// Structured Compose modifier builder
interface ComposeModifier {
  type: 'size' | 'weight' | 'clip' | 'background' | 'border' | 'padding' | 'offset' | 'alignment' | 'alpha' | 'shadow';
  code: string;
}

function buildComposeModifiers(modifiers: ComposeModifier[]): string {
  const order = {
    size: 1,
    weight: 2,
    shadow: 3,
    clip: 4,
    background: 5,
    border: 6,
    padding: 7,
    offset: 8,
    alignment: 9,
    alpha: 10
  };

  const sorted = [...modifiers].sort((a, b) => {
    return (order[a.type] || 99) - (order[b.type] || 99);
  });

  if (sorted.length === 0) return "Modifier";
  return "Modifier" + sorted.map(m => `\n        ${m.code}`).join('');
}

// Post-processing string sanitizer
function sanitizeComposeCode(code: string): string {
  return code
    .replace(/\.background\(Color\.Transparent\)/g, "")
    .replace(/\.background\(Color\(0x00000000\)\)/g, "");
}

export function transpileToCompose(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "    ".repeat(indentLevel);

  function walk(node: TranspileNode | string, parentIsFixedBottomRow = false, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}Text(text = "${node.replace(/"/g, '\\"')}")\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentIsFixedBottomRow, parentStyles);
    }

    const { styles } = node;
    const isButton = node.tagName === "button" || node.tagName === "a";
    const isImage = node.tagName === "img";
    const lucide = node.attributes["data-lucide"] || node.attributes["data-drawgle-icon"];
    
    // ---------------------------------------------------------
    // SEMANTIC PATTERNS RESOLUTION
    // ---------------------------------------------------------
    
    // Pattern 1: Divider
    if (node.pattern?.type === 'divider') {
      const isVertical = node.pattern.metadata.orientation === 'vertical';
      const borderCol = styles.borderColorToken 
        ? toComposeThemeToken(styles.borderColorToken, '') 
        : (styles.backgroundColor && styles.backgroundColor !== "transparent" 
            ? toComposeColor(styles.backgroundColor) 
            : toComposeColor(styles.borderColor));
            
      const divModifiers: ComposeModifier[] = [];
      
      const pt = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.dp`;
      const pb = styles.paddingBottomToken ? toComposeThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.dp`;
      const pl = styles.paddingLeftToken ? toComposeThemeToken(styles.paddingLeftToken, "") : `${styles.padding.left}.dp`;
      const pr = styles.paddingRightToken ? toComposeThemeToken(styles.paddingRightToken, "") : `${styles.padding.right}.dp`;
      
      if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0 ||
          styles.paddingTopToken || styles.paddingBottomToken || styles.paddingLeftToken || styles.paddingRightToken) {
        divModifiers.push({ type: 'padding', code: `.padding(start = ${pl}, top = ${pt}, end = ${pr}, bottom = ${pb})` });
      }
      
      const mt = styles.marginTopToken ? toComposeThemeToken(styles.marginTopToken, "") : `${styles.margin.top}.dp`;
      const mb = styles.marginBottomToken ? toComposeThemeToken(styles.marginBottomToken, "") : `${styles.margin.bottom}.dp`;
      if (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.marginTopToken || styles.marginBottomToken) {
        divModifiers.push({ type: 'padding', code: `.padding(top = ${mt}, bottom = ${mb})` });
      }

      if (isVertical) {
        divModifiers.push({ type: 'size', code: `.fillMaxHeight().width(1.dp)` });
        return `${getIndent()}VerticalDivider(\n${getIndent()}    modifier = ${buildComposeModifiers(divModifiers)},\n${getIndent()}    color = ${borderCol}\n${getIndent()})\n`;
      } else {
        divModifiers.push({ type: 'size', code: `.fillMaxWidth().height(1.dp)` });
        return `${getIndent()}HorizontalDivider(\n${getIndent()}    modifier = ${buildComposeModifiers(divModifiers)},\n${getIndent()}    color = ${borderCol}\n${getIndent()})\n`;
      }
    }

    // Pattern 2: Status Dot
    if (node.pattern?.type === 'status-dot') {
      const { size, color, colorToken } = node.pattern.metadata;
      const fillCol = colorToken ? toComposeThemeToken(colorToken, "") : toComposeColor(color);
      
      const dotModifiers: ComposeModifier[] = [];
      dotModifiers.push({ type: 'size', code: `.size(${size}.dp)` });
      dotModifiers.push({ type: 'background', code: `.background(color = ${fillCol}, shape = CircleShape)` });
      
      if (styles.opacity < 1) {
        dotModifiers.push({ type: 'alpha', code: `.alpha(${styles.opacity}f)` });
      }
      if (styles.isAbsolute && styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        let offsetPart = "";
        if (left !== undefined || leftToken) offsetPart += `x = ${leftToken ? toComposeThemeToken(leftToken, "") : `${left}.dp`}`;
        else if (right !== undefined || rightToken) offsetPart += `x = -(${rightToken ? toComposeThemeToken(rightToken, "") : `${right}.dp`})`;
        
        if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y = ${topToken ? toComposeThemeToken(topToken, "") : `${top}.dp`}`;
        else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y = -(${bottomToken ? toComposeThemeToken(bottomToken, "") : `${bottom}.dp`})`;
        
        if (offsetPart) {
          dotModifiers.push({ type: 'offset', code: `.offset(${offsetPart})` });
        }
      }

      return `${getIndent()}Spacer(\n${getIndent()}    modifier = ${buildComposeModifiers(dotModifiers)}\n${getIndent()})\n`;
    }

    // Pattern 3: Progress Bar
    if (node.pattern?.type === 'progress-bar') {
      const { value, outerColor, outerColorToken, innerColor, innerColorToken, outerHeight, borderRadius, borderRadiusToken } = node.pattern.metadata;
      const outBg = outerColorToken ? toComposeThemeToken(outerColorToken, "") : toComposeColor(outerColor);
      const inBg = innerColorToken ? toComposeThemeToken(innerColorToken, "") : toComposeColor(innerColor);
      const radius = borderRadiusToken ? toComposeThemeToken(borderRadiusToken, "") : `${borderRadius}.dp`;
      
      const pbModifiers: ComposeModifier[] = [];
      pbModifiers.push({ type: 'size', code: `.fillMaxWidth().height(${outerHeight}.dp)` });
      pbModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${radius}))` });
      
      const pt = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.dp`;
      const pb = styles.paddingBottomToken ? toComposeThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.dp`;
      if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.paddingTopToken || styles.paddingBottomToken) {
        pbModifiers.push({ type: 'padding', code: `.padding(top = ${pt}, bottom = ${pb})` });
      }

      return `${getIndent()}LinearProgressIndicator(\n${getIndent()}    progress = { ${value.toFixed(3)}f },\n${getIndent()}    modifier = ${buildComposeModifiers(pbModifiers)},\n${getIndent()}    color = ${inBg},\n${getIndent()}    trackColor = ${outBg}\n${getIndent()})\n`;
    }

    // Lucide Icon
    if (lucide) {
      const tintColor = styles.textColorToken ? toComposeThemeToken(styles.textColorToken, "") : toComposeColor(styles.textColor);
      let iconCode = `${getIndent()}Icon(\n`;
      iconCode += `${getIndent()}    imageVector = ${toComposeIconName(lucide)}, // Lucide: ${lucide}\n`;
      iconCode += `${getIndent()}    contentDescription = null,\n`;
      iconCode += `${getIndent()}    tint = ${tintColor},\n`;
      
      const iconModifiers: ComposeModifier[] = [];
      iconModifiers.push({ type: 'size', code: `.size(${styles.fontSize || 24}.dp)` });
      if (styles.hasFlex1) {
        iconModifiers.push({ type: 'weight', code: `.weight(1f)` });
      }
      
      iconCode += `${getIndent()}    modifier = ${buildComposeModifiers(iconModifiers)}\n`;
      iconCode += `${getIndent()})\n`;
      return iconCode;
    }

    // Raw SVG placeholder
    if (styles.isRawSvg) {
      const svgW = typeof styles.width === 'number' ? styles.width : 48;
      const svgH = typeof styles.height === 'number' ? styles.height : 48;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let svgOut = `${getIndent()}Box(\n`;
        svgOut += `${getIndent()}    contentAlignment = Alignment.Center,\n`;
        svgOut += `${getIndent()}    modifier = Modifier.size(${svgW}.dp)\n`;
        svgOut += `${getIndent()}) {\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toComposeThemeToken(tokenKey, "") 
            : toComposeColor(resolveColorToStandard(strokeColorStr));
            
          const strokeLinecap = circle.attributes["stroke-linecap"] === "round" ? "StrokeCap.Round" : "StrokeCap.Butt";
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;
          
          let progress = 1.0;
          if (dashArray > 0) {
            progress = 1.0 - (dashOffset / dashArray);
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
          }
          
          svgOut += `${getIndent()}CircularProgressIndicator(\n`;
          svgOut += `${getIndent()}    progress = ${progress.toFixed(2)}f,\n`;
          svgOut += `${getIndent()}    color = ${strokeColor},\n`;
          svgOut += `${getIndent()}    strokeWidth = ${strokeWidth}.dp,\n`;
          svgOut += `${getIndent()}    strokeCap = ${strokeLinecap},\n`;
          svgOut += `${getIndent()}    modifier = Modifier.fillMaxSize()\n`;
          svgOut += `${getIndent()})\n`;
        });
        indentLevel--;
        svgOut += `${getIndent()}}\n`;
        return svgOut;
      }
      
      let out = `${getIndent()}Spacer(modifier = Modifier.size(${svgW}.dp)) // TODO: SVG Placeholder\n`;
      return out;
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      let imgCode = `${getIndent()}AsyncImage(\n`;
      imgCode += `${getIndent()}    model = "${src}",\n`;
      imgCode += `${getIndent()}    contentDescription = null,\n`;
      imgCode += `${getIndent()}    contentScale = ContentScale.Crop,\n`;
      
      const imgModifiers: ComposeModifier[] = [];
      const w = styles.width;
      const h = styles.height;
      if (typeof w === "number") imgModifiers.push({ type: 'size', code: `.width(${w}.dp)` });
      if (typeof h === "number") imgModifiers.push({ type: 'size', code: `.height(${h}.dp)` });
      if (styles.borderRadiusToken) {
        imgModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")}))` });
      } else if (styles.borderRadius > 0) {
        imgModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${styles.borderRadius}.dp))` });
      }
      if (styles.opacity < 1) {
        imgModifiers.push({ type: 'alpha', code: `.alpha(${styles.opacity}f)` });
      }
      
      imgCode += `${getIndent()}    modifier = ${buildComposeModifiers(imgModifiers)}\n`;
      imgCode += `${getIndent()})\n`;
      return imgCode;
    }

    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toComposeThemeToken(styles.backgroundColorToken, "") : `Color(0xFF${cleanHexColor(styles.backgroundColor)})`;
      const btnShape = styles.borderRadiusToken ? `RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")})` : `RoundedCornerShape(${(styles.borderRadius || 12)}.dp)`;
      const paddingX = styles.paddingLeftToken ? toComposeThemeToken(styles.paddingLeftToken, "") : `${(styles.padding.left || 16)}.dp`;
      const paddingY = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, "") : `${(styles.padding.top || 12)}.dp`;
      
      let btnCode = `${getIndent()}Button(\n`;
      btnCode += `${getIndent()}    onClick = { /* Action */ },\n`;
      btnCode += `${getIndent()}    colors = ButtonDefaults.buttonColors(containerColor = ${containerColor}),\n`;
      btnCode += `${getIndent()}    shape = ${btnShape},\n`;
      btnCode += `${getIndent()}    contentPadding = PaddingValues(horizontal = ${paddingX}, vertical = ${paddingY}),\n`;
      
      const btnModifiers: ComposeModifier[] = [];
      if (styles.opacity < 1) {
        btnModifiers.push({ type: 'alpha', code: `.alpha(${styles.opacity}f)` });
      }
      if (styles.hasFlex1) {
        btnModifiers.push({ type: 'weight', code: `.weight(1f)` });
      }
      
      btnCode += `${getIndent()}    modifier = ${buildComposeModifiers(btnModifiers)}\n`;
      btnCode += `${getIndent()}) {\n`;
      indentLevel++;
      
      const btnGap = styles.gapToken ? toComposeThemeToken(styles.gapToken, "") : `${(styles.gap || 8)}.dp`;
      btnCode += `${getIndent()}Row(\n`;
      btnCode += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${btnGap}),\n`;
      btnCode += `${getIndent()}    verticalAlignment = Alignment.CenterVertically\n`;
      btnCode += `${getIndent()}) {\n`;
      indentLevel++;
      
      node.children.forEach(c => {
        btnCode += walk(c, parentIsFixedBottomRow, styles);
      });
      
      indentLevel--;
      btnCode += `${getIndent()}}\n`;
      indentLevel--;
      btnCode += `${getIndent()}}\n`;
      return btnCode;
    }

    // Text Leaf
    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";
    
    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      const textTint = styles.textColorToken ? toComposeThemeToken(styles.textColorToken, "") : toComposeColor(styles.textColor);
      
      // Resolve Material 3 typography style from dg-type-* class on this node
      const m3Style = resolveComposeTypography(node.classes);
      
      let textCode = `${getIndent()}Text(\n`;
      textCode += `${getIndent()}    text = "${textVal.replace(/"/g, '\\"')}",\n`;
      
      if (m3Style) {
        // Use M3 semantic style — explicit overrides appended via .copy()
        const overrides: string[] = [];
        if (textTint && textTint !== "Color.Transparent") {
          overrides.push(`color = ${textTint}`);
        }
        if (styles.textAlign !== undefined) {
          const align = styles.textAlign === "center" ? "TextAlign.Center" : styles.textAlign === "right" ? "TextAlign.End" : "TextAlign.Start";
          overrides.push(`textAlign = ${align}`);
        }
        if (overrides.length > 0) {
          textCode += `${getIndent()}    style = ${m3Style}.copy(${overrides.join(', ')}),\n`;
        } else {
          textCode += `${getIndent()}    style = ${m3Style},\n`;
        }
      } else {
        // Fallback: explicit fontSize/fontWeight for non-dg-type text
        if (styles.fontSize !== undefined) {
          textCode += `${getIndent()}    fontSize = ${styles.fontSize}.sp,\n`;
        }
        if (textTint && textTint !== "Color.Transparent") {
          textCode += `${getIndent()}    color = ${textTint},\n`;
        }
        if (styles.fontWeight !== undefined) {
          if (styles.fontWeight === "heavy" || styles.fontWeight === "bold") {
            textCode += `${getIndent()}    fontWeight = FontWeight.Bold,\n`;
          } else if (styles.fontWeight === "semibold" || styles.fontWeight === "medium") {
            textCode += `${getIndent()}    fontWeight = FontWeight.Medium,\n`;
          } else {
            textCode += `${getIndent()}    fontWeight = FontWeight.Normal,\n`;
          }
        }
        if (styles.textAlign !== undefined) {
          const align = styles.textAlign === "center" ? "TextAlign.Center" : styles.textAlign === "right" ? "TextAlign.End" : "TextAlign.Start";
          textCode += `${getIndent()}    textAlign = ${align},\n`;
        }
      }
      
      const textModifiers: ComposeModifier[] = [];
      const mt = styles.marginTopToken ? toComposeThemeToken(styles.marginTopToken, "") : `${styles.margin.top}.dp`;
      const mb = styles.marginBottomToken ? toComposeThemeToken(styles.marginBottomToken, "") : `${styles.margin.bottom}.dp`;
      if (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.marginTopToken || styles.marginBottomToken) {
        textModifiers.push({ type: 'padding', code: `.padding(top = ${mt}, bottom = ${mb})` });
      }
      if (styles.opacity < 1) {
        textModifiers.push({ type: 'alpha', code: `.alpha(${styles.opacity}f)` });
      }
      if (styles.hasFlex1) {
        textModifiers.push({ type: 'weight', code: `.weight(1f)` });
      }
      
      textCode += `${getIndent()}    modifier = ${buildComposeModifiers(textModifiers)}\n`;
      textCode += `${getIndent()})\n`;
      return textCode;
    }

    // Grid Layout — Static Column/Row/Box layout (no LazyVerticalGrid)
    // Generates crash-safe, non-scrollable grid for static template screens.
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toComposeThemeToken(styles.gapToken, '') : `${styles.gap}.dp`;
      const cols = styles.gridCols;

      // Build container modifiers (no hardcoded height — intrinsic sizing)
      const gridModifiers: ComposeModifier[] = [];
      if (styles.width === '100%' || styles.hasFlex1) {
        gridModifiers.push({ type: 'size', code: `.fillMaxWidth()` });
      }

      // Shadow
      if (styles.shadow) {
        let shape = "RectangleShape";
        if (styles.borderRadiusToken) {
          shape = `RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")})`;
        } else if (styles.borderRadius > 0) {
          shape = `RoundedCornerShape(${styles.borderRadius}.dp)`;
        }
        if (styles.shadow === "surface") {
          gridModifiers.push({ type: 'shadow', code: `.shadow(elevation = 8.dp, shape = ${shape})` });
        } else if (styles.shadow === "overlay") {
          gridModifiers.push({ type: 'shadow', code: `.shadow(elevation = 16.dp, shape = ${shape})` });
        }
      }

      if (styles.borderRadiusToken) {
        gridModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")}))` });
      } else if (styles.borderRadius > 0) {
        gridModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${styles.borderRadius}.dp))` });
      }

      if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
        const { start, end } = gradientDirectionToCompose(styles.gradient.direction);
        gridModifiers.push({ type: 'background', code: `.background(Brush.linearGradient(colors = listOf(${toComposeColor(styles.gradient.fromColor)}, ${toComposeColor(styles.gradient.toColor)}), start = ${start}, end = ${end}))` });
      } else {
        const identicalBg = hasIdenticalBackground(styles, parentStyles);
        if (!identicalBg) {
          if (styles.backgroundColorToken) {
            gridModifiers.push({ type: 'background', code: `.background(${toComposeThemeToken(styles.backgroundColorToken, "")})` });
          } else if (styles.backgroundColor !== "transparent") {
            gridModifiers.push({ type: 'background', code: `.background(${toComposeColor(styles.backgroundColor)})` });
          }
        }
      }

      // Padding
      const gPt = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, '') : `${styles.padding.top}.dp`;
      const gPb = styles.paddingBottomToken ? toComposeThemeToken(styles.paddingBottomToken, '') : `${styles.padding.bottom}.dp`;
      const gPl = styles.paddingLeftToken ? toComposeThemeToken(styles.paddingLeftToken, '') : `${styles.padding.left}.dp`;
      const gPr = styles.paddingRightToken ? toComposeThemeToken(styles.paddingRightToken, '') : `${styles.padding.right}.dp`;
      if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0 ||
          styles.paddingTopToken || styles.paddingBottomToken || styles.paddingLeftToken || styles.paddingRightToken) {
        gridModifiers.push({ type: 'padding', code: `.padding(start = ${gPl}, top = ${gPt}, end = ${gPr}, bottom = ${gPb})` });
      }

      // Build static grid: Column containing Rows, each Row containing weighted Boxes
      const gridChildren = node.children.filter(c => typeof c !== 'string') as TranspileNode[];
      const rows: (TranspileNode | null)[][] = [];
      for (let i = 0; i < gridChildren.length; i += cols) {
        const row: (TranspileNode | null)[] = gridChildren.slice(i, i + cols);
        // Pad last row with null spacers if needed
        while (row.length < cols) {
          row.push(null);
        }
        rows.push(row);
      }

      let gridCode = `${getIndent()}Column(\n`;
      gridCode += `${getIndent()}    modifier = ${buildComposeModifiers(gridModifiers)},\n`;
      gridCode += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${spacing})\n`;
      gridCode += `${getIndent()}) {\n`;
      indentLevel++;

      rows.forEach(row => {
        gridCode += `${getIndent()}Row(\n`;
        gridCode += `${getIndent()}    modifier = Modifier.fillMaxWidth(),\n`;
        gridCode += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${spacing})\n`;
        gridCode += `${getIndent()}) {\n`;
        indentLevel++;

        row.forEach(cell => {
          if (cell === null) {
            // Empty spacer to maintain grid alignment
            gridCode += `${getIndent()}Spacer(modifier = Modifier.weight(1f))\n`;
          } else {
            gridCode += `${getIndent()}Box(modifier = Modifier.weight(1f)) {\n`;
            indentLevel++;
            gridCode += walk(cell, parentIsFixedBottomRow, styles);
            indentLevel--;
            gridCode += `${getIndent()}}\n`;
          }
        });

        indentLevel--;
        gridCode += `${getIndent()}}\n`;
      });

      indentLevel--;
      gridCode += `${getIndent()}}\n`;
      return gridCode;
    }

    // Standard Stack Layout (Column / Row)
    let isCol = styles.flexDirection === "column";
    if (parentIsFixedBottomRow) {
      isCol = false;
    }
    const composeLayout = isCol ? "Column" : "Row";
    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;

    const stackModifiers: ComposeModifier[] = [];
    
    // Size constraints
    const w = styles.width;
    const h = styles.height;
    if (w === "100%" || styles.hasFlex1) stackModifiers.push({ type: 'size', code: `.fillMaxWidth()` });
    else if (typeof w === "number") stackModifiers.push({ type: 'size', code: `.width(${w}.dp)` });
    if (typeof h === "number") stackModifiers.push({ type: 'size', code: `.height(${h}.dp)` });
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) {
      stackModifiers.push({ type: 'size', code: `.heightIn(min = ${styles.minHeight}.dp)` });
    }
    
    if (styles.hasFlex1 && !styles.isAbsolute) {
      stackModifiers.push({ type: 'weight', code: `.weight(1f)` });
    }

    // Shadow
    if (styles.shadow) {
      let shape = "RectangleShape";
      if (styles.borderRadiusToken) {
        shape = `RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")})`;
      } else if (styles.borderRadius > 0) {
        shape = `RoundedCornerShape(${styles.borderRadius}.dp)`;
      }
      if (styles.shadow === "surface") {
        stackModifiers.push({ type: 'shadow', code: `.shadow(elevation = 8.dp, shape = ${shape})` });
      } else if (styles.shadow === "overlay") {
        stackModifiers.push({ type: 'shadow', code: `.shadow(elevation = 16.dp, shape = ${shape})` });
      }
    }

    // Border clipping & rounding
    if (styles.borderRadiusToken) {
      stackModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${toComposeThemeToken(styles.borderRadiusToken, "")}))` });
    } else if (styles.borderRadius > 0) {
      stackModifiers.push({ type: 'clip', code: `.clip(RoundedCornerShape(${styles.borderRadius}.dp))` });
    }

    // Background
    if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
      const { start, end } = gradientDirectionToCompose(styles.gradient.direction);
      stackModifiers.push({ type: 'background', code: `.background(Brush.linearGradient(colors = listOf(${toComposeColor(styles.gradient.fromColor)}, ${toComposeColor(styles.gradient.toColor)}), start = ${start}, end = ${end}))` });
    } else {
      const identicalBg = hasIdenticalBackground(styles, parentStyles);
      if (!identicalBg) {
        if (styles.backgroundColorToken) {
          stackModifiers.push({ type: 'background', code: `.background(${toComposeThemeToken(styles.backgroundColorToken, "")})` });
        } else if (styles.backgroundColor !== "transparent") {
          stackModifiers.push({ type: 'background', code: `.background(${toComposeColor(styles.backgroundColor)})` });
        }
      }
    }

    // Border overlay
    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toComposeThemeToken(styles.borderColorToken, '') : toComposeColor(styles.borderColor);
      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        const radius = styles.borderRadiusToken ? toComposeThemeToken(styles.borderRadiusToken, '') : `${styles.borderRadius}.dp`;
        stackModifiers.push({ type: 'border', code: `.border(${styles.borderWidth}.dp, ${borderCol}, RoundedCornerShape(${radius}))` });
      }
    }

    if (styles.opacity < 1) {
      stackModifiers.push({ type: 'alpha', code: `.alpha(${styles.opacity}f)` });
    }

    // Padding
    const pt = styles.paddingTopToken ? toComposeThemeToken(styles.paddingTopToken, "") : `${styles.padding.top}.dp`;
    const pb = styles.paddingBottomToken ? toComposeThemeToken(styles.paddingBottomToken, "") : `${styles.padding.bottom}.dp`;
    const pl = styles.paddingLeftToken ? toComposeThemeToken(styles.paddingLeftToken, "") : `${styles.padding.left}.dp`;
    const pr = styles.paddingRightToken ? toComposeThemeToken(styles.paddingRightToken, "") : `${styles.padding.right}.dp`;

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      stackModifiers.push({ type: 'padding', code: `.padding(start = AppTheme.ScreenPadding, top = ${pt}, end = AppTheme.ScreenPadding, bottom = ${pb})` });
    } else if (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0 ||
               styles.paddingTopToken || styles.paddingBottomToken || styles.paddingLeftToken || styles.paddingRightToken) {
      stackModifiers.push({ type: 'padding', code: `.padding(start = ${pl}, top = ${pt}, end = ${pr}, bottom = ${pb})` });
    }

    // Absolute Offset
    if (styles.isAbsolute && styles.absolutePosition) {
      const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
      let offsetPart = "";
      if (left !== undefined || leftToken) offsetPart += `x = ${leftToken ? toComposeThemeToken(leftToken, "") : `${left}.dp`}`;
      else if (right !== undefined || rightToken) offsetPart += `x = -(${rightToken ? toComposeThemeToken(rightToken, "") : `${right}.dp`})`;
      
      if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y = ${topToken ? toComposeThemeToken(topToken, "") : `${top}.dp`}`;
      else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y = -(${bottomToken ? toComposeThemeToken(bottomToken, "") : `${bottom}.dp`})`;
      
      if (offsetPart) {
        stackModifiers.push({ type: 'offset', code: `.offset(${offsetPart})` });
      }
    }

    if (styles.isFixedBottom) {
      stackModifiers.push({ type: 'alignment', code: `.align(Alignment.BottomCenter).fillMaxWidth()` });
    }

    const isCurrentFixedBottomRow = styles.isFixedBottom && styles.flexDirection === "row";
    let out = "";
    const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
    const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

    if (hasAbsolute) {
      out += `${getIndent()}Box(\n`;
      out += `${getIndent()}    modifier = ${buildComposeModifiers(stackModifiers)}\n`;
      out += `${getIndent()}) {\n`;
      indentLevel++;
      
      bgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });

      out += `${getIndent()}${composeLayout}(\n`;
      out += `${getIndent()}    modifier = Modifier.fillMaxSize(),\n`;
      
      const gapVal = styles.gapToken ? toComposeThemeToken(styles.gapToken, "") : `${styles.gap}.dp`;
      if (isCol) {
        const align = styles.alignItems === "center" ? "Alignment.CenterHorizontally" : styles.alignItems === "end" ? "Alignment.End" : "Alignment.Start";
        out += `${getIndent()}    horizontalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    verticalArrangement = Arrangement.SpaceBetween\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${gapVal})\n`;
        } else {
          out += `${getIndent()}    verticalArrangement = Arrangement.Top\n`;
        }
      } else {
        const align = styles.alignItems === "start" ? "Alignment.Top" : styles.alignItems === "end" ? "Alignment.Bottom" : "Alignment.CenterVertically";
        out += `${getIndent()}    verticalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    horizontalArrangement = Arrangement.SpaceBetween\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${gapVal})\n`;
        } else {
          out += `${getIndent()}    horizontalArrangement = Arrangement.Start\n`;
        }
      }
      
      out += `${getIndent()}) {\n`;
      indentLevel++;
      
      normalChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });
      
      indentLevel--;
      out += `${getIndent()}}\n`;

      fgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });
      
      indentLevel--;
      out += `${getIndent()}}\n`;
    } else {
      out += `${getIndent()}${composeLayout}(\n`;
      out += `${getIndent()}    modifier = ${buildComposeModifiers(stackModifiers)},\n`;
      
      const gapVal = styles.gapToken ? toComposeThemeToken(styles.gapToken, "") : `${styles.gap}.dp`;
      if (isCol) {
        const align = styles.alignItems === "center" ? "Alignment.CenterHorizontally" : styles.alignItems === "end" ? "Alignment.End" : "Alignment.Start";
        out += `${getIndent()}    horizontalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    verticalArrangement = Arrangement.SpaceBetween\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${gapVal})\n`;
        } else {
          out += `${getIndent()}    verticalArrangement = Arrangement.Top\n`;
        }
      } else {
        const align = styles.alignItems === "start" ? "Alignment.Top" : styles.alignItems === "end" ? "Alignment.Bottom" : "Alignment.CenterVertically";
        out += `${getIndent()}    verticalAlignment = ${align},\n`;
        if (styles.justifyContent === "between") {
          out += `${getIndent()}    horizontalArrangement = Arrangement.SpaceBetween\n`;
        } else if (styles.gap > 0 || styles.gapToken) {
          out += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${gapVal})\n`;
        } else {
          out += `${getIndent()}    horizontalArrangement = Arrangement.Start\n`;
        }
      }
      
      out += `${getIndent()}) {\n`;
      indentLevel++;
      
      normalChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
      });
      
      indentLevel--;
      out += `${getIndent()}}\n`;
    }

    return out;
  }

  // Pre-pass: collapse redundant single-child layout wrappers
  const collapsedRoot = collapseComposeTree(root);
  const rawCompose = walk(collapsedRoot);
  return sanitizeComposeCode(rawCompose);
}

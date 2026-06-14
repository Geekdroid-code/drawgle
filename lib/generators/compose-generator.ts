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
  type: 'size' | 'weight' | 'clip' | 'background' | 'border' | 'padding' | 'offset' | 'alignment' | 'alpha';
  code: string;
}

function buildComposeModifiers(modifiers: ComposeModifier[]): string {
  const order = {
    size: 1,
    weight: 2,
    clip: 3,
    background: 4,
    border: 5,
    padding: 6,
    offset: 7,
    alignment: 8,
    alpha: 9
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
      
      let textCode = `${getIndent()}Text(\n`;
      textCode += `${getIndent()}    text = "${textVal.replace(/"/g, '\\"')}",\n`;
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

    // Grid Layout
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toComposeThemeToken(styles.gapToken, '') : `${styles.gap}.dp`;
      let gridCode = `${getIndent()}LazyVerticalGrid(\n`;
      gridCode += `${getIndent()}    columns = GridCells.Fixed(${styles.gridCols}),\n`;
      gridCode += `${getIndent()}    horizontalArrangement = Arrangement.spacedBy(${spacing}),\n`;
      gridCode += `${getIndent()}    verticalArrangement = Arrangement.spacedBy(${spacing}),\n`;
      
      const gridModifiers: ComposeModifier[] = [];
      gridModifiers.push({ type: 'size', code: `.height(280.dp)` }); // Standard height limit for nested Grid to avoid infinite height crash
      
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
      
      gridCode += `${getIndent()}    modifier = ${buildComposeModifiers(gridModifiers)}\n`;
      gridCode += `${getIndent()}) {\n`;
      indentLevel++;
      
      node.children.forEach(c => {
        gridCode += `${getIndent()}item {\n`;
        indentLevel++;
        gridCode += walk(c, parentIsFixedBottomRow, styles);
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

  const rawCompose = walk(root);
  return sanitizeComposeCode(rawCompose);
}

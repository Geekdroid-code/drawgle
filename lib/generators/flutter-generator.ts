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

export function toFlutterThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  if (token === "bgPrimary") return "AppTheme.backgroundPrimary";
  if (token === "bgSecondary") return "AppTheme.backgroundSecondary";
  return `AppTheme.${token}`;
}

// Post-processing string sanitizer
function sanitizeFlutterCode(code: string): string {
  return code
    .replace(/color:\s*Colors\.transparent,?\n/g, "")
    .replace(/,\s*\n\s*\),\n/g, "\n    ),\n")
    .replace(/,\s*\),\n\s*\)/g, "),\n)");
}

export function transpileToFlutter(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "  ".repeat(indentLevel);

  function wrapExpandedIfNeeded(node: TranspileNode, outCode: string, indent: string): string {
    if (node.styles.hasFlex1 && !node.styles.isAbsolute) {
      return `${indent}Expanded(\n` +
             `${indent}  child: ${outCode.trim()},\n` +
             `${indent})\n`;
    }
    return outCode;
  }

  function walk(node: TranspileNode | string, parentIsFixedBottomRow = false, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}Text('${node.replace(/'/g, "\\'")}')\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentIsFixedBottomRow, parentStyles);
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
      return wrapExpandedIfNeeded(node, divCode, getIndent());
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
      
      return wrapExpandedIfNeeded(node, dotCode, getIndent());
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
      
      return wrapExpandedIfNeeded(node, pbCode, getIndent());
    }

    // Lucide Icon
    if (lucide) {
      const tintColor = styles.textColorToken ? toFlutterThemeToken(styles.textColorToken, "") : toFlutterColor(styles.textColor);
      let outCode = `${getIndent()}Icon(${toFlutterIconName(lucide)}, size: ${styles.fontSize || 24}.0, color: ${tintColor})\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent());
    }

    // Raw SVG placeholder
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
        return wrapExpandedIfNeeded(node, svgOut, getIndent());
      }
      
      let outCode = `${getIndent()}SizedBox(width: ${svgW}.0, height: ${svgH}.0) // TODO: Add custom SVG/Asset\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent());
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      const rad = styles.borderRadiusToken ? toFlutterThemeToken(styles.borderRadiusToken, "") : `${(styles.borderRadius || 0)}.0`;
      let outCode = `${getIndent()}ClipRRect(\n`;
      outCode += `${getIndent()}  borderRadius: BorderRadius.circular(${rad}),\n`;
      outCode += `${getIndent()}  child: Image.network(\n`;
      outCode += `${getIndent()}    '${src}',\n`;
      if (typeof styles.width === "number") outCode += `${getIndent()}    width: ${styles.width}.0,\n`;
      if (typeof styles.height === "number") outCode += `${getIndent()}    height: ${styles.height}.0,\n`;
      outCode += `${getIndent()}    fit: BoxFit.cover,\n`;
      outCode += `${getIndent()}  ),\n`;
      outCode += `${getIndent()})\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent());
    }

    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toFlutterThemeToken(styles.backgroundColorToken, "") : toFlutterColor(styles.backgroundColor);
      const btnRadius = styles.borderRadiusToken ? toFlutterThemeToken(styles.borderRadiusToken, "") : `${(styles.borderRadius || 12)}.0`;
      const paddingX = styles.paddingLeftToken ? toFlutterThemeToken(styles.paddingLeftToken, "") : `${(styles.padding.left || 16)}.0`;
      const paddingY = styles.paddingTopToken ? toFlutterThemeToken(styles.paddingTopToken, "") : `${(styles.padding.top || 12)}.0`;

      let outCode = `${getIndent()}ElevatedButton(\n`;
      outCode += `${getIndent()}  onPressed: () {},\n`;
      outCode += `${getIndent()}  style: ElevatedButton.styleFrom(\n`;
      outCode += `${getIndent()}    backgroundColor: ${containerColor},\n`;
      outCode += `${getIndent()}    shape: RoundedRectangleBorder(\n`;
      outCode += `${getIndent()}      borderRadius: BorderRadius.circular(${btnRadius}),\n`;
      outCode += `${getIndent()}    ),\n`;
      outCode += `${getIndent()}    padding: EdgeInsets.symmetric(horizontal: ${paddingX}, vertical: ${paddingY}),\n`;
      outCode += `${getIndent()}  ),\n`;
      outCode += `${getIndent()}  child: Row(\n`;
      outCode += `${getIndent()}    mainAxisSize: MainAxisSize.min,\n`;
      outCode += `${getIndent()}    children: [\n`;
      indentLevel += 3;
      node.children.forEach((c, idx) => {
        outCode += walk(c, parentIsFixedBottomRow, styles);
        if (idx < node.children.length - 1) {
          outCode = outCode.trimEnd() + ",\n";
          const btnGap = styles.gapToken ? toFlutterThemeToken(styles.gapToken, "") : `${(styles.gap || 8)}.0`;
          outCode += `${getIndent()}SizedBox(width: ${btnGap}),\n`;
        }
      });
      indentLevel -= 3;
      outCode += `${getIndent()}    ],\n`;
      outCode += `${getIndent()}  ),\n`;
      outCode += `${getIndent()})\n`;
      return wrapExpandedIfNeeded(node, outCode, getIndent());
    }

    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";

    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      let textOut = `${getIndent()}Text(\n`;
      textOut += `${getIndent()}  '${textVal.replace(/'/g, "\\'")}',\n`;
      
      let hasStyle = (styles.fontSize !== undefined) || 
                     (styles.textColorToken !== undefined || (styles.textColor && styles.textColor !== "transparent")) ||
                     (styles.fontWeight !== undefined);

      if (hasStyle) {
        textOut += `${getIndent()}  style: TextStyle(\n`;
        if (styles.fontSize !== undefined) {
          textOut += `${getIndent()}    fontSize: ${styles.fontSize}.0,\n`;
        }
        if (styles.textColorToken || (styles.textColor && styles.textColor !== "transparent")) {
          const textTint = styles.textColorToken ? toFlutterThemeToken(styles.textColorToken, "") : toFlutterColor(styles.textColor);
          textOut += `${getIndent()}    color: ${textTint},\n`;
        }
        if (styles.fontWeight !== undefined) {
          if (styles.fontWeight === "heavy") {
            textOut += `${getIndent()}    fontWeight: FontWeight.w800,\n`;
          } else if (styles.fontWeight === "bold") {
            textOut += `${getIndent()}    fontWeight: FontWeight.bold,\n`;
          } else if (styles.fontWeight === "semibold") {
            textOut += `${getIndent()}    fontWeight: FontWeight.w600,\n`;
          } else if (styles.fontWeight === "medium") {
            textOut += `${getIndent()}    fontWeight: FontWeight.w500,\n`;
          } else {
            textOut += `${getIndent()}    fontWeight: FontWeight.normal,\n`;
          }
        }
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
      return wrapExpandedIfNeeded(node, textOut, getIndent());
    }

    // Grid Layout
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toFlutterThemeToken(styles.gapToken, '') : `${styles.gap}.0`;
      const useWrap = styles.gridCols >= 4;
      let gridOut = "";
      
      if (useWrap) {
        gridOut += `${getIndent()}Wrap(\n`;
        gridOut += `${getIndent()}  spacing: ${spacing},\n`;
        gridOut += `${getIndent()}  runSpacing: ${spacing},\n`;
        gridOut += `${getIndent()}  children: [\n`;
        indentLevel += 2;
        node.children.forEach((c, idx) => {
          gridOut += walk(c, false, styles);
          if (idx < node.children.length - 1) gridOut = gridOut.trimEnd() + ",\n";
        });
        indentLevel -= 2;
        gridOut += `${getIndent()}  ],\n`;
        gridOut += `${getIndent()})\n`;
      } else {
        gridOut += `${getIndent()}GridView.count(\n`;
        gridOut += `${getIndent()}  crossAxisCount: ${styles.gridCols},\n`;
        gridOut += `${getIndent()}  crossAxisSpacing: ${spacing},\n`;
        gridOut += `${getIndent()}  mainAxisSpacing: ${spacing},\n`;
        gridOut += `${getIndent()}  shrinkWrap: true,\n`;
        gridOut += `${getIndent()}  physics: NeverScrollableScrollPhysics(),\n`;
        gridOut += `${getIndent()}  children: [\n`;
        indentLevel += 2;
        node.children.forEach((c, idx) => {
          gridOut += walk(c, false, styles);
          if (idx < node.children.length - 1) gridOut = gridOut.trimEnd() + ",\n";
        });
        indentLevel -= 2;
        gridOut += `${getIndent()}  ],\n`;
        gridOut += `${getIndent()})\n`;
      }
      return wrapExpandedIfNeeded(node, gridOut, getIndent());
    }

    // Standard Stack Container
    let isCol = styles.flexDirection === "column";
    if (parentIsFixedBottomRow && !isButton && !isImage && !lucide && !styles.isRawSvg && !isTextLeaf && !styles.isGrid) {
      isCol = false;
    }
    const widgetName = isCol ? "Column" : "Row";
    
    let containerWrap = false;
    let decoration = "";
    const identicalBg = hasIdenticalBackground(styles, parentStyles);
    const hasBg = (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) ||
                  (!identicalBg && (styles.backgroundColorToken || styles.backgroundColor !== "transparent"));

    if (hasBg ||
        styles.borderRadiusToken || styles.borderRadius > 0 || 
        styles.borderColorToken || styles.borderWidth > 0) {
      containerWrap = true;
      decoration += `    decoration: BoxDecoration(\n`;

      if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
        const { begin, end } = gradientDirectionToFlutter(styles.gradient.direction);
        decoration += `      gradient: LinearGradient(\n`;
        decoration += `        begin: ${begin},\n`;
        decoration += `        end: ${end},\n`;
        decoration += `        colors: [${toFlutterColor(styles.gradient.fromColor)}, ${toFlutterColor(styles.gradient.toColor)}],\n`;
        decoration += `      ),\n`;
      } else if (!identicalBg && styles.backgroundColorToken) {
        decoration += `      color: ${toFlutterThemeToken(styles.backgroundColorToken, "")},\n`;
      } else if (!identicalBg && styles.backgroundColor !== "transparent") {
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
      decoration += `    ),\n`;
    }

    let sizeAttrs = "";
    if (typeof styles.width === "number") sizeAttrs += `    width: ${styles.width}.0,\n`;
    else if (styles.width === "100%" || styles.hasFlex1) sizeAttrs += `    width: double.infinity,\n`;
    if (typeof styles.height === "number") sizeAttrs += `    height: ${styles.height}.0,\n`;
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) {
      sizeAttrs += `    constraints: BoxConstraints(minHeight: ${styles.minHeight}.0),\n`;
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
        innerStackOut += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles);
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
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles).trimEnd() + ",\n";
      });

      if (innerStackOut.trim() !== "") {
        out += innerStackOut.trimEnd() + ",\n";
      }

      fgAbsoluteChildren.forEach(c => {
        out += walk(c, parentIsFixedBottomRow || isCurrentFixedBottomRow, styles).trimEnd() + ",\n";
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
      if (styles.hasFlex1 && !styles.isAbsolute) {
        out = `${getIndent()}Expanded(\n` +
              `${getIndent()}  child: ${out.trim()},\n` +
              `${getIndent()})\n`;
      }
    }

    return out;
  }

  const rawFlutter = walk(root);
  return sanitizeFlutterCode(rawFlutter);
}

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

export function toRNThemeToken(token: string | undefined, fallbackVal: string): string {
  if (!token) return fallbackVal;
  return `AppTheme.colors.${token}`;
}

export function gradientDirectionToRN(direction: string): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const norm = direction.toLowerCase().trim();
  if (norm.includes("to right")) return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
  if (norm.includes("to left")) return { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } };
  if (norm.includes("to bottom")) return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
  if (norm.includes("to top")) return { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } };
  if (norm.includes("to bottom right")) return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
  if (norm.includes("to top left")) return { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } };
  return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
}

// Post-processing string sanitizer
function sanitizeReactNativeCode(code: string): string {
  return code
    .replace(/backgroundColor:\s*'transparent',?\n/g, "")
    .replace(/borderColor:\s*'transparent',?\n/g, "")
    .replace(/,\s*\n\s*\}\}\n/g, "\n  }}\n") // Clean up trailing comma formatting
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

    // Raw SVG placeholder
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
            
          svgOut += `${getIndent()}<View style={{\n`;
          svgOut += `${getIndent()}  width: '100%',\n`;
          svgOut += `${getIndent()}  height: '100%',\n`;
          svgOut += `${getIndent()}  borderWidth: ${strokeWidth},\n`;
          svgOut += `${getIndent()}  borderColor: ${strokeColor},\n`;
          svgOut += `${getIndent()}  borderRadius: ${svgSize / 2},\n`;
          svgOut += `${getIndent()}  position: 'absolute',\n`;
          svgOut += `${getIndent()}}} />\n`;
        });
        indentLevel--;
        svgOut += `${getIndent()}</View>\n`;
        return svgOut;
      }
      
      let out = `${getIndent()}<View style={{ width: ${finalWidth}, height: ${svgSize} }}>{/* TODO: Add custom SVG/Asset */}</View>\n`;
      return out;
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      const altText = node.attributes["alt"] || "";
      let out = `${getIndent()}<Image \n`;
      out += `${getIndent()}  source={{ uri: '${src}' }}\n`;
      out += `${getIndent()}  alt="${altText.replace(/"/g, '\\"')}"\n`;
      
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
          if (typeof styles.height === "number") out += `${getIndent()}    height: ${styles.height},\n`;
        }
      } else if (typeof styles.height === "number") {
        out += `${getIndent()}    height: ${styles.height},\n`;
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

    if (isButton) {
      const containerColor = styles.backgroundColorToken ? toRNThemeToken(styles.backgroundColorToken, "") : `'${styles.backgroundColor}'`;
      const btnRadius = styles.borderRadiusToken ? toRNThemeToken(styles.borderRadiusToken, "") : String(styles.borderRadius || 12);
      const paddingY = styles.paddingTopToken ? toRNThemeToken(styles.paddingTopToken, "") : String(styles.padding.top || 12);
      const paddingX = styles.paddingLeftToken ? toRNThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left || 16);

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
      if (styles.backgroundColorToken || styles.backgroundColor !== "transparent") {
        out += `${getIndent()}    backgroundColor: ${containerColor},\n`;
      }
      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        out += `${getIndent()}    borderRadius: ${btnRadius},\n`;
      }
      out += `${getIndent()}    paddingVertical: ${paddingY},\n`;
      out += `${getIndent()}    paddingHorizontal: ${paddingX},\n`;
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

    // Standard Stack (View)
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
      
      if (styles.backgroundColorToken) {
        out += `${getIndent()}  backgroundColor: ${toRNThemeToken(styles.backgroundColorToken, "")},\n`;
      } else if (styles.backgroundColor !== "transparent") {
        out += `${getIndent()}  backgroundColor: ${toRNColor(styles.backgroundColor)},\n`;
      }

      if (styles.borderRadiusToken) {
        out += `${getIndent()}  borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
      } else if (styles.borderRadius > 0) {
        out += `${getIndent()}  borderRadius: ${styles.borderRadius},\n`;
      }
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
    if (isGridChildOfCols && isGridChildOfCols > 0) {
      out += `${getIndent()}  width: '${widthPercent}',\n`;
    } else {
      if (styles.width === "100%" || styles.hasFlex1) out += `${getIndent()}  ${styles.hasFlex1 ? 'flex: 1' : "width: '100%'"},\n`;
      else if (typeof styles.width === "number") out += `${getIndent()}  width: ${styles.width},\n`;
      if (typeof styles.height === "number") out += `${getIndent()}  height: ${styles.height},\n`;
    }
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) {
      out += `${getIndent()}  minHeight: ${styles.minHeight},\n`;
    }

    // Padding
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

    if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
      // LinearGradient background handled in react-native.tsx typically, here style is passed
    } else {
      const identicalBg = hasIdenticalBackground(styles, parentStyles);
      if (!identicalBg) {
        if (styles.backgroundColorToken) {
          out += `${getIndent()}  backgroundColor: ${toRNThemeToken(styles.backgroundColorToken, "")},\n`;
        } else if (styles.backgroundColor !== "transparent") {
          out += `${getIndent()}  backgroundColor: ${toRNColor(styles.backgroundColor)},\n`;
        }
      }
    }

    if (styles.borderRadiusToken) {
      out += `${getIndent()}  borderRadius: ${toRNThemeToken(styles.borderRadiusToken, "")},\n`;
    } else if (styles.borderRadius > 0) {
      out += `${getIndent()}  borderRadius: ${styles.borderRadius},\n`;
    }

    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toRNThemeToken(styles.borderColorToken, '') : toRNColor(styles.borderColor);
      out += `${getIndent()}  borderWidth: ${styles.borderWidth},\n`;
      out += `${getIndent()}  borderColor: ${borderCol},\n`;
    }

    if (styles.opacity < 1) {
      out += `${getIndent()}  opacity: ${styles.opacity},\n`;
    }

    if (styles.isAbsolute) {
      out += `${getIndent()}  position: 'absolute',\n`;
      if (styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        if (top !== undefined || topToken) out += `${getIndent()}  top: ${topToken ? toRNThemeToken(topToken, "") : top},\n`;
        if (right !== undefined || rightToken) out += `${getIndent()}  right: ${rightToken ? toRNThemeToken(rightToken, "") : right},\n`;
        if (bottom !== undefined || bottomToken) out += `${getIndent()}  bottom: ${bottomToken ? toRNThemeToken(bottomToken, "") : bottom},\n`;
        if (left !== undefined || leftToken) out += `${getIndent()}  left: ${leftToken ? toRNThemeToken(leftToken, "") : left},\n`;
      }
    }

    if (styles.isFixedBottom) {
      out += `${getIndent()}  position: 'absolute',\n`;
      out += `${getIndent()}  bottom: 0,\n`;
      out += `${getIndent()}  left: 0,\n`;
      out += `${getIndent()}  right: 0,\n`;
      out += `${getIndent()}  width: '100%',\n`;
    }

    out += `${getIndent()}}}>\n`;
    indentLevel++;
    
    // Check if it is LinearGradient container
    const isLinearGradient = styles.gradient && styles.gradient.fromColor && styles.gradient.toColor;
    if (isLinearGradient) {
      const { start, end } = gradientDirectionToRN(styles.gradient!.direction);
      const startStr = `{ x: ${start.x}, y: ${start.y} }`;
      const endStr = `{ x: ${end.x}, y: ${end.y} }`;
      out += `${getIndent()}<LinearGradient\n`;
      out += `${getIndent()}  colors={[${toRNColor(styles.gradient!.fromColor)}, ${toRNColor(styles.gradient!.toColor)}]}\n`;
      out += `${getIndent()}  start={${startStr}}\n`;
      out += `${getIndent()}  end={${endStr}}\n`;
      out += `${getIndent()}  style={{ flex: 1, width: '100%', height: '100%', borderRadius: ${styles.borderRadiusToken ? toRNThemeToken(styles.borderRadiusToken, "") : styles.borderRadius} }}\n`;
      out += `${getIndent()}>\n`;
      indentLevel++;
    }

    normalChildren.forEach(c => {
      out += walk(c, undefined, parentIsFixedBottomRow, styles);
    });

    if (isLinearGradient) {
      indentLevel--;
      out += `${getIndent()}</LinearGradient>\n`;
    }

    indentLevel--;
    out += `${getIndent()}</View>\n`;

    return out;
  }

  const rawRN = walk(root);
  return sanitizeReactNativeCode(rawRN);
}

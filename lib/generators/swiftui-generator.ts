import {
  TranspileNode,
  ParsedStyles,
  isRedundantWrapper,
  toSwiftCamelCase,
  toSwiftThemeToken,
  toSwiftColor,
  toSwiftBackgroundGradient,
  hasIdenticalBackground,
  resolveColorToStandard,
  getStyleTokenKey,
  gradientDirectionToSwift,
  generateSwiftUIFilters,
  toSwiftSFSymbol
} from "../mobile-transpiler";

// Unordered modifier pattern definition
interface SwiftUIModifier {
  type: 'frame' | 'padding' | 'background' | 'cornerRadius' | 'shadow' | 'overlay' | 'opacity' | 'foregroundColor' | 'offset' | 'filter';
  code: string;
}

function buildSwiftUIModifiers(modifiers: SwiftUIModifier[], indent: string): string {
  const order: Record<string, number> = {
    frame: 1,
    padding: 2,
    background: 3,
    cornerRadius: 4,
    shadow: 5,
    overlay: 6,
    opacity: 7,
    foregroundColor: 8,
    offset: 9,
    filter: 10
  };
  
  const sorted = [...modifiers].sort((a, b) => {
    return (order[a.type] || 99) - (order[b.type] || 99);
  });
  
  return sorted.map(m => `\n${indent}${m.code}`).join('');
}

// Post-processing string sanitizer
function sanitizeSwiftUICode(code: string): string {
  return code
    .replace(/\.background\(Color\.clear\)\n/g, "")
    .replace(/\.background\(\.clear\)\n/g, "")
    .replace(/\.frame\(width:\s*auto,\s*height:\s*auto\)\n/g, "")
    .replace(/\.frame\(width:\s*auto\)\n/g, "")
    .replace(/\.frame\(height:\s*auto\)\n/g, "")
    // clean double spaces/empty modifiers
    .replace(/\.frame\(\)\n/g, "");
}

export function transpileToSwiftUI(root: TranspileNode): string {
  let indentLevel = 1;
  const getIndent = () => "    ".repeat(indentLevel);

  function wrapFlexIfNeeded(node: TranspileNode, outCode: string, indent: string): string {
    if (node.styles.hasFlex1) {
      return outCode.trimEnd() + `\n${indent}.frame(maxWidth: .infinity)\n`;
    }
    return outCode;
  }

  function walk(node: TranspileNode | string, parentStyles?: ParsedStyles): string {
    if (typeof node === "string") {
      return `${getIndent()}Text("${node.replace(/"/g, '\\"')}")\n`;
    }

    if (typeof node !== "string" && isRedundantWrapper(node)) {
      return walk(node.children[0], parentStyles);
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
      let divCode = `${getIndent()}Divider()`;
      const divModifiers: SwiftUIModifier[] = [];
      
      let baseColor = "";
      if (styles.backgroundColorToken) {
        baseColor = toSwiftThemeToken(styles.backgroundColorToken, "");
      } else if (styles.backgroundColor && styles.backgroundColor !== "transparent") {
        baseColor = toSwiftColor(styles.backgroundColor);
      }
      if (baseColor) {
        divModifiers.push({ type: 'background', code: `.background(${baseColor})` });
      }
      
      const pt = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
      const pb = styles.paddingBottomToken ? toSwiftThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
      if (styles.padding.top > 0 || styles.paddingTopToken) divModifiers.push({ type: 'padding', code: `.padding(.top, ${pt})` });
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) divModifiers.push({ type: 'padding', code: `.padding(.bottom, ${pb})` });
      
      const mt = styles.marginTopToken ? toSwiftThemeToken(styles.marginTopToken, "") : String(styles.margin.top);
      const mb = styles.marginBottomToken ? toSwiftThemeToken(styles.marginBottomToken, "") : String(styles.margin.bottom);
      if (styles.margin.top > 0 || styles.marginTopToken) divModifiers.push({ type: 'padding', code: `.padding(.top, ${mt})` });
      if (styles.margin.bottom > 0 || styles.marginBottomToken) divModifiers.push({ type: 'padding', code: `.padding(.bottom, ${mb})` });
      
      const isVertical = node.pattern.metadata.orientation === 'vertical';
      if (isVertical) {
        divModifiers.push({ type: 'frame', code: `.frame(width: 1)` });
      } else {
        divModifiers.push({ type: 'frame', code: `.frame(height: 1)` });
      }
      
      divCode += buildSwiftUIModifiers(divModifiers, getIndent() + "    ");
      divCode += "\n";
      return wrapFlexIfNeeded(node, divCode, getIndent());
    }

    // Pattern 2: Status Dot
    if (node.pattern?.type === 'status-dot') {
      const { size, color, colorToken } = node.pattern.metadata;
      const fillCol = colorToken ? toSwiftThemeToken(colorToken, "") : toSwiftColor(color);
      
      let dotCode = `${getIndent()}Circle()\n`;
      dotCode += `${getIndent()}    .fill(${fillCol})\n`;
      dotCode += `${getIndent()}    .frame(width: ${size}, height: ${size})`;
      
      const dotModifiers: SwiftUIModifier[] = [];
      if (styles.opacity < 1) dotModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      if (styles.isAbsolute && styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        let offsetPart = "";
        if (left !== undefined || leftToken) offsetPart += `x: ${leftToken ? toSwiftThemeToken(leftToken, "") : left}`;
        else if (right !== undefined || rightToken) offsetPart += `x: -(${rightToken ? toSwiftThemeToken(rightToken, "") : right})`;
        
        if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y: ${topToken ? toSwiftThemeToken(topToken, "") : top}`;
        else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y: -(${bottomToken ? toSwiftThemeToken(bottomToken, "") : bottom})`;
        
        if (offsetPart) {
          dotModifiers.push({ type: 'offset', code: `.offset(${offsetPart})` });
        }
      }
      
      dotCode += buildSwiftUIModifiers(dotModifiers, getIndent() + "    ");
      dotCode += "\n";
      return wrapFlexIfNeeded(node, dotCode, getIndent());
    }

    // Pattern 3: Progress Bar
    if (node.pattern?.type === 'progress-bar') {
      const { value, outerColor, outerColorToken, innerColor, innerColorToken, outerHeight } = node.pattern.metadata;
      const outBg = outerColorToken ? toSwiftThemeToken(outerColorToken, "") : toSwiftColor(outerColor);
      const inBg = innerColorToken ? toSwiftThemeToken(innerColorToken, "") : toSwiftColor(innerColor);
      
      let pbCode = `${getIndent()}GeometryReader { geo in\n`;
      pbCode += `${getIndent()}    ZStack(alignment: .leading) {\n`;
      pbCode += `${getIndent()}        Capsule()\n`;
      pbCode += `${getIndent()}            .fill(${outBg})\n`;
      pbCode += `${getIndent()}        Capsule()\n`;
      pbCode += `${getIndent()}            .fill(${inBg})\n`;
      pbCode += `${getIndent()}            .frame(width: geo.size.width * ${value.toFixed(3)})\n`;
      pbCode += `${getIndent()}    }\n`;
      pbCode += `${getIndent()}}\n`;
      pbCode += `${getIndent()}.frame(height: ${outerHeight})\n`;
      
      const pbModifiers: SwiftUIModifier[] = [];
      if (styles.opacity < 1) pbModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      
      const pt = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
      const pb = styles.paddingBottomToken ? toSwiftThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
      if (styles.padding.top > 0 || styles.paddingTopToken) pbModifiers.push({ type: 'padding', code: `.padding(.top, ${pt})` });
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) pbModifiers.push({ type: 'padding', code: `.padding(.bottom, ${pb})` });
      
      pbCode += buildSwiftUIModifiers(pbModifiers, getIndent());
      pbCode += "\n";
      return wrapFlexIfNeeded(node, pbCode, getIndent());
    }

    // Lucide Icon
    if (lucide) {
      let iconCode = `${getIndent()}LucideView(icon: .${toSwiftCamelCase(lucide)}) // Lucide: ${lucide}\n`;
      iconCode += `${getIndent()}    .frame(width: ${styles.fontSize || 20}, height: ${styles.fontSize || 20})\n`;
      
      const hasDiffColor = !parentStyles || 
                           parentStyles.textColor !== styles.textColor || 
                           parentStyles.textColorToken !== styles.textColorToken;
      if (styles.explicitTextColor && hasDiffColor) {
        if (styles.textColorToken) {
          iconCode += `${getIndent()}    .foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})\n`;
        } else if (styles.textColor && styles.textColor !== "transparent") {
          iconCode += `${getIndent()}    .foregroundColor(${toSwiftColor(styles.textColor)})\n`;
        }
      }
      iconCode += generateSwiftUIFilters(styles, getIndent() + "    ");
      return wrapFlexIfNeeded(node, iconCode, getIndent());
    }

    // Raw SVG placeholder
    if (styles.isRawSvg) {
      const svgW = typeof styles.width === 'number' ? styles.width : 48;
      const svgH = typeof styles.height === 'number' ? styles.height : 48;
      
      const circleChildren = node.children.filter(c => typeof c !== "string" && c.tagName === "circle") as TranspileNode[];
      if (circleChildren.length > 0) {
        let rotationDeg = 0;
        const svgClasses = node.classes;
        if (svgClasses.includes("-rotate-90")) {
          rotationDeg = -90;
        } else if (svgClasses.includes("rotate-90")) {
          rotationDeg = 90;
        }
        
        let svgOut = `${getIndent()}ZStack {\n`;
        indentLevel++;
        circleChildren.forEach(circle => {
          const strokeWidth = parseFloat(circle.attributes["stroke-width"]) || 1;
          const strokeColorStr = circle.attributes["stroke"] || "black";
          const tokenKey = strokeColorStr.startsWith("var(") ? getStyleTokenKey(strokeColorStr) : undefined;
          const strokeColor = tokenKey 
            ? toSwiftThemeToken(tokenKey, "") 
            : toSwiftColor(resolveColorToStandard(strokeColorStr));
            
          const strokeLinecap = circle.attributes["stroke-linecap"] === "round" ? ".round" : ".butt";
          const dashArray = parseFloat(circle.attributes["stroke-dasharray"]) || 0;
          const dashOffset = parseFloat(circle.attributes["stroke-dashoffset"]) || 0;
          
          let trimCode = "";
          if (dashArray > 0 && dashOffset > 0) {
            const progress = 1.0 - (dashOffset / dashArray);
            const clampedProgress = Math.max(0, Math.min(1, progress));
            trimCode = `.trim(from: 0, to: ${clampedProgress.toFixed(2)})`;
          }
          
          svgOut += `${getIndent()}Circle()\n`;
          if (trimCode) {
            svgOut += `${getIndent()}    ${trimCode}\n`;
          }
          
          if (strokeLinecap === ".round") {
            svgOut += `${getIndent()}    .stroke(${strokeColor}, style: StrokeStyle(lineWidth: ${strokeWidth}, lineCap: .round))\n`;
          } else {
            svgOut += `${getIndent()}    .stroke(${strokeColor}, lineWidth: ${strokeWidth})\n`;
          }
          
          if (rotationDeg !== 0) {
            svgOut += `${getIndent()}    .rotationEffect(.degrees(${rotationDeg}))\n`;
          }
        });
        indentLevel--;
        svgOut += `${getIndent()}}\n`;
        svgOut += `${getIndent()}.frame(width: ${svgW}, height: ${svgH})\n`;
        return wrapFlexIfNeeded(node, svgOut, getIndent());
      }
      
      let out = `${getIndent()}Color.clear.frame(width: ${svgW}, height: ${svgH}) // TODO: Add custom SVG/Asset here\n`;
      out += generateSwiftUIFilters(styles, getIndent());
      return wrapFlexIfNeeded(node, out, getIndent());
    }

    if (isImage) {
      const src = node.attributes["src"] || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809";
      let imgCode = `${getIndent()}AsyncImage(url: URL(string: "${src}")) { image in\n`;
      imgCode += `${getIndent()}    image.resizable()\n`;
      imgCode += `${getIndent()}        .aspectRatio(contentMode: .fill)\n`;
      imgCode += `${getIndent()}} placeholder: {\n`;
      imgCode += `${getIndent()}    Color.gray.opacity(0.1)\n`;
      imgCode += `${getIndent()}}\n`;
      
      const imgModifiers: SwiftUIModifier[] = [];
      const w = styles.width;
      const h = styles.height;
      if (typeof w === "number" || typeof h === "number") {
        const wStr = typeof w === "number" ? `width: ${w}` : "";
        const hStr = typeof h === "number" ? `height: ${h}` : "";
        const comma = wStr && hStr ? ", " : "";
        imgModifiers.push({ type: 'frame', code: `.frame(${wStr}${comma}${hStr})` });
      }
      if (styles.borderRadiusToken) {
        imgModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})` });
      } else if (styles.borderRadius > 0) {
        imgModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${styles.borderRadius})` });
      }
      if (styles.opacity < 1) {
        imgModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      }
      
      imgCode += buildSwiftUIModifiers(imgModifiers, getIndent());
      imgCode += "\n" + generateSwiftUIFilters(styles, getIndent());
      return wrapFlexIfNeeded(node, imgCode, getIndent());
    }

    if (isButton) {
      let btnCode = `${getIndent()}Button(action: {\n`;
      btnCode += `${getIndent()}    // Action here\n`;
      btnCode += `${getIndent()}}) {\n`;
      indentLevel++;
      
      const btnGap = styles.gapToken ? toSwiftThemeToken(styles.gapToken, "") : String(styles.gap || 8);
      const stackCombo = styles.gapToken ? `spacing: ${btnGap}` : (styles.gap > 0 ? `spacing: ${styles.gap}` : "");
      btnCode += `${getIndent()}HStack(${stackCombo}) {\n`;
      indentLevel++;
      node.children.forEach(c => {
        btnCode += walk(c, styles);
      });
      indentLevel--;
      btnCode += `${getIndent()}}\n`;
      
      const btnModifiers: SwiftUIModifier[] = [];
      
      const paddingY = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top || 12);
      const paddingX = styles.paddingLeftToken ? toSwiftThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left || 16);
      btnModifiers.push({ type: 'padding', code: `.padding(.vertical, ${paddingY})` });
      btnModifiers.push({ type: 'padding', code: `.padding(.horizontal, ${paddingX})` });
      
      if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
        if (styles.backgroundColorToken) {
          btnModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})` });
        } else if (styles.backgroundColor !== "transparent") {
          btnModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
        }
        btnModifiers.push({ type: 'background', code: `.background(.ultraThinMaterial)` });
      } else {
        if (styles.backgroundColorToken) {
          btnModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})` });
        } else if (styles.backgroundColor !== "transparent") {
          btnModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
        }
      }
      
      if (styles.borderRadiusToken) {
        btnModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})` });
      } else if (styles.borderRadius > 0) {
        btnModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${styles.borderRadius})` });
      }
      if (styles.textColorToken) {
        btnModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})` });
      } else if (styles.textColor && styles.textColor !== "transparent") {
        btnModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftColor(styles.textColor)})` });
      }
      if (styles.opacity < 1) {
        btnModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      }
      
      btnCode += buildSwiftUIModifiers(btnModifiers, getIndent());
      btnCode += "\n" + generateSwiftUIFilters(styles, getIndent());
      
      indentLevel--;
      btnCode += `${getIndent()}}\n`;
      return wrapFlexIfNeeded(node, btnCode, getIndent());
    }

    // Text Leaf
    const isTextLeaf = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName) && 
                       node.children.length === 1 && typeof node.children[0] === "string";
    
    if (isTextLeaf) {
      const textVal = node.children[0] as string;
      let textCode = `${getIndent()}Text("${textVal.replace(/"/g, '\\"')}")\n`;
      let fontStr = "";
      if (node.classes.includes("dg-type-screen-title")) fontStr = ".largeTitle";
      else if (node.classes.includes("dg-type-section-title")) fontStr = ".title2";
      else if (node.classes.includes("dg-type-card-title")) fontStr = ".headline";
      else if (node.classes.includes("dg-type-body")) fontStr = ".body";
      else if (node.classes.includes("dg-type-caption")) fontStr = ".caption";
      else if (node.classes.includes("dg-type-metadata")) fontStr = ".caption2";

      if (fontStr) {
        textCode += `${getIndent()}    .font(${fontStr})\n`;
      } else if (styles.fontSize !== undefined) {
        textCode += `${getIndent()}    .font(.system(size: ${styles.fontSize}))\n`;
      }
      if (styles.fontWeight !== undefined) {
        if (styles.fontWeight === "heavy") textCode += `${getIndent()}    .fontWeight(.heavy)\n`;
        else if (styles.fontWeight === "bold") textCode += `${getIndent()}    .fontWeight(.bold)\n`;
        else if (styles.fontWeight === "semibold") textCode += `${getIndent()}    .fontWeight(.semibold)\n`;
        else if (styles.fontWeight === "medium") textCode += `${getIndent()}    .fontWeight(.medium)\n`;
        else if (styles.fontWeight === "normal") textCode += `${getIndent()}    .fontWeight(.regular)\n`;
      }
      
      if (styles.textAlign !== undefined) {
        if (styles.textAlign === "center") textCode += `${getIndent()}    .multilineTextAlignment(.center)\n`;
        else if (styles.textAlign === "right") textCode += `${getIndent()}    .multilineTextAlignment(.trailing)\n`;
        else if (styles.textAlign === "left") textCode += `${getIndent()}    .multilineTextAlignment(.leading)\n`;
      }
      
      const textModifiers: SwiftUIModifier[] = [];
      const hasDiffColor = !parentStyles || 
                           parentStyles.textColor !== styles.textColor || 
                           parentStyles.textColorToken !== styles.textColorToken;
      if (styles.explicitTextColor && hasDiffColor) {
        if (styles.textColorToken) {
          textModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})` });
        } else if (styles.textColor && styles.textColor !== "transparent") {
          textModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftColor(styles.textColor)})` });
        }
      }
      
      const mt = styles.marginTopToken ? toSwiftThemeToken(styles.marginTopToken, "") : String(styles.margin.top);
      const mb = styles.marginBottomToken ? toSwiftThemeToken(styles.marginBottomToken, "") : String(styles.margin.bottom);
      if (styles.margin.top > 0 || styles.marginTopToken) textModifiers.push({ type: 'padding', code: `.padding(.top, ${mt})` });
      if (styles.margin.bottom > 0 || styles.marginBottomToken) textModifiers.push({ type: 'padding', code: `.padding(.bottom, ${mb})` });
      if (styles.opacity < 1) textModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      
      textCode += buildSwiftUIModifiers(textModifiers, getIndent() + "    ");
      textCode += "\n" + generateSwiftUIFilters(styles, getIndent() + "    ");
      return wrapFlexIfNeeded(node, textCode, getIndent());
    }

    // Empty Container (fallback)
    if (node.children.length === 0) {
      let baseColor = "Color.clear";
      const identicalBg = hasIdenticalBackground(styles, parentStyles);
      if (!identicalBg) {
        if (styles.backgroundColorToken) {
          baseColor = toSwiftThemeToken(styles.backgroundColorToken, "");
        } else if (styles.backgroundColor !== "transparent") {
          baseColor = toSwiftColor(styles.backgroundColor);
        }
      }
      
      const fillCol = styles.gradient ? "Color.clear" : baseColor;
      let containerCode = "";
      if (fillCol === "Color.clear") {
        if (styles.gradient || styles.isAbsolute) {
          containerCode += `${getIndent()}Rectangle().fill(Color.clear)`;
        } else if (styles.hasFlex1 || styles.width === "100%") {
          return `${getIndent()}Spacer()\n`;
        } else {
          containerCode += `${getIndent()}Color.clear`;
        }
      } else {
        containerCode += `${getIndent()}Rectangle().fill(${fillCol})`;
      }

      const containerModifiers: SwiftUIModifier[] = [];
      const pt = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
      const pb = styles.paddingBottomToken ? toSwiftThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
      const pl = styles.paddingLeftToken ? toSwiftThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left);
      const pr = styles.paddingRightToken ? toSwiftThemeToken(styles.paddingRightToken, "") : String(styles.padding.right);

      if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
        containerModifiers.push({ type: 'padding', code: `.padding(.horizontal, AppTheme.screenPadding)` });
        if (styles.padding.top > 0 || styles.paddingTopToken) containerModifiers.push({ type: 'padding', code: `.padding(.top, ${pt})` });
        if (styles.padding.bottom > 0 || styles.paddingBottomToken) containerModifiers.push({ type: 'padding', code: `.padding(.bottom, ${pb})` });
      } else {
        if (styles.padding.top > 0 || styles.paddingTopToken) containerModifiers.push({ type: 'padding', code: `.padding(.top, ${pt})` });
        if (styles.padding.bottom > 0 || styles.paddingBottomToken) containerModifiers.push({ type: 'padding', code: `.padding(.bottom, ${pb})` });
        if (styles.padding.left > 0 || styles.paddingLeftToken) containerModifiers.push({ type: 'padding', code: `.padding(.leading, ${pl})` });
        if (styles.padding.right > 0 || styles.paddingRightToken) containerModifiers.push({ type: 'padding', code: `.padding(.trailing, ${pr})` });
      }

      if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
        if (styles.backgroundColorToken) {
          containerModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})` });
        } else if (styles.backgroundColor !== "transparent") {
          containerModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
        }
        containerModifiers.push({ type: 'background', code: `.background(.ultraThinMaterial)` });
      } else {
        if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
          containerModifiers.push({ type: 'background', code: toSwiftBackgroundGradient(styles, "", baseColor).trim() });
        }
      }

      if (styles.borderRadiusToken) {
        containerModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})` });
      } else if (styles.borderRadius > 0) {
        containerModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${styles.borderRadius})` });
      }

      if (styles.shadow) {
        if (styles.shadow === "surface") {
          containerModifiers.push({ type: 'shadow', code: `.shadow(color: Color.black.opacity(0.04), radius: 15, x: 0, y: 10)` });
        } else if (styles.shadow === "overlay") {
          containerModifiers.push({ type: 'shadow', code: `.shadow(color: Color.black.opacity(0.12), radius: 20, x: 0, y: 10)` });
        }
      }

      if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
        const borderCol = styles.borderColorToken ? toSwiftThemeToken(styles.borderColorToken, '') : toSwiftColor(styles.borderColor);
        if (styles.borderRadiusToken || styles.borderRadius > 0) {
          const radius = styles.borderRadiusToken ? toSwiftThemeToken(styles.borderRadiusToken, '') : String(styles.borderRadius);
          containerModifiers.push({ type: 'overlay', code: `.overlay(RoundedRectangle(cornerRadius: ${radius}).stroke(${borderCol}, lineWidth: ${styles.borderWidth}))` });
        }
      }

      if (styles.opacity < 1) {
        containerModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      }
      
      const w = styles.width;
      const h = styles.height;
      const frameParts: string[] = [];
      if (w === "100%" || styles.hasFlex1) frameParts.push("maxWidth: .infinity");
      else if (typeof w === "number") frameParts.push(`width: ${w}`);
      if (typeof h === "number") frameParts.push(`height: ${h}`);
      if (typeof styles.minHeight === "number" && styles.minHeight > 0) frameParts.push(`minHeight: ${styles.minHeight}`);
      if (frameParts.length > 0) {
        containerModifiers.push({ type: 'frame', code: `.frame(${frameParts.join(", ")})` });
      }

      if (styles.isAbsolute && styles.absolutePosition) {
        const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
        let offsetPart = "";
        if (left !== undefined || leftToken) offsetPart += `x: ${leftToken ? toSwiftThemeToken(leftToken, "") : left}`;
        else if (right !== undefined || rightToken) offsetPart += `x: -(${rightToken ? toSwiftThemeToken(rightToken, "") : right})`;
        
        if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y: ${topToken ? toSwiftThemeToken(topToken, "") : top}`;
        else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y: -(${bottomToken ? toSwiftThemeToken(bottomToken, "") : bottom})`;
        
        if (offsetPart) {
          containerModifiers.push({ type: 'offset', code: `.offset(${offsetPart})` });
        }
      }

      containerCode += buildSwiftUIModifiers(containerModifiers, getIndent() + "    ");
      containerCode += "\n" + generateSwiftUIFilters(styles, getIndent());
      return containerCode;
    }

    // Grid Layout
    if (styles.isGrid && styles.gridCols > 0) {
      const spacing = styles.gapToken ? toSwiftThemeToken(styles.gapToken, '') : String(styles.gap);
      let gridCode = `${getIndent()}LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: ${spacing}), count: ${styles.gridCols}), spacing: ${spacing}) {\n`;
      indentLevel++;
      node.children.forEach(c => { gridCode += walk(c, styles); });
      indentLevel--;
      gridCode += `${getIndent()}}\n`;
      
      const gridModifiers: SwiftUIModifier[] = [];
      if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
        if (styles.backgroundColorToken) {
          gridModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})` });
        } else if (styles.backgroundColor !== "transparent") {
          gridModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
        }
        gridModifiers.push({ type: 'background', code: `.background(.ultraThinMaterial)` });
      } else {
        if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
          const baseCol = styles.backgroundColorToken ? toSwiftThemeToken(styles.backgroundColorToken, "") : (styles.backgroundColor !== "transparent" ? toSwiftColor(styles.backgroundColor) : "Color.clear");
          gridModifiers.push({ type: 'background', code: toSwiftBackgroundGradient(styles, "", baseCol).trim() });
        } else {
          const identicalBg = hasIdenticalBackground(styles, parentStyles);
          if (!identicalBg) {
            if (styles.backgroundColorToken) {
              gridModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, '')})` });
            } else if (styles.backgroundColor !== 'transparent') {
              gridModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
            }
          }
        }
      }
      if (styles.borderRadiusToken) {
        gridModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, '')})` });
      } else if (styles.borderRadius > 0) {
        gridModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${styles.borderRadius})` });
      }
      if (styles.explicitTextColor) {
        if (styles.textColorToken) {
          gridModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})` });
        } else if (styles.textColor && styles.textColor !== "transparent") {
          gridModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftColor(styles.textColor)})` });
        }
      }
      if (styles.opacity < 1) {
        gridModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
      }
      
      gridCode += buildSwiftUIModifiers(gridModifiers, getIndent());
      gridCode += "\n" + generateSwiftUIFilters(styles, getIndent());
      return wrapFlexIfNeeded(node, gridCode, getIndent());
    }

    // Standard Stack Container (HStack / VStack / ZStack)
    const isCol = styles.flexDirection === "column";
    const stackName = isCol ? "VStack" : "HStack";
    const alignStr = isCol 
      ? (styles.alignItems === "center" ? "alignment: .center" : styles.alignItems === "end" ? "alignment: .trailing" : "alignment: .leading")
      : (styles.alignItems === "start" ? "alignment: .top" : styles.alignItems === "end" ? "alignment: .bottom" : "");
    const spacingStr = styles.gapToken
      ? `spacing: ${toSwiftThemeToken(styles.gapToken, "")}`
      : (styles.gap > 0 ? `spacing: ${styles.gap}` : "");
    const combo = alignStr && spacingStr ? `${alignStr}, ${spacingStr}` : (alignStr || spacingStr);
    
    const normalChildren = node.children.filter(c => typeof c === 'string' || !c.styles.isAbsolute);
    const absoluteChildren = node.children.filter(c => typeof c !== 'string' && c.styles.isAbsolute) as TranspileNode[];
    const hasAbsolute = absoluteChildren.length > 0;

    let out = "";
    if (hasAbsolute) {
      const bgAbsoluteChildren = absoluteChildren.filter(c => c.styles.isBackgroundAbsolute);
      const fgAbsoluteChildren = absoluteChildren.filter(c => !c.styles.isBackgroundAbsolute);

      out += `${getIndent()}ZStack(alignment: .topLeading) {\n`;
      indentLevel++;
      
      bgAbsoluteChildren.forEach(c => { out += walk(c, styles); });

      out += `${getIndent()}${stackName}(${combo}) {\n`;
      indentLevel++;
      normalChildren.forEach((c, idx) => {
        out += walk(c, styles);
        if (styles.justifyContent === "between" && idx < normalChildren.length - 1) {
          out += `${getIndent()}Spacer()\n`;
        }
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
      
      fgAbsoluteChildren.forEach(c => { out += walk(c, styles); });
      
      indentLevel--;
      out += `${getIndent()}}\n`;
    } else {
      out += `${getIndent()}${stackName}(${combo}) {\n`;
      indentLevel++;
      normalChildren.forEach((c, idx) => {
        out += walk(c, styles);
        if (styles.justifyContent === "between" && idx < normalChildren.length - 1) {
          out += `${getIndent()}Spacer()\n`;
        }
      });
      indentLevel--;
      out += `${getIndent()}}\n`;
    }

    // Stack Modifiers
    const stackModifiers: SwiftUIModifier[] = [];
    const pt = styles.paddingTopToken ? toSwiftThemeToken(styles.paddingTopToken, "") : String(styles.padding.top);
    const pb = styles.paddingBottomToken ? toSwiftThemeToken(styles.paddingBottomToken, "") : String(styles.padding.bottom);
    const pl = styles.paddingLeftToken ? toSwiftThemeToken(styles.paddingLeftToken, "") : String(styles.padding.left);
    const pr = styles.paddingRightToken ? toSwiftThemeToken(styles.paddingRightToken, "") : String(styles.padding.right);

    if (styles.paddingLeftToken === "screenPadding" && styles.paddingRightToken === "screenPadding") {
      stackModifiers.push({ type: 'padding', code: `.padding(.horizontal, AppTheme.screenPadding)` });
      if (styles.padding.top > 0 || styles.paddingTopToken) stackModifiers.push({ type: 'padding', code: `.padding(.top, ${pt})` });
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) stackModifiers.push({ type: 'padding', code: `.padding(.bottom, ${pb})` });
    } else {
      if (styles.padding.top > 0 || styles.paddingTopToken) stackModifiers.push({ type: 'padding', code: `.padding(.top, ${pt})` });
      if (styles.padding.bottom > 0 || styles.paddingBottomToken) stackModifiers.push({ type: 'padding', code: `.padding(.bottom, ${pb})` });
      if (styles.padding.left > 0 || styles.paddingLeftToken) stackModifiers.push({ type: 'padding', code: `.padding(.leading, ${pl})` });
      if (styles.padding.right > 0 || styles.paddingRightToken) stackModifiers.push({ type: 'padding', code: `.padding(.trailing, ${pr})` });
    }

    if (styles.backdropFilterBlur && styles.backdropFilterBlur > 0) {
      if (styles.backgroundColorToken) {
        stackModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})` });
      } else if (styles.backgroundColor !== "transparent") {
        stackModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
      }
      stackModifiers.push({ type: 'background', code: `.background(.ultraThinMaterial)` });
    } else {
      if (styles.gradient && styles.gradient.fromColor && styles.gradient.toColor) {
        const baseCol = styles.backgroundColorToken ? toSwiftThemeToken(styles.backgroundColorToken, "") : (styles.backgroundColor !== "transparent" ? toSwiftColor(styles.backgroundColor) : "Color.clear");
        stackModifiers.push({ type: 'background', code: toSwiftBackgroundGradient(styles, "", baseCol).trim() });
      } else {
        const identicalBg = hasIdenticalBackground(styles, parentStyles);
        if (!identicalBg) {
          if (styles.backgroundColorToken) {
            stackModifiers.push({ type: 'background', code: `.background(${toSwiftThemeToken(styles.backgroundColorToken, "")})` });
          } else if (styles.backgroundColor !== "transparent") {
            stackModifiers.push({ type: 'background', code: `.background(${toSwiftColor(styles.backgroundColor)})` });
          }
        }
      }
    }
    
    if (styles.borderRadiusToken) {
      stackModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${toSwiftThemeToken(styles.borderRadiusToken, "")})` });
    } else if (styles.borderRadius > 0) {
      stackModifiers.push({ type: 'cornerRadius', code: `.cornerRadius(${styles.borderRadius})` });
    }

    if (styles.shadow) {
      if (styles.shadow === "surface") {
        stackModifiers.push({ type: 'shadow', code: `.shadow(color: Color.black.opacity(0.04), radius: 15, x: 0, y: 10)` });
      } else if (styles.shadow === "overlay") {
        stackModifiers.push({ type: 'shadow', code: `.shadow(color: Color.black.opacity(0.12), radius: 20, x: 0, y: 10)` });
      }
    }

    if (styles.borderWidth > 0 && styles.borderColor !== 'transparent') {
      const borderCol = styles.borderColorToken ? toSwiftThemeToken(styles.borderColorToken, '') : toSwiftColor(styles.borderColor);
      if (styles.borderRadiusToken || styles.borderRadius > 0) {
        const radius = styles.borderRadiusToken ? toSwiftThemeToken(styles.borderRadiusToken, '') : String(styles.borderRadius);
        stackModifiers.push({ type: 'overlay', code: `.overlay(RoundedRectangle(cornerRadius: ${radius}).stroke(${borderCol}, lineWidth: ${styles.borderWidth}))` });
      }
    }

    if (styles.opacity < 1) {
      stackModifiers.push({ type: 'opacity', code: `.opacity(${styles.opacity})` });
    }
    
    const w = styles.width;
    const h = styles.height;
    const frameParts: string[] = [];
    if (w === "100%" || styles.hasFlex1) frameParts.push("maxWidth: .infinity");
    else if (typeof w === "number") frameParts.push(`width: ${w}`);
    if (typeof h === "number") frameParts.push(`height: ${h}`);
    if (typeof styles.minHeight === "number" && styles.minHeight > 0) frameParts.push(`minHeight: ${styles.minHeight}`);
    if (frameParts.length > 0) {
      stackModifiers.push({ type: 'frame', code: `.frame(${frameParts.join(", ")})` });
    }

    if (styles.explicitTextColor) {
      if (styles.textColorToken) {
        stackModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftThemeToken(styles.textColorToken, "")})` });
      } else if (styles.textColor && styles.textColor !== "transparent") {
        stackModifiers.push({ type: 'foregroundColor', code: `.foregroundColor(${toSwiftColor(styles.textColor)})` });
      }
    }

    if (styles.isAbsolute && styles.absolutePosition) {
      const { top, right, bottom, left, topToken, rightToken, bottomToken, leftToken } = styles.absolutePosition;
      let offsetPart = "";
      if (left !== undefined || leftToken) offsetPart += `x: ${leftToken ? toSwiftThemeToken(leftToken, "") : left}`;
      else if (right !== undefined || rightToken) offsetPart += `x: -(${rightToken ? toSwiftThemeToken(rightToken, "") : right})`;
      
      if (top !== undefined || topToken) offsetPart += `${offsetPart ? ", " : ""}y: ${topToken ? toSwiftThemeToken(topToken, "") : top}`;
      else if (bottom !== undefined || bottomToken) offsetPart += `${offsetPart ? ", " : ""}y: -(${bottomToken ? toSwiftThemeToken(bottomToken, "") : bottom})`;
      
      if (offsetPart) {
        stackModifiers.push({ type: 'offset', code: `.offset(${offsetPart})` });
      }
    }

    out += buildSwiftUIModifiers(stackModifiers, getIndent());
    out += "\n" + generateSwiftUIFilters(styles, getIndent());

    return out;
  }

  const rawSwift = walk(root);
  return sanitizeSwiftUICode(rawSwift);
}

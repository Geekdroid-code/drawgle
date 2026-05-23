import * as fs from "fs";
import * as path from "path";

// Mock design tokens matching home.html values
const mockTokens = {
  colors: {
    "background-primary": { value: "#F9F9F7" },
    "background-secondary": { value: "#FFFFFF" },
    "surface-card": { value: "#FFFFFF" },
    "action-primary": { value: "#1A1A1A" },
    "action-secondary": { value: "#E8F5E9" },
    "action-on-primary-text": { value: "#FFFFFF" },
    "text-high-emphasis": { value: "#1A1A1A" },
    "text-medium-emphasis": { value: "#6B6B6B" },
    "text-low-emphasis": { value: "#A1A1A1" },
    "border-divider": { value: "rgba(0, 0, 0, 0.05)" },
  },
  radii: {
    app: { value: "32px" },
    pill: { value: "9999px" },
  },
  "mobile-layout": {
    "screen-margin": { value: "24px" },
    "section-gap": { value: "32px" },
    "element-gap": { value: "12px" },
    "safe-area-top": { value: "16px" },
    "safe-area-bottom": { value: "16px" },
  },
  spacing: {
    xl: { value: "32px" },
    md: { value: "16px" },
    sm: { value: "12px" },
    xs: { value: "8px" },
    xxs: { value: "4px" },
  },
  sizing: {
    "standard-button-height": { value: "56px" },
    "standard-input-height": { value: "52px" },
  },
  typography: {
    "font-family": { value: "Plus Jakarta Sans" }
  }
};

function getVal(tokens: any, path: string, fallback: string): string {
  if (!tokens) return fallback;
  const parts = path.split(".");
  let cur = tokens;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = cur[part];
  }
  return cur?.value || fallback;
}

function sanitizeHtmlForExport(html: string): string {
  if (!html) return "";
  return html
    .replace(/\s*data-drawgle-id="[^"]*"/g, "")
    .replace(/\s*data-drawgle-theme="[^"]*"/g, "")
    .replace(/\s*data-drawgle-icon="[^"]*"/g, "")
    .replace(/\s*data-drawgle-font-preconnect="[^"]*"/g, "")
    .replace(/\s*data-component-type="[^"]*"/g, "")
    .replace(/\s*aria-current="[^"]*"/g, "")
    .replace(/\s*data-active="[^"]*"/g, "")
    .trim();
}

function resolveCssVariablesInString(str: string, tokens: any): string {
  const bgPrimary = getVal(tokens, "colors.background-primary", "#F9F9F7");
  const bgSecondary = getVal(tokens, "colors.background-secondary", "#FFFFFF");
  const surfaceCard = getVal(tokens, "colors.surface-card", "#FFFFFF");
  const actionPrimary = getVal(tokens, "colors.action-primary", "#1A1A1A");
  const actionSecondary = getVal(tokens, "colors.action-secondary", "#E8F5E9");
  const actionOnPrimary = getVal(tokens, "colors.action-on-primary-text", "#FFFFFF");
  const textHigh = getVal(tokens, "colors.text-high-emphasis", "#1A1A1A");
  const textMedium = getVal(tokens, "colors.text-medium-emphasis", "#6B6B6B");
  const textLow = getVal(tokens, "colors.text-low-emphasis", "#A1A1A1");
  const borderDivider = getVal(tokens, "colors.border-divider", "rgba(0, 0, 0, 0.05)");
  const radiusApp = getVal(tokens, "radii.app", "32px");
  const radiusPill = getVal(tokens, "radii.pill", "9999px");
  const screenPadding = getVal(tokens, "mobile-layout.screen-margin", "24px");
  const sectionGap = getVal(tokens, "mobile-layout.section-gap", "32px");
  const elementGap = getVal(tokens, "mobile-layout.element-gap", "12px");
  const safeAreaTop = getVal(tokens, "mobile-layout.safe-area-top", "16px");
  const safeAreaBottom = getVal(tokens, "mobile-layout.safe-area-bottom", "16px");
  const spacingXl = getVal(tokens, "spacing.xl", "32px");
  const spacingMd = getVal(tokens, "spacing.md", "16px");
  const spacingSm = getVal(tokens, "spacing.sm", "12px");
  const spacingXs = getVal(tokens, "spacing.xs", "8px");
  const spacingXxs = getVal(tokens, "spacing.xxs", "4px");
  const buttonHeight = getVal(tokens, "sizing.standard-button-height", "56px");
  const inputHeight = getVal(tokens, "sizing.standard-input-height", "52px");

  const varMap: Record<string, string> = {
    "--dg-color-background-primary": bgPrimary,
    "--dg-color-background-secondary": bgSecondary,
    "--dg-color-surface-card": surfaceCard,
    "--dg-color-surface-bottom-sheet": surfaceCard,
    "--dg-color-surface-modal": surfaceCard,
    "--dg-color-action-primary": actionPrimary,
    "--dg-color-action-secondary": actionSecondary,
    "--dg-color-action-on-primary-text": actionOnPrimary,
    "--dg-color-text-high-emphasis": textHigh,
    "--dg-color-text-medium-emphasis": textMedium,
    "--dg-color-text-low-emphasis": textLow,
    "--dg-color-border-divider": borderDivider,
    "--dg-radii-app": radiusApp,
    "--dg-radii-pill": radiusPill,
    "--dg-mobile-layout-screen-margin": screenPadding,
    "--dg-mobile-layout-section-gap": sectionGap,
    "--dg-mobile-layout-element-gap": elementGap,
    "--dg-mobile-layout-safe-area-top": safeAreaTop,
    "--dg-mobile-layout-safe-area-bottom": safeAreaBottom,
    "--dg-spacing-xl": spacingXl,
    "--dg-spacing-md": spacingMd,
    "--dg-spacing-sm": spacingSm,
    "--dg-spacing-xs": spacingXs,
    "--dg-spacing-xxs": spacingXxs,
    "--dg-sizing-standard-button-height": buttonHeight,
    "--dg-sizing-standard-input-height": inputHeight,
  };

  // 1. Resolve calc() statements first, e.g. calc(var(--x) + 96px)
  let resolved = str.replace(/calc\([^)]+\)/g, (calcMatch) => {
    let inner = calcMatch.slice(5, -1);
    inner = inner.replace(/var\((--dg-[a-zA-Z0-9_-]+)[^)]*\)/g, (_, varName) => {
      return varMap[varName] || "0px";
    });

    try {
      const numbers = inner.replace(/px/g, "").split(/([+-])/).map(s => s.trim()).filter(Boolean);
      let res = parseFloat(numbers[0]) || 0;
      for (let i = 1; i < numbers.length; i += 2) {
        const op = numbers[i];
        const operand = parseFloat(numbers[i+1]) || 0;
        if (op === "+") res += operand;
        else if (op === "-") res -= operand;
      }
      return `${res}px`;
    } catch (_e) {
      return calcMatch;
    }
  });

  // 2. Resolve normal var(--x) references
  resolved = resolved.replace(/var\((--dg-[a-zA-Z0-9_-]+)[^)]*\)/g, (match, varName) => {
    return varMap[varName] || match;
  });

  return resolved;
}

function normalizeHtmlToStandardTailwind(html: string, tokens: any): string {
  if (!html) return "";

  const bgPrimary = getVal(tokens, "colors.background-primary", "#F9F9F7");
  const bgSecondary = getVal(tokens, "colors.background-secondary", "#FFFFFF");
  const surfaceCard = getVal(tokens, "colors.surface-card", "#FFFFFF");
  const actionPrimary = getVal(tokens, "colors.action-primary", "#1A1A1A");
  const actionSecondary = getVal(tokens, "colors.action-secondary", "#E8F5E9");
  const actionOnPrimary = getVal(tokens, "colors.action-on-primary-text", "#FFFFFF");
  const textHigh = getVal(tokens, "colors.text-high-emphasis", "#1A1A1A");
  const textMedium = getVal(tokens, "colors.text-medium-emphasis", "#6B6B6B");
  const textLow = getVal(tokens, "colors.text-low-emphasis", "#A1A1A1");
  const borderDivider = getVal(tokens, "colors.border-divider", "rgba(0, 0, 0, 0.05)");
  const radiusApp = getVal(tokens, "radii.app", "32px");
  const radiusPill = getVal(tokens, "radii.pill", "9999px");
  const screenPadding = getVal(tokens, "mobile-layout.screen-margin", "24px");
  const sectionGap = getVal(tokens, "mobile-layout.section-gap", "32px");
  const elementGap = getVal(tokens, "mobile-layout.element-gap", "12px");
  const fontFamily = getVal(tokens, "typography.font-family", "Plus Jakarta Sans");

  let out = sanitizeHtmlForExport(html);

  // Map custom classes to pure Tailwind inline styles with concrete values
  out = out
    .replace(/\bdg-bg-primary\b/g, `bg-[${bgPrimary}]`)
    .replace(/\bdg-bg-secondary\b/g, `bg-[${bgSecondary}]`)
    .replace(/\bdg-surface-card\b/g, `bg-[${surfaceCard}]`)
    .replace(/\bdg-surface-bottom-sheet\b/g, `bg-[${surfaceCard}]`)
    .replace(/\bdg-surface-modal\b/g, `bg-[${surfaceCard}]`)
    .replace(/\bdg-text-high\b/g, `text-[${textHigh}]`)
    .replace(/\bdg-text-medium\b/g, `text-[${textMedium}]`)
    .replace(/\bdg-text-low\b/g, `text-[${textLow}]`)
    .replace(/\bdg-action-primary\b/g, `bg-[${actionPrimary}] text-[${actionOnPrimary}]`)
    .replace(/\bdg-action-secondary\b/g, `bg-[${actionSecondary}]`)
    .replace(/\bdg-border-divider\b/g, `border-[${borderDivider}]`)
    .replace(/\bdg-border-focused\b/g, `border-[${actionPrimary}]`)
    .replace(/\bdg-radius-app\b/g, `rounded-[${radiusApp}]`)
    .replace(/\bdg-radius-pill\b/g, `rounded-[${radiusPill}]`)
    .replace(/\bdg-screen-padding\b/g, `px-[${screenPadding}]`)
    .replace(/\bdg-section-gap\b/g, `gap-[${sectionGap}]`)
    .replace(/\bdg-element-gap\b/g, `gap-[${elementGap}]`);

  // Map typography classes
  out = out
    .replace(/\bdg-type-nav-title\b/g, `font-['${fontFamily}',sans-serif] text-[17px] font-semibold leading-[22px]`)
    .replace(/\bdg-type-screen-title\b/g, `font-['${fontFamily}',sans-serif] text-[32px] font-extrabold leading-[38px]`)
    .replace(/\bdg-type-hero-title\b/g, `font-['${fontFamily}',sans-serif] text-[40px] font-extrabold leading-[44px]`)
    .replace(/\bdg-type-section-title\b/g, `font-['${fontFamily}',sans-serif] text-[22px] font-bold leading-[28px]`)
    .replace(/\bdg-type-metric-value\b/g, `font-['${fontFamily}',sans-serif] text-[36px] font-medium leading-[40px]`)
    .replace(/\bdg-type-body\b/g, `font-['${fontFamily}',sans-serif] text-[16px] leading-[24px]`)
    .replace(/\bdg-type-supporting\b/g, `font-['${fontFamily}',sans-serif] text-[14px] font-medium leading-[20px]`)
    .replace(/\bdg-type-caption\b/g, `font-['${fontFamily}',sans-serif] text-[12px] font-semibold leading-[16px]`)
    .replace(/\bdg-type-button-label\b/g, `font-['${fontFamily}',sans-serif] text-[15px] font-semibold leading-[20px]`);

  // Resolve all standard variables and calc blocks generically
  return resolveCssVariablesInString(out, tokens);
}

function run() {
  const exportedDir = path.join(__dirname, "../exported");
  const htmlPath = path.join(exportedDir, "home.html");

  if (!fs.existsSync(htmlPath)) {
    console.error("No home.html found to normalize.");
    return;
  }

  console.log("Normalizing exported HTML to standard inline Tailwind CSS...");
  const rawHtml = fs.readFileSync(htmlPath, "utf-8");

  // Reconstruct standard head and body but normalize the visual content
  // Extract body content by finding <div id="drawgle-export-root">
  const rootIndex = rawHtml.indexOf('<div id="drawgle-export-root">');
  const endBodyIndex = rawHtml.lastIndexOf('</div>\n    <script>');

  if (rootIndex === -1 || endBodyIndex === -1) {
    console.error("Unable to locate visual root inside home.html.");
    return;
  }

  const innerVisualHtml = rawHtml.substring(rootIndex + 30, endBodyIndex).trim();

  // Normalize!
  const normalizedVisualHtml = normalizeHtmlToStandardTailwind(innerVisualHtml, mockTokens);

  const cleanHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
    <style>
      html, body { margin: 0; min-height: 100%; }
      body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #F9F9F7; }
      #drawgle-export-root { position: relative; min-height: 100vh; overflow-x: hidden; }
      #drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }
      #drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
      ${normalizedVisualHtml}
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      document.querySelectorAll('[data-nav-item-id]').forEach(function(item) {
        var active = item.getAttribute('data-nav-item-id') === "home";
        item.setAttribute('data-active', active ? 'true' : 'false');
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });
    </script>
  </body>
</html>`;

  fs.writeFileSync(htmlPath, cleanHtml, "utf-8");
  console.log("Success! Normalization of exported/home.html completed!");
}

run();

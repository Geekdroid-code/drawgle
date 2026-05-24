"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Copy, Check, Download, Loader2, ChevronDown, Smartphone, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DesignTokens, ScreenData } from "@/lib/types";
import {
  parseScreenHtml,
  generateTokenHeaderComment,
  transpileToSwiftUI,
  transpileToCompose,
  transpileToReactNative,
  transpileToFlutter
} from "@/lib/mobile-transpiler";

interface MobileExportDrawerProps {
  open: boolean;
  onClose: () => void;
  screens: ScreenData[];
  initialScreenId?: string | null;
  navigationCode: string;
  designTokens?: DesignTokens | null;
  tokenCss?: string;
  googleFontAssetLinks?: string;
  activeNavigationItemId?: string | null;
}

type MobileFramework = "html" | "swiftui" | "compose" | "reactnative" | "flutter";

const FILE_SEPARATOR = "// ════════════════════════════════════════════════════════════";

function sanitizeHtmlForExport(html: string): string {
  if (!html) return "";
  return html
    // Strip internal editor-specific attributes
    .replace(/\s*data-drawgle-id="[^"]*"/g, "")
    .replace(/\s*data-drawgle-theme="[^"]*"/g, "")
    .replace(/\s*data-drawgle-icon="[^"]*"/g, "")
    .replace(/\s*data-drawgle-font-preconnect="[^"]*"/g, "")
    .replace(/\s*data-component-type="[^"]*"/g, "")
    .replace(/\s*aria-current="[^"]*"/g, "")
    .replace(/\s*data-active="[^"]*"/g, "")
    .trim();
}

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

function resolveCssVariablesInString(str: string, tokens: DesignTokens | null | undefined): string {
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

function normalizeHtmlToStandardTailwind(html: string, tokens: DesignTokens | null | undefined): string {
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

export function MobileExportDrawer({
  open,
  onClose,
  screens,
  initialScreenId,
  navigationCode,
  designTokens,
  tokenCss,
  googleFontAssetLinks,
  activeNavigationItemId
}: MobileExportDrawerProps) {
  const [activeTab, setActiveTab] = useState<MobileFramework>("html");
  const [copied, setCopied] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialScreenId, setPrevInitialScreenId] = useState<string | null | undefined>(initialScreenId);
  const [activeScreenId, setActiveScreenId] = useState<string>(() => initialScreenId || screens[0]?.id || "");

  if (open !== prevOpen || initialScreenId !== prevInitialScreenId) {
    setPrevOpen(open);
    setPrevInitialScreenId(initialScreenId);
    if (open) {
      setActiveScreenId(initialScreenId || screens[0]?.id || "");
    }
  }

  const [searchQuery, setSearchQuery] = useState("");

  const filteredScreens = useMemo(() => {
    if (!searchQuery.trim()) return screens;
    const query = searchQuery.toLowerCase();
    return screens.filter((screen) => screen.name.toLowerCase().includes(query));
  }, [screens, searchQuery]);

  const activeScreen = useMemo(() => {
    return screens.find((s) => s.id === activeScreenId) || screens[0] || null;
  }, [screens, activeScreenId]);

  const screenName = activeScreen?.name || "Screen";
  const screenCode = activeScreen?.code || "";

  // Clean screen and file names
  const cleanScreenName = useMemo(() => {
    return screenName.replace(/[^a-zA-Z0-9]/g, "");
  }, [screenName]);

  const fileExtensions: Record<MobileFramework, string> = {
    html: "html",
    swiftui: "swift",
    compose: "kt",
    reactnative: "tsx",
    flutter: "dart"
  };
  // Compile the transpiled AST and frameworks once screenCode changes
  const compiledCodes = useMemo(() => {
    if (!open || !screenCode) return null;

    try {
      // ── Sanitize HTML Code for Export (Removes AI/Editor metadata) ──
      const cleanScreen = normalizeHtmlToStandardTailwind(screenCode, designTokens);
      const cleanNav = normalizeHtmlToStandardTailwind(navigationCode, designTokens);

      const bgPrimary = getVal(designTokens, "colors.background-primary", "#F9F9F7");
      const fontFamily = getVal(designTokens, "typography.font-family", "Plus Jakarta Sans");
      const cleanGoogleFont = (googleFontAssetLinks || "").replace(/\s*data-drawgle-font-preconnect="[^"]*"/g, "");

      // ── HTML Export (standalone file — uses raw HTML + Tailwind CDN) ──
      const htmlExport = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script src="https://unpkg.com/lucide@latest"><\/script>
    ${cleanGoogleFont}
    <style>
      html, body { margin: 0; min-height: 100%; }
      body { font-family: '${fontFamily}', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: ${bgPrimary}; }
      #drawgle-export-root { position: relative; min-height: 100vh; overflow-x: hidden; }
      #drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }
      #drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
${cleanScreen}
      ${cleanNav ? `<div id="drawgle-export-navigation">${cleanNav}</div>` : ""}
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      document.querySelectorAll('[data-nav-item-id]').forEach(function(item) {
        var active = item.getAttribute('data-nav-item-id') === ${JSON.stringify(activeNavigationItemId || "home")};
        item.setAttribute('data-active', active ? 'true' : 'false');
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });
    <\/script>
  </body>
</html>`;

      // ── Native Framework Exports (transpiler-based) ──
      const combinedHtml = `<div>
        ${screenCode}
        ${navigationCode ? `<div id="drawgle-navigation-shell">${navigationCode}</div>` : ""}
      </div>`;

      const ast = parseScreenHtml(combinedHtml, designTokens);
      if (!ast) {
        throw new Error("Unable to parse HTML into structured DOM tree.");
      }

      const headers = generateTokenHeaderComment(designTokens);

      // SwiftUI — Two-section output
      const swiftTheme = headers.swift;
      const swiftScreen = `//\n//  ${cleanScreenName}View.swift\n//  Auto-generated by Drawgle\n//\n\nimport SwiftUI\n// Import your project's AppTheme file here\n// import AppTheme\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme class above, you can easily map the exported tokens\n// directly into your project's native theme catalog:\n// - AppTheme.backgroundPrimary ➔ Color("PrimaryBackground")\n// - AppTheme.surfaceCard       ➔ Color("CardBackground")\n// - AppTheme.actionPrimary     ➔ Color.accentColor\n// - AppTheme.textHigh          ➔ Color.primary\n// - AppTheme.borderRadiusApp   ➔ 32.0 (or your custom corner radius parameter)\n\nstruct ${cleanScreenName}View: View {\n    var body: some View {\n        ScrollView {\n` +
        transpileToSwiftUI(ast) +
        `        }\n        .background(AppTheme.backgroundPrimary)\n        .edgesIgnoringSafeArea(.all)\n    }\n}\n\n#Preview {\n    ${cleanScreenName}View()\n}\n`;
      const swiftFull = `${FILE_SEPARATOR}\n// FILE 1: AppTheme.swift — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${swiftTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName}View.swift — Add to your screens directory\n${FILE_SEPARATOR}\n\n${swiftScreen}`;

      // Jetpack Compose — Two-section output
      const composeTheme = headers.compose;
      const composeScreen = `/*\n * ${cleanScreenName}Screen.kt\n * Auto-generated by Drawgle\n */\n\npackage com.drawgle.ui\n\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.rememberScrollState\nimport androidx.compose.foundation.verticalScroll\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.graphics.Color\n// Import your project's AppTheme here\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme class above, you can easily map the exported tokens\n// directly into your project's existing MaterialTheme configuration:\n// - AppTheme.BackgroundPrimary ➔ MaterialTheme.colorScheme.background\n// - AppTheme.SurfaceCard       ➔ MaterialTheme.colorScheme.surface\n// - AppTheme.ActionPrimary     ➔ MaterialTheme.colorScheme.primary\n// - AppTheme.textHigh          ➔ MaterialTheme.colorScheme.onBackground\n// - AppTheme.BorderRadiusApp   ➔ 32.dp (or your custom shape corner constant)\n\n@Composable\nfun ${cleanScreenName}Screen() {\n    Box(\n        modifier = Modifier\n            .fillMaxSize()\n            .background(AppTheme.BackgroundPrimary)\n    ) {\n        Column(\n            modifier = Modifier\n                .fillMaxSize\n                .verticalScroll(rememberScrollState())\n        ) {\n` +
        transpileToCompose(ast) +
        `        }\n    }\n}\n`;
      const composeFull = `${FILE_SEPARATOR}\n// FILE 1: AppTheme.kt — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${composeTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName}Screen.kt — Add to your screens directory\n${FILE_SEPARATOR}\n\n${composeScreen}`;

      // React Native — Two-section output
      const rnTheme = headers.rn;
      const rnScreen = `//\n// ${cleanScreenName}Screen.tsx\n// Auto-generated by Drawgle\n//\n\nimport React from 'react';\nimport {\n  StyleSheet,\n  Text,\n  View,\n  Image,\n  ScrollView,\n  TouchableOpacity,\n  SafeAreaView\n} from 'react-native';\n// Import your project's AppTheme here\n// import { AppTheme } from './path/to/AppTheme';\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme constant above, you can easily map the exported tokens\n// directly into your project's existing StyleSheet theme configuration:\n// - AppTheme.colors.backgroundPrimary ➔ theme.colors.background\n// - AppTheme.colors.surfaceCard       ➔ theme.colors.card\n// - AppTheme.colors.actionPrimary     ➔ theme.colors.primary\n// - AppTheme.colors.textHigh          ➔ theme.colors.text\n// - AppTheme.radii.app                 ➔ theme.borderRadii.large\n\n// Icon placeholder — swap with react-native-vector-icons, expo-icons, or custom SVGs\nfunction Icon({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) {\n  return (\n    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>\n      <Text style={{ color, fontSize: size * 0.8, fontWeight: 'bold' }}>•</Text>\n    </View>\n  );\n}\n\nexport default function ${cleanScreenName}Screen() {\n  return (\n    <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.colors.backgroundPrimary }}>\n      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>\n` +
        transpileToReactNative(ast) +
        `      </ScrollView>\n    </SafeAreaView>\n  );\n}\n`;
      const rnFull = `${FILE_SEPARATOR}\n// FILE 1: AppTheme.ts — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${rnTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName}Screen.tsx — Add to your screens directory\n${FILE_SEPARATOR}\n\n${rnScreen}`;

      // Flutter — Two-section output (NO import 'app_theme.dart' — removed self-referential import)
      const flutterTheme = headers.flutter;
      const flutterScreen = `//\n// ${cleanScreenName.toLowerCase()}_screen.dart\n// Auto-generated by Drawgle\n//\n\nimport 'package:flutter/material.dart';\n// Import your project's AppTheme here\n// import 'package:your_app/theme/app_theme.dart';\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme class above, you can easily map the exported tokens\n// directly to your existing Flutter ColorScheme / TextTheme design system:\n// - AppTheme.backgroundPrimary ➔ Theme.of(context).colorScheme.background\n// - AppTheme.surfaceCard       ➔ Theme.of(context).colorScheme.surface\n// - AppTheme.actionPrimary     ➔ Theme.of(context).colorScheme.primary\n// - AppTheme.textHigh          ➔ Theme.of(context).colorScheme.onBackground\n// - AppTheme.borderRadiusApp   ➔ 32.0 (or your custom double corner constant)\n\nclass ${cleanScreenName}Screen extends StatelessWidget {\n  const ${cleanScreenName}Screen({Key? key}) : super(key: key);\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold( \n      backgroundColor: AppTheme.backgroundPrimary,\n      body: SafeArea(\n        child: SingleChildScrollView(\n          child: ` +
        transpileToFlutter(ast).trim() +
        `,\n        ),\n      ),\n    );\n  }\n}\n`;
      const flutterFull = `${FILE_SEPARATOR}\n// FILE 1: app_theme.dart — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${flutterTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName.toLowerCase()}_screen.dart — Add to your screens directory\n${FILE_SEPARATOR}\n\n${flutterScreen}`;

      return {
        html: htmlExport,
        swiftui: swiftFull,
        compose: composeFull,
        reactnative: rnFull,
        flutter: flutterFull,
        ast
      };
    } catch (err) {
      console.error("Transpilation failed", err);
      return null;
    }
  }, [open, screenCode, navigationCode, designTokens, cleanScreenName, googleFontAssetLinks, activeNavigationItemId]);

  const activeCode = compiledCodes?.[activeTab] || "";

  const handleCopy = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeCode) return;
    const mimeType = activeTab === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([activeCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTab === "flutter" ? cleanScreenName.toLowerCase() : cleanScreenName}.${fileExtensions[activeTab]}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="dg-export-drawer !w-full sm:!w-[540px] sm:!max-w-[540px] border-l border-slate-950/[0.1] bg-white p-0 text-slate-900 shadow-2xl overflow-hidden flex flex-col h-full"
      >
        <div className="flex h-full flex-col min-h-0">
          {/* Header */}
          <SheetHeader className="border-b border-slate-950/[0.08] bg-white px-6 pb-5 pt-6 shrink-0 space-y-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <SheetTitle className="text-[16px] font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm shrink-0">
                      <Smartphone className="h-3.5 w-3.5" />
                    </span>
                    Code Export
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-[13px] text-slate-500">
                    Export high-fidelity compilable code for your screens.
                  </SheetDescription>
                </div>
              </div>

              {/* Ultra-Premium Screen Selector */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#667894]">Active Screen</span>
                  <span className="text-[10px] font-bold text-slate-400">{screens.length} screens total</span>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] px-3.5 text-left text-sm font-semibold text-[var(--dg-text)] shadow-sm transition hover:border-[var(--dg-border-strong)] hover:bg-[var(--dg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--dg-border-strong)] dark:border-white/[0.08] dark:bg-[#252830] dark:text-[#e8eaf0] dark:hover:bg-[#2c3039]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Smartphone className="h-4 w-4 text-[#FF4F00]" />
                          <span className="truncate">{screenName}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 text-[var(--dg-text-muted)] shrink-0" />
                      </button>
                    }
                  />
                  <DropdownMenuContent
                    align="start"
                    className="dg-export-screen-menu flex w-[320px] flex-col gap-2 rounded-[18px] border border-[var(--dg-border)] bg-[var(--dg-surface)] p-2 text-[var(--dg-text)] shadow-[0_20px_70px_rgba(15,23,42,0.2)] dark:border-white/[0.08] dark:bg-[#1c1f26] dark:shadow-[0_20px_70px_rgba(0,0,0,0.58)]"
                  >
                    {/* Live Search Box */}
                    <div className="relative flex items-center px-1 py-0.5">
                      <Search className="absolute left-3.5 h-3.5 w-3.5 text-[var(--dg-text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search screens..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-9 w-full rounded-[12px] border-none bg-[var(--dg-surface-muted)] pl-8 pr-8 text-xs font-semibold text-[var(--dg-text)] outline-none transition placeholder:text-[var(--dg-text-muted)] focus:bg-[var(--dg-surface-muted)] dark:bg-[#252830] dark:text-[#e8eaf0] dark:placeholder:text-[#6f7785]"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery("");
                          }}
                          className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full text-[var(--dg-text-muted)] transition hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] dark:hover:bg-white/10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Scrollable list */}
                    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5 pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent dark:scrollbar-thumb-white/20">
                      {filteredScreens.length > 0 ? (
                        filteredScreens.map((screen) => {
                          const isSelected = activeScreenId === screen.id;
                          return (
                            <DropdownMenuItem
                              key={screen.id}
                              onClick={() => {
                                setActiveScreenId(screen.id);
                                setSearchQuery("");
                              }}
                              className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left transition cursor-pointer ${
                                isSelected
                                  ? "bg-slate-950 text-white focus:bg-slate-900 focus:text-white dark:bg-[#0f172a] dark:text-white dark:ring-1 dark:ring-white/[0.10] dark:focus:bg-[#111c33] dark:focus:text-white"
                                  : "text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] focus:bg-[var(--dg-surface-muted)] dark:text-[#d8dde7] dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]"
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Smartphone className={`h-4 w-4 ${isSelected ? "text-current" : "text-[var(--dg-text-muted)]"}`} />
                                <span className="truncate text-xs font-semibold">{screen.name}</span>
                              </span>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 text-white shrink-0" />
                              )}
                            </DropdownMenuItem>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-xs font-semibold text-[var(--dg-text-muted)]">
                          No screens match &ldquo;{searchQuery}&rdquo;
                        </div>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Segmented Pill Selector Row — 5 tabs including HTML */}
            <div className="mt-6 grid grid-cols-5 gap-1 rounded-[14px] bg-slate-950/[0.04] p-1">
              {(["html", "swiftui", "compose", "reactnative", "flutter"] as MobileFramework[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex h-8 items-center justify-center rounded-[10px] text-[11px] font-semibold transition ${
                      isActive ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab === "html" && "HTML"}
                    {tab === "swiftui" && "SwiftUI"}
                    {tab === "compose" && "Compose"}
                    {tab === "reactnative" && "React Native"}
                    {tab === "flutter" && "Flutter"}
                  </button>
                );
              })}
            </div>
          </SheetHeader>

          {/* Content Area */}
          <div className="flex-1 min-h-0 bg-[#f7f7f8] px-4 py-4 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col rounded-[16px] border border-slate-950/[0.08] bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-950/[0.05] bg-white px-4 py-2 shrink-0">
                <div className="text-[12px] font-medium text-slate-500 font-mono">
                  {activeTab === "html"
                    ? `${cleanScreenName.toLowerCase()}.html`
                    : activeTab === "swiftui"
                    ? `${cleanScreenName}View.swift`
                    : activeTab === "compose"
                    ? `${cleanScreenName}Screen.kt`
                    : activeTab === "reactnative"
                    ? `${cleanScreenName}Screen.tsx`
                    : `${cleanScreenName.toLowerCase()}_screen.dart`}
                </div>
              </div>
              <div className="flex-1 min-h-0 relative font-mono text-[12px] leading-relaxed">
                {compiledCodes ? (
                  <pre className="h-full w-full overflow-auto p-4 text-slate-700 select-text scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <code>{activeCode}</code>
                  </pre>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                    <div className="text-[13px] text-slate-500">Compiling native code...</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs Bottom Bar */}
          <div className="border-t border-slate-950/[0.08] bg-white px-5 py-3 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              disabled={!activeCode}
              className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-semibold text-slate-700 border-slate-950/[0.1] hover:bg-slate-50"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              type="button"
              onClick={handleCopy}
              disabled={!activeCode}
              className="h-8 rounded-[10px] bg-slate-950 px-3 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Code"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import React, { useState, useMemo } from "react";
import { Copy, Check, Download, Loader2, ChevronDown, Smartphone, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PremiumSegmentedTabs, PremiumTabPanel } from "@/components/ui/premium-segmented-tabs";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import type { DesignTokens, ScreenData } from "@/lib/types";
import {
  parseScreenHtml,
  generateTokenHeaderComment,
  transpileToSwiftUI,
  transpileToCompose,
  transpileToReactNative,
  transpileToFlutter,
  extractFixedBottomNodes
} from "@/lib/mobile-transpiler";
import { buildDrawgleTokenCss } from "@/lib/token-runtime";

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

const FRAMEWORK_TABS: Array<{ id: MobileFramework; label: string; compactLabel: string }> = [
  { id: "html", label: "HTML", compactLabel: "HTML" },
  { id: "swiftui", label: "SwiftUI", compactLabel: "Swift" },
  { id: "compose", label: "Compose", compactLabel: "Kotlin" },
  { id: "reactnative", label: "React Native", compactLabel: "RN" },
  { id: "flutter", label: "Flutter", compactLabel: "Flutter" },
];

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
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
      const cleanScreen = sanitizeHtmlForExport(screenCode);
      const cleanNav = sanitizeHtmlForExport(navigationCode);
      const exportTokenCss = tokenCss?.trim() ? tokenCss : buildDrawgleTokenCss(designTokens);
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
${exportTokenCss}
      html, body { margin: 0; min-height: 100%; }
      body {
        font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        background: var(--dg-color-background-primary, #ffffff);
        color: var(--dg-color-text-high-emphasis, #111827);
      }
      #drawgle-export-root {
        position: relative;
        min-height: 100vh;
        overflow-x: hidden;
        background: var(--dg-color-background-primary, #ffffff);
      }
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

      // Extract fixed-bottom nodes (e.g., bottom nav) from main tree
      const { mainTree, fixedBottomNodes } = extractFixedBottomNodes(ast);
      const hasFixedBottom = fixedBottomNodes.length > 0;

      // SwiftUI — Two-section output with ZStack for fixed bottom nav
      const swiftTheme = headers.swift;
      const fixedBottomSwift = fixedBottomNodes.map(n => transpileToSwiftUI(n)).join('');
      const swiftBodyOpen = hasFixedBottom
        ? `        ZStack(alignment: .bottom) {\n            ScrollView {\n`
        : `        ScrollView {\n`;
      const swiftBodyClose = hasFixedBottom
        ? `            }\n${fixedBottomSwift}        }\n`
        : `        }\n`;
      const swiftScreen = `//\n//  ${cleanScreenName}View.swift\n//  Auto-generated by Drawgle\n//\n\nimport SwiftUI\n// Import your project's AppTheme file here\n// import AppTheme\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme class above, you can easily map the exported tokens\n// directly into your project's native theme catalog:\n// - AppTheme.backgroundPrimary ➔ Color("PrimaryBackground")\n// - AppTheme.surfaceCard       ➔ Color("CardBackground")\n// - AppTheme.actionPrimary     ➔ Color.accentColor\n// - AppTheme.textHigh          ➔ Color.primary\n// - AppTheme.borderRadiusApp   ➔ 32.0 (or your custom corner radius parameter)\n\nstruct ${cleanScreenName}View: View {\n    var body: some View {\n` +
        swiftBodyOpen +
        transpileToSwiftUI(mainTree) +
        swiftBodyClose +
        `        .background(AppTheme.backgroundPrimary)\n        .edgesIgnoringSafeArea(.all)\n    }\n}\n\n#Preview {\n    ${cleanScreenName}View()\n}\n`;
      const swiftFull = `${FILE_SEPARATOR}\n// FILE 1: AppTheme.swift — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${swiftTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName}View.swift — Add to your screens directory\n${FILE_SEPARATOR}\n\n${swiftScreen}`;

      // Jetpack Compose — Two-section output with Box for fixed bottom nav
      const composeTheme = headers.compose;
      const fixedBottomCompose = fixedBottomNodes.map(n => transpileToCompose(n)).join('');
      const composeScreen = `/*\n * ${cleanScreenName}Screen.kt\n * Auto-generated by Drawgle\n */\n\npackage com.drawgle.ui\n\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.rememberScrollState\nimport androidx.compose.foundation.verticalScroll\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.graphics.Color\n// Import your project's AppTheme here\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme class above, you can easily map the exported tokens\n// directly into your project's existing MaterialTheme configuration:\n// - AppTheme.BackgroundPrimary ➔ MaterialTheme.colorScheme.background\n// - AppTheme.SurfaceCard       ➔ MaterialTheme.colorScheme.surface\n// - AppTheme.ActionPrimary     ➔ MaterialTheme.colorScheme.primary\n// - AppTheme.textHigh          ➔ MaterialTheme.colorScheme.onBackground\n// - AppTheme.BorderRadiusApp   ➔ 32.dp (or your custom shape corner constant)\n\n@Composable\nfun ${cleanScreenName}Screen() {\n    Box(\n        modifier = Modifier\n            .fillMaxSize()\n            .background(AppTheme.BackgroundPrimary)\n    ) {\n        Column(\n            modifier = Modifier\n                .fillMaxSize\n                .verticalScroll(rememberScrollState())\n        ) {\n` +
        transpileToCompose(mainTree) +
        `        }\n` +
        (hasFixedBottom ? fixedBottomCompose : '') +
        `    }\n}\n`;
      const composeFull = `${FILE_SEPARATOR}\n// FILE 1: AppTheme.kt — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${composeTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName}Screen.kt — Add to your screens directory\n${FILE_SEPARATOR}\n\n${composeScreen}`;

      // React Native — Two-section output with View overlay for fixed bottom nav
      const rnTheme = headers.rn;
      const fixedBottomRN = fixedBottomNodes.map(n => transpileToReactNative(n)).join('');
      const rnScreen = `//\n// ${cleanScreenName}Screen.tsx\n// Auto-generated by Drawgle\n//\n\nimport React from 'react';\nimport {\n  StyleSheet,\n  Text,\n  View,\n  Image,\n  ScrollView,\n  TouchableOpacity,\n  SafeAreaView\n} from 'react-native';\n// Import your project's AppTheme here\n// import { AppTheme } from './path/to/AppTheme';\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme constant above, you can easily map the exported tokens\n// directly into your project's existing StyleSheet theme configuration:\n// - AppTheme.colors.backgroundPrimary ➔ theme.colors.background\n// - AppTheme.colors.surfaceCard       ➔ theme.colors.card\n// - AppTheme.colors.actionPrimary     ➔ theme.colors.primary\n// - AppTheme.colors.textHigh          ➔ theme.colors.text\n// - AppTheme.radii.app                 ➔ theme.borderRadii.large\n\n// Icon placeholder — swap with react-native-vector-icons, expo-icons, or custom SVGs\nfunction Icon({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) {\n  return (\n    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>\n      <Text style={{ color, fontSize: size * 0.8, fontWeight: 'bold' }}>•</Text>\n    </View>\n  );\n}\n\nexport default function ${cleanScreenName}Screen() {\n  return (\n    <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.colors.backgroundPrimary }}>\n` +
        (hasFixedBottom ? `      <View style={{ flex: 1 }}>\n` : '') +
        `      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>\n` +
        transpileToReactNative(mainTree) +
        `      </ScrollView>\n` +
        (hasFixedBottom ? fixedBottomRN + `      </View>\n` : '') +
        `    </SafeAreaView>\n  );\n}\n`;
      const rnFull = `${FILE_SEPARATOR}\n// FILE 1: AppTheme.ts — Add to your project's theme directory\n${FILE_SEPARATOR}\n\n${rnTheme}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanScreenName}Screen.tsx — Add to your screens directory\n${FILE_SEPARATOR}\n\n${rnScreen}`;

      // Flutter — Two-section output with Stack for fixed bottom nav
      const flutterTheme = headers.flutter;
      const fixedBottomFlutter = fixedBottomNodes.map(n => transpileToFlutter(n)).join('');
      const flutterScreen = `//\n// ${cleanScreenName.toLowerCase()}_screen.dart\n// Auto-generated by Drawgle\n//\n\nimport 'package:flutter/material.dart';\n// Import your project's AppTheme here\n// import 'package:your_app/theme/app_theme.dart';\n\n// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:\n// Instead of copying the generated AppTheme class above, you can easily map the exported tokens\n// directly to your existing Flutter ColorScheme / TextTheme design system:\n// - AppTheme.backgroundPrimary ➔ Theme.of(context).colorScheme.background\n// - AppTheme.surfaceCard       ➔ Theme.of(context).colorScheme.surface\n// - AppTheme.actionPrimary     ➔ Theme.of(context).colorScheme.primary\n// - AppTheme.textHigh          ➔ Theme.of(context).colorScheme.onBackground\n// - AppTheme.borderRadiusApp   ➔ 32.0 (or your custom double corner constant)\n\nclass ${cleanScreenName}Screen extends StatelessWidget {\n  const ${cleanScreenName}Screen({Key? key}) : super(key: key);\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold( \n      backgroundColor: AppTheme.backgroundPrimary,\n      body: SafeArea(\n` +
        (hasFixedBottom
          ? `        child: Stack(\n          children: [\n            SingleChildScrollView(\n              child: ` + transpileToFlutter(mainTree).trim() + `,\n            ),\n` + fixedBottomFlutter + `          ],\n        ),\n`
          : `        child: SingleChildScrollView(\n          child: ` + transpileToFlutter(mainTree).trim() + `,\n        ),\n`) +
        `      ),\n    );\n  }\n}\n`;
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
  }, [open, screenCode, navigationCode, designTokens, cleanScreenName, googleFontAssetLinks, activeNavigationItemId, tokenCss]);

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
                
                <PremiumDropdown
                  align="start"
                  width={320}
                  className="w-full"
                  open={dropdownOpen}
                  onOpenChange={setDropdownOpen}
                  trigger={
                    <button
                      type="button"
                      className="flex h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] px-3.5 text-left text-sm font-semibold text-[var(--dg-text)] shadow-sm transition hover:border-[var(--dg-border-strong)] hover:bg-[var(--dg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--dg-border-strong)] dark:border-white/[0.08] dark:bg-[#2a2a2a] dark:text-[#e8eaf0] dark:hover:bg-[#2c3039]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Smartphone className="h-4 w-4 text-[#FF4F00]" />
                        <span className="truncate">{screenName}</span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-[var(--dg-text-muted)] shrink-0" />
                    </button>
                  }
                >
                  <div className="flex flex-col gap-2 p-1 font-sans">
                    {/* Live Search Box */}
                    <div className="relative flex items-center px-1 py-0.5">
                      <Search className="absolute left-3.5 h-3.5 w-3.5 text-[var(--dg-text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search screens..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-9 w-full rounded-[12px] border-none bg-[var(--dg-surface-muted)] pl-8 pr-8 text-xs font-semibold text-[var(--dg-text)] outline-none transition placeholder:text-[var(--dg-text-muted)] focus:bg-[var(--dg-surface-muted)] dark:bg-[#2a2a2a] dark:text-[#e8eaf0] dark:placeholder:text-[#6f7785]"
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
                    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5 pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent dark:scrollbar-thumb-white/20 text-left">
                      {filteredScreens.length > 0 ? (
                        filteredScreens.map((screen) => {
                          const isSelected = activeScreenId === screen.id;
                          return (
                            <button
                              type="button"
                              key={screen.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveScreenId(screen.id);
                                setSearchQuery("");
                                setDropdownOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left transition cursor-pointer border-none outline-none ${
                                isSelected
                                  ? "bg-slate-950 text-white dark:bg-[#0f172a] dark:text-white dark:ring-1 dark:ring-white/[0.10]"
                                  : "text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] dark:text-[#d8dde7] dark:hover:bg-white/[0.06]"
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Smartphone className={`h-4 w-4 ${isSelected ? "text-current" : "text-[var(--dg-text-muted)]"}`} />
                                <span className="truncate text-xs font-semibold">{screen.name}</span>
                              </span>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 text-white shrink-0" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-xs font-semibold text-[var(--dg-text-muted)]">
                          No screens match &ldquo;{searchQuery}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                </PremiumDropdown>
              </div>
            </div>
            
            {/* Segmented Pill Selector Row — 5 tabs including HTML */}
            <PremiumSegmentedTabs
              items={FRAMEWORK_TABS}
              value={activeTab}
              onValueChange={setActiveTab}
              size="sm"
              layoutId="export-framework-tab"
              className="mt-6"
              tabClassName="px-1 text-[10px] sm:text-[11px]"
            />
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
                <PremiumTabPanel panelKey={activeTab} className="h-full">
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
                </PremiumTabPanel>
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

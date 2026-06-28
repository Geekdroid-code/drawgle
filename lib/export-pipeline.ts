import { strToU8, zipSync } from "fflate";

import { buildPublicDesignMdDocument } from "@/lib/design-md";
import {
  extractFixedBottomNodes,
  generateTokenHeaderComment,
  parseScreenHtml,
  transpileToCompose,
  transpileToFlutter,
  transpileToReactNative,
  transpileToSwiftUI,
} from "@/lib/mobile-transpiler";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { buildDrawgleTokenCss, buildGoogleFontAssetLinks } from "@/lib/token-runtime";
import {
  buildProductionVariableMap,
  buildTailwindConfigScript,
  compileHtmlForProduction,
  compileStylesheetForProduction,
} from "@/lib/html-compiler";
import type {
  DesignTokens,
  ProjectData,
  ProjectNavigationData,
  ScreenData,
} from "@/lib/types";

export type AgentTarget = "auto" | "html" | "reactnative" | "swiftui" | "compose" | "flutter";
export type NativeScaffoldTarget = Exclude<AgentTarget, "auto" | "html">;

export type ExportProjectContext = {
  project: ProjectData;
  screens: ScreenData[];
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  tokenCss?: string;
  googleFontAssetLinks?: string;
};

export type NativeScaffoldResult = {
  code: string | null;
  error: string | null;
};

export type NativeScaffoldFilesResult = {
  files: Record<string, string> | null;
  error: string | null;
};

export type NativeScaffoldZipResult = {
  bytes: Uint8Array | null;
  error: string | null;
};
export type CompiledExportSnapshot = {
  standaloneHtml: string;
  cleanScreenHtml: string;
  cleanNavigationHtml: string;
  activeNavigationItemId: string;
  tokenCss: string;
  googleFontAssetLinks: string;
  warnings: string[];
};
const FILE_SEPARATOR = "// ============================================================";

export function slugifyExportName(value: string, fallback = "drawgle-screen") {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || fallback;
}

export function cleanExportName(value: string, fallback = "Screen") {
  return value.replace(/[^a-zA-Z0-9]/g, "") || fallback;
}

export function sanitizeHtmlForExport(html: string) {
  if (!html) return "";
  const exportedAttribute = (name: string) =>
    new RegExp(`\\s*${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>]+)`, "gi");
  return html
    .replace(exportedAttribute("data-drawgle-id"), "")
    .replace(exportedAttribute("data-drawgle-theme"), "")
    .replace(exportedAttribute("data-drawgle-icon"), "")
    .replace(exportedAttribute("data-drawgle-font-preconnect"), "")
    .replace(exportedAttribute("data-component-type"), "")
    .replace(exportedAttribute("aria-current"), "")
    .replace(exportedAttribute("data-active"), "")
    .trim();
}

export function resolveScreenNavigationCode(
  screen: ScreenData,
  projectNavigation?: ProjectNavigationData | null,
) {
  if (!projectNavigation?.shellCode || !screen.chromePolicy?.showPrimaryNavigation) {
    return "";
  }
  return projectNavigation.shellCode;
}

const NAV_SPACER_PATTERN = /<!--\s*(?:floating\s+dock|bottom\s+nav|navigation)[\s\S]*?placeholder[\s\S]*?-->\s*<div\b[^>]*(?:h-\[[^\]]*(?:8[0-9]|9[0-9]|1[0-9]{2})px\]|height\s*:\s*(?:8[0-9]|9[0-9]|1[0-9]{2})px)[^>]*>\s*<\/div>/gi;

const isLikelySharedNavigationElement = (element: Element) => {
  const tag = element.tagName.toLowerCase();
  const id = element.getAttribute("id") ?? "";
  const cls = element.getAttribute("class") ?? "";
  const style = element.getAttribute("style") ?? "";
  const text = element.textContent ?? "";

  if (element.hasAttribute("data-drawgle-primary-nav")) return true;
  if (/drawgle-(?:export-)?navigation|navigation-shell/i.test(id)) return true;
  if (element.querySelector("[data-drawgle-primary-nav]")) return true;

  const hasNavItems = element.querySelectorAll("[data-nav-item-id]").length > 0;
  const looksFixedBottom = /(?:^|\s)(?:fixed|bottom-0|inset-x-0|z-\[?80\]?)(?:\s|$)/i.test(cls)
    || /position\s*:\s*fixed/i.test(style)
    || /bottom\s*:\s*0/i.test(style);
  const looksNavigation = /bottom|tab|navigation|navbar|nav|dock/i.test([id, cls, text].join(" "));

  if (hasNavItems && (looksFixedBottom || looksNavigation || tag === "nav" || tag === "footer")) {
    return true;
  }

  if ((tag === "nav" || tag === "footer") && looksNavigation) {
    return true;
  }

  return looksFixedBottom && looksNavigation;
};

const stripSharedNavigationMarkup = (code: string) => {
  const withoutKnownSpacer = code.replace(NAV_SPACER_PATTERN, "");

  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div data-drawgle-strip-root>${withoutKnownSpacer}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (root) {
      const candidates = Array.from(root.querySelectorAll("*"))
        .filter((element) => isLikelySharedNavigationElement(element))
        .sort((a, b) => {
          if (a.contains(b)) return -1;
          if (b.contains(a)) return 1;
          return 0;
        });

      for (const element of candidates) {
        if (element.isConnected && root.contains(element)) {
          element.remove();
        }
      }

      return root.innerHTML.trim();
    }
  }

  return withoutKnownSpacer
    .replace(NAV_SPACER_PATTERN, "")
    .replace(/<div\b[^>]*(?:drawgle-(?:export-)?navigation|navigation-shell)[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, (match) =>
      /bottom|tab|navigation|nav|dock|data-drawgle-primary-nav|data-nav-item-id/i.test(match) ? "" : match,
    )
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, (match) =>
      /bottom|tab|navigation|nav|dock|data-nav-item-id/i.test(match) ? "" : match,
    )
    .trim();
};

export function buildCompiledExportSnapshot({
  screen,
  navigationCode = "",
  activeNavigationItemId,
  designTokens,
  tokenCss,
  googleFontAssetLinks,
}: {
  screen: ScreenData;
  navigationCode?: string;
  activeNavigationItemId?: string | null;
  designTokens?: DesignTokens | null;
  tokenCss?: string;
  googleFontAssetLinks?: string;
}): CompiledExportSnapshot {
  // 1. Compile the HTML codes to resolve design tokens and clean up classes/styles.
  const isNavActive = !!navigationCode;
  const screenCode = isNavActive ? stripSharedNavigationMarkup(screen.code) : screen.code;

  const compiledScreen = compileHtmlForProduction(screenCode, designTokens, tokenCss);
  const compiledNavigation = compileHtmlForProduction(navigationCode, designTokens, tokenCss);

  // 2. Sanitize and remove editor-specific attributes.
  const cleanScreen = sanitizeHtmlForExport(compiledScreen);
  const cleanNavigation = sanitizeHtmlForExport(compiledNavigation);

  // 3. Resolve CSS variables for default styles from the same live token CSS
  // used by the canvas preview. Design tokens remain the fallback source.
  const varMap = buildProductionVariableMap(designTokens, tokenCss);
  const exportTokenCss = compileStylesheetForProduction(varMap);
  const cleanActiveNavigationItemId = activeNavigationItemId || "";

  const cleanGoogleFont = (googleFontAssetLinks || buildGoogleFontAssetLinks(designTokens))
    .replace(/\s*data-drawgle-font-preconnect="[^"]*"/g, "");

  const standaloneHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    ${buildTailwindConfigScript()}
    <script src="https://unpkg.com/lucide@latest"><\/script>
    ${cleanGoogleFont}
    <style>
${exportTokenCss}
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
${cleanScreen}
      ${cleanNavigation ? `<div id="drawgle-export-navigation">${cleanNavigation}</div>` : ""}
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
      document.querySelectorAll("[data-nav-item-id]").forEach(function(item) {
        var active = item.getAttribute("data-nav-item-id") === ${JSON.stringify(cleanActiveNavigationItemId)};
        item.setAttribute("data-active", active ? "true" : "false");
        item.setAttribute("aria-current", active ? "page" : "false");
      });
    <\/script>
  </body>
</html>`;

  return {
    standaloneHtml,
    cleanScreenHtml: cleanScreen,
    cleanNavigationHtml: cleanNavigation,
    activeNavigationItemId: cleanActiveNavigationItemId,
    tokenCss: exportTokenCss,
    googleFontAssetLinks: cleanGoogleFont,
    warnings: [],
  };
}

export function buildStandaloneHtmlExport(input: Parameters<typeof buildCompiledExportSnapshot>[0]) {
  return buildCompiledExportSnapshot(input).standaloneHtml;
}

export function buildScreenOnlyHtmlExport(input: Parameters<typeof buildCompiledExportSnapshot>[0]) {
  const snapshot = buildCompiledExportSnapshot(input);
  const screenOnlyTokenCss = snapshot.tokenCss
    .split("\n")
    .filter((line) => !line.includes("#drawgle-export-navigation"))
    .join("\n");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    ${buildTailwindConfigScript()}
    <script src="https://unpkg.com/lucide@latest"><\/script>
    ${snapshot.googleFontAssetLinks}
    <style>
${screenOnlyTokenCss}
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
${snapshot.cleanScreenHtml}
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
    <\/script>
  </body>
</html>`;
}
const TARGET_INSTRUCTIONS: Record<AgentTarget, string> = {
  auto: "Inspect the repository and determine the active UI framework, architecture, language, and platform conventions before implementing.",
  html: "Implement this screen as accessible HTML and Tailwind CSS that matches the repository's existing web conventions.",
  reactnative: "Implement this screen in React Native using the repository's existing navigation, styling, component, and icon conventions.",
  swiftui: "Implement this screen in SwiftUI using the repository's existing navigation, theme, component, and asset conventions.",
  compose: "Implement this screen in Jetpack Compose using the repository's existing Material theme, navigation, component, and icon conventions.",
  flutter: "Implement this screen in Flutter using the repository's existing theme, navigation, widget, and asset conventions.",
};

const TARGET_LABELS: Record<AgentTarget, string> = {
  auto: "Auto-detect from repository",
  html: "HTML / Tailwind",
  reactnative: "React Native",
  swiftui: "SwiftUI",
  compose: "Jetpack Compose",
  flutter: "Flutter",
};

export function buildAgentHandoffPrompt({
  context,
  screen,
  target,
}: {
  context: ExportProjectContext;
  screen: ScreenData;
  target: AgentTarget;
}) {
  const designTokens = context.designTokens ?? context.project.designTokens ?? null;
  const designMd = buildPublicDesignMdDocument({
    project: context.project,
    projectNavigation: context.projectNavigation,
    tokenDraft: designTokens,
  });
  const navigationCode = resolveScreenNavigationCode(screen, context.projectNavigation);
  const compiledSnapshot = buildCompiledExportSnapshot({
    screen,
    navigationCode,
    activeNavigationItemId: screen.navigationItemId,
    designTokens,
    tokenCss: context.tokenCss,
    googleFontAssetLinks: context.googleFontAssetLinks,
  });

  return `# Drawgle UI implementation handoff

Implement the selected Drawgle screen in this repository. The compiled standalone HTML below is the visual source of truth; adapt it to the repository instead of treating it as production application code.

## Target

${TARGET_LABELS[target]}

${TARGET_INSTRUCTIONS[target]}

## Repository-first workflow

1. Inspect the repository structure, package/build configuration, UI framework, navigation, theme, reusable components, and coding conventions.
2. Reuse the project's existing design system and components wherever possible. Map Drawgle token roles into the local theme rather than creating a competing theme.
3. Implement the screen in the appropriate existing folder and connect it to existing navigation only when that matches the repository's architecture.
4. Preserve the screen's visual hierarchy, content, spacing rhythm, surfaces, and interaction intent.
5. Do not use a WebView or embed the HTML unless the target is explicitly HTML / Tailwind.
6. Run the repository's relevant formatter, typecheck, tests, and build. Fix implementation errors before finishing.

## Design brief

${designMd}

## Compiled standalone HTML visual source

\`\`\`html
${compiledSnapshot.standaloneHtml}
\`\`\`

## Compiled shared navigation HTML

${compiledSnapshot.cleanNavigationHtml ? `\`\`\`html\n${compiledSnapshot.cleanNavigationHtml}\n\`\`\`` : "This screen does not use the shared Drawgle navigation shell."}

## Acceptance checklist

- The implementation fits the repository's existing architecture and naming conventions.
- The result is native to the selected or detected framework, not a WebView wrapper.
- Visual hierarchy, token roles, spacing, typography, surfaces, and navigation intent match the Drawgle source.
- Existing reusable components and theme primitives are preferred over duplicate implementations.
- Relevant formatter, typecheck, tests, and build complete successfully, with errors self-corrected.
`;
}

const AGENT_SKILL = `---
name: drawgle-ui-handoff
description: Implement Drawgle HTML screens using project-native components and design-system conventions.
---

# Drawgle UI Handoff

When a task references Drawgle or files under \`.drawgle/\`:

1. Read \`.drawgle/handoff.md\`, \`.drawgle/design.md\`, and \`.drawgle/manifest.json\`.
2. Inspect the repository before choosing files, dependencies, navigation, or UI primitives.
3. Treat \`.drawgle/screens/*.html\` as screen content visual references only, not production application code.
4. If \`.drawgle/navigation.html\` exists, implement it once as shared app navigation in the router/layout/app shell. Do not copy navigation markup into each screen.
5. Pass active tab or route state from the shell into the shared navigation component.
6. Map the exported design tokens to the repository's existing theme and reusable components.
7. Implement framework-native UI. Do not use a WebView unless explicitly requested.
8. Run the repository's relevant formatter, typecheck, tests, and build, then fix failures.
`;

export function buildAgentPackFiles({
  context,
  target = "auto",
}: {
  context: ExportProjectContext;
  target?: AgentTarget;
}) {
  const designTokens = context.designTokens ?? context.project.designTokens ?? null;
  const tokenCss = context.tokenCss?.trim() || buildDrawgleTokenCss(designTokens);
  const designMd = buildPublicDesignMdDocument({
    project: context.project,
    projectNavigation: context.projectNavigation,
    tokenDraft: designTokens,
  });
  const normalizedTokens = normalizeDesignTokens(designTokens ?? {});
  const usedScreenPaths = new Set<string>();
  const screenEntries = context.screens.map((screen, index) => {
    const baseSlug = slugifyExportName(screen.name, `screen-${index + 1}`);
    let slug = baseSlug;
    let suffix = 2;
    while (usedScreenPaths.has(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }
    usedScreenPaths.add(slug);
    return {
      id: screen.id,
      name: screen.name,
      file: `.drawgle/screens/${slug}.html`,
      chrome: screen.chromePolicy?.chrome ?? null,
      navigationItemId: screen.navigationItemId ?? null,
    };
  });
  const manifest = {
    format: "drawgle-agent-pack",
    version: 1,
    project: {
      id: context.project.id,
      name: context.project.name,
      prompt: context.project.prompt,
    },
    target,
    screens: screenEntries,
    navigation: context.projectNavigation?.plan ?? null,
  };
  const handoff = `# Drawgle project handoff

Implement the Drawgle screens in this repository using the repository's existing framework, architecture, navigation, theme, and reusable components.

## Start here

1. Inspect the repository before editing.
2. Read \`.drawgle/design.md\`, \`.drawgle/design-tokens.json\`, and \`.drawgle/manifest.json\`.
3. Use \`.drawgle/screens/*.html\` as screen content visual references only.
4. If \`.drawgle/navigation.html\` exists, implement it once as shared app navigation in the router/layout/app shell.
5. Do not copy navigation markup into each screen; pass active tab or route state from the shell into the shared navigation component.
6. ${TARGET_INSTRUCTIONS[target]}
7. Do not use a WebView or ship the HTML as an embedded page unless HTML / Tailwind is explicitly the target.
8. Run the repository's relevant formatter, typecheck, tests, and build. Fix failures before finishing.

## Project

- Name: ${context.project.name}
- Original brief: ${context.project.prompt || "No original brief provided."}
- Target preference: ${TARGET_LABELS[target]}
- Screens: ${context.screens.map((screen) => screen.name).join(", ")}
`;

  const files: Record<string, string> = {
    ".drawgle/README.md": `# Drawgle Agent Pack

This folder contains portable design context and HTML visual references for local coding agents.

Screens in \`.drawgle/screens/\` are content views only. When \`.drawgle/navigation.html\` exists, treat it as the one shared navigation component and wire it through your app shell/router/layout with active tab or route state.

Ask your agent:

> Read .drawgle/handoff.md and implement the Drawgle screens in this repository.

No root instruction files are included or overwritten.
`,
    ".drawgle/handoff.md": handoff,
    ".drawgle/manifest.json": JSON.stringify(manifest, null, 2),
    ".drawgle/design.md": designMd,
    ".drawgle/design-tokens.json": JSON.stringify(normalizedTokens.tokens ?? {}, null, 2),
    ".drawgle/design-tokens.css": tokenCss,
    ".agents/skills/drawgle-ui-handoff/SKILL.md": AGENT_SKILL,
    ".claude/skills/drawgle-ui-handoff/SKILL.md": AGENT_SKILL,
  };

  if (context.projectNavigation?.shellCode?.trim()) {
    files[".drawgle/navigation.html"] = sanitizeHtmlForExport(context.projectNavigation.shellCode);
  }

  for (const [index, screen] of context.screens.entries()) {
    files[screenEntries[index].file] = buildScreenOnlyHtmlExport({
      screen,
      navigationCode: resolveScreenNavigationCode(screen, context.projectNavigation),
      activeNavigationItemId: screen.navigationItemId,
      designTokens,
      tokenCss,
      googleFontAssetLinks: context.googleFontAssetLinks,
    });
  }

  return files;
}

export function buildAgentPackZip(input: Parameters<typeof buildAgentPackFiles>[0]) {
  const files = buildAgentPackFiles(input);
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([path, contents]) => [path, strToU8(contents)])),
    { level: 6 },
  );
}

function snakeExportName(value: string, fallback = "screen") {
  return slugifyExportName(value, fallback).replace(/-/g, "_");
}

function pascalExportName(value: string, fallback = "Screen") {
  return cleanExportName(value, fallback);
}

function parseScaffoldTree({
  html,
  designTokens,
  tokenCss,
}: {
  html: string;
  designTokens?: DesignTokens | null;
  tokenCss: string;
}) {
  return parseScreenHtml(`<div><style>${tokenCss}</style>${html}</div>`, designTokens);
}

function buildNavigationTree({
  navigationCode,
  designTokens,
  tokenCss,
}: {
  navigationCode: string;
  designTokens?: DesignTokens | null;
  tokenCss: string;
}) {
  if (!navigationCode.trim()) return null;
  const navAst = parseScaffoldTree({ html: navigationCode, designTokens, tokenCss });
  if (!navAst) return null;
  const extracted = extractFixedBottomNodes(navAst);
  return extracted.fixedBottomNodes[0] ?? extracted.mainTree;
}

export function buildNativeScaffoldFiles({
  screen,
  target,
  navigationCode = "",
  designTokens,
  tokenCss,
}: {
  screen: ScreenData;
  target: NativeScaffoldTarget;
  navigationCode?: string;
  designTokens?: DesignTokens | null;
  tokenCss?: string;
}): NativeScaffoldFilesResult {
  try {
    const exportTokenCss = tokenCss?.trim() || buildDrawgleTokenCss(designTokens);
    const screenAst = parseScaffoldTree({
      html: stripSharedNavigationMarkup(screen.code),
      designTokens,
      tokenCss: exportTokenCss,
    });
    if (!screenAst) {
      throw new Error("Unable to parse this screen into a structural scaffold.");
    }

    const { mainTree } = extractFixedBottomNodes(screenAst);
    const navTree = buildNavigationTree({ navigationCode, designTokens, tokenCss: exportTokenCss });
    const cleanName = pascalExportName(screen.name);
    const screenSlug = slugifyExportName(screen.name, "screen");
    const screenSnake = snakeExportName(screen.name, "screen");
    const activeTab = screen.navigationItemId || screenSlug;
    const headers = generateTokenHeaderComment(designTokens);
    const files: Record<string, string> = {};

    if (target === "reactnative") {
      files["src/theme/AppTheme.ts"] = headers.rn;
      files[`src/screens/${cleanName}Screen.tsx`] = `import React from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppTheme } from "../theme/AppTheme";

function Icon({ size = 24, color = "#000" }: { name: string; size?: number; color?: string }) {
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Text style={{ color }}>*</Text></View>;
}

export default function ${cleanName}Screen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.colors.backgroundPrimary }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
${transpileToReactNative(mainTree)}      </ScrollView>
    </SafeAreaView>
  );
}
`;

      if (navTree) {
        files["src/navigation/DrawgleBottomNavigation.tsx"] = `import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

function Icon({ size = 24, color = "#000" }: { name: string; size?: number; color?: string }) {
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Text style={{ color }}>*</Text></View>;
}

type DrawgleBottomNavigationProps = {
  activeTab: string;
  onTabPress: (tab: string) => void;
};

export function DrawgleBottomNavigation({ activeTab, onTabPress }: DrawgleBottomNavigationProps) {
  void activeTab;
  void onTabPress;
  return (
${transpileToReactNative(navTree)}  );
}
`;
      }

      files["src/navigation/AppShell.tsx"] = `import React, { useState } from "react";
import { View } from "react-native";
import ${cleanName}Screen from "../screens/${cleanName}Screen";
${navTree ? 'import { DrawgleBottomNavigation } from "./DrawgleBottomNavigation";' : ""}

export default function AppShell() {
  const [activeTab, setActiveTab] = useState(${JSON.stringify(activeTab)});

  return (
    <View style={{ flex: 1 }}>
      <${cleanName}Screen />
${navTree ? '      <DrawgleBottomNavigation activeTab={activeTab} onTabPress={setActiveTab} />' : ""}
    </View>
  );
}
`;

      return { files, error: null };
    }

    if (target === "flutter") {
      files["lib/theme/app_theme.dart"] = headers.flutter;
      files[`lib/screens/${screenSnake}_screen.dart`] = `import "package:flutter/material.dart";
import "../theme/app_theme.dart";

class ${cleanName}Screen extends StatelessWidget {
  const ${cleanName}Screen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundPrimary,
      body: SafeArea(
        child: SingleChildScrollView(
          child: ${transpileToFlutter(mainTree).trim()},
        ),
      ),
    );
  }
}
`;

      if (navTree) {
        files["lib/navigation/drawgle_bottom_navigation.dart"] = `import "package:flutter/material.dart";
import "../theme/app_theme.dart";

class DrawgleBottomNavigation extends StatelessWidget {
  const DrawgleBottomNavigation({super.key, required this.activeTab, required this.onTabSelected});

  final String activeTab;
  final ValueChanged<String> onTabSelected;

  @override
  Widget build(BuildContext context) {
    return ${transpileToFlutter(navTree).trim()};
  }
}
`;
      }

      files["lib/navigation/app_shell.dart"] = `import "package:flutter/material.dart";
import "../screens/${screenSnake}_screen.dart";
${navTree ? 'import "drawgle_bottom_navigation.dart";' : ""}

class DrawgleAppShell extends StatefulWidget {
  const DrawgleAppShell({super.key});

  @override
  State<DrawgleAppShell> createState() => _DrawgleAppShellState();
}

class _DrawgleAppShellState extends State<DrawgleAppShell> {
  String activeTab = ${JSON.stringify(activeTab)};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: const ${cleanName}Screen(),
${navTree ? '      bottomNavigationBar: DrawgleBottomNavigation(activeTab: activeTab, onTabSelected: (tab) => setState(() => activeTab = tab)),' : ""}
    );
  }
}
`;

      return { files, error: null };
    }

    if (target === "swiftui") {
      files["Sources/AppTheme.swift"] = headers.swift;
      files[`Sources/${cleanName}View.swift`] = `import SwiftUI

struct ${cleanName}View: View {
    var body: some View {
        ScrollView {
${transpileToSwiftUI(mainTree)}        }
        .background(AppTheme.backgroundPrimary)
    }
}
`;

      if (navTree) {
        files["Sources/DrawgleBottomNavigation.swift"] = `import SwiftUI

struct DrawgleBottomNavigation: View {
    let activeTab: String
    let onTabSelected: (String) -> Void

    var body: some View {
${transpileToSwiftUI(navTree)}    }
}
`;
      }

      files["Sources/AppShell.swift"] = `import SwiftUI

struct DrawgleAppShell: View {
    @State private var activeTab = ${JSON.stringify(activeTab)}

    var body: some View {
        ZStack(alignment: .bottom) {
            ${cleanName}View()
${navTree ? '            DrawgleBottomNavigation(activeTab: activeTab, onTabSelected: { selectedTab in activeTab = selectedTab })' : ""}
        }
    }
}
`;

      return { files, error: null };
    }

    files["app/src/main/java/com/drawgle/theme/AppTheme.kt"] = headers.compose;
    files[`app/src/main/java/com/drawgle/ui/${cleanName}Screen.kt`] = `package com.drawgle.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.drawgle.theme.AppTheme

@Composable
fun ${cleanName}Screen() {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
${transpileToCompose(mainTree)}    }
}
`;

    if (navTree) {
      files["app/src/main/java/com/drawgle/navigation/DrawgleBottomNavigation.kt"] = `package com.drawgle.navigation

import androidx.compose.runtime.Composable

@Composable
fun DrawgleBottomNavigation(activeTab: String, onTabSelected: (String) -> Unit) {
    activeTab.length
    onTabSelected
${transpileToCompose(navTree)}}
`;
    }

    files["app/src/main/java/com/drawgle/navigation/AppShell.kt"] = `package com.drawgle.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.drawgle.ui.${cleanName}Screen

@Composable
fun DrawgleAppShell() {
    var activeTab by remember { mutableStateOf(${JSON.stringify(activeTab)}) }
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        ${cleanName}Screen()
${navTree ? '        DrawgleBottomNavigation(activeTab = activeTab, onTabSelected = { activeTab = it })' : ""}
    }
}
`;

    return { files, error: null };
  } catch (error) {
    return {
      files: null,
      error: error instanceof Error ? error.message : "This Beta Scaffold could not be generated.",
    };
  }
}

export function buildNativeScaffoldZip(input: Parameters<typeof buildNativeScaffoldFiles>[0]): NativeScaffoldZipResult {
  const result = buildNativeScaffoldFiles(input);
  if (result.error || !result.files) {
    return { bytes: null, error: result.error || "This Beta Scaffold could not be generated." };
  }

  return {
    bytes: zipSync(
      Object.fromEntries(Object.entries(result.files).map(([path, contents]) => [path, strToU8(contents)])),
      { level: 6 },
    ),
    error: null,
  };
}

export function buildNativeScaffold(input: Parameters<typeof buildNativeScaffoldFiles>[0]): NativeScaffoldResult {
  const result = buildNativeScaffoldFiles(input);
  if (result.error || !result.files) {
    return { code: null, error: result.error || "This Beta Scaffold could not be generated." };
  }

  return {
    code: Object.entries(result.files)
      .map(([path, contents]) => `${FILE_SEPARATOR}\n// FILE: ${path}\n${FILE_SEPARATOR}\n\n${contents}`)
      .join("\n"),
    error: null,
  };
}

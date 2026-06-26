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
import { buildDrawgleTokenCss, buildGoogleFontAssetLinks, flattenDesignTokensToCssVariables } from "@/lib/token-runtime";
import {
  compileHtmlForProduction,
  compileStylesheetForProduction,
  resolveCssVariables,
  buildTailwindConfigScript,
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

const stripSharedNavigationMarkup = (code: string) =>
  code
    .replace(/<!--\s*(?:floating\s+dock|bottom\s+nav|navigation)[\s\S]*?placeholder[\s\S]*?-->\s*<div\b[^>]*(?:h-\[[^\]]*(?:8[0-9]|9[0-9]|1[0-9]{2})px\]|height\s*:\s*(?:8[0-9]|9[0-9]|1[0-9]{2})px)[^>]*>\s*<\/div>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, (match) =>
      /bottom|tab|navigation|nav|data-drawgle-primary-nav/i.test(match) ? "" : match,
    )
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, (match) =>
      /bottom|tab|navigation|nav/i.test(match) ? "" : match,
    )
    .trim();

export function buildStandaloneHtmlExport({
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
}) {
  // 1. Compile the HTML codes to resolve design tokens and clean up classes/styles
  const isNavActive = !!navigationCode;
  const screenCode = isNavActive ? stripSharedNavigationMarkup(screen.code) : screen.code;

  const compiledScreen = compileHtmlForProduction(screenCode, designTokens);
  const compiledNavigation = compileHtmlForProduction(navigationCode, designTokens);

  // 2. Sanitize and remove editor-specific attributes
  const cleanScreen = sanitizeHtmlForExport(compiledScreen);
  const cleanNavigation = sanitizeHtmlForExport(compiledNavigation);

  // 3. Resolve CSS variables for default styles
  const normalized = normalizeDesignTokens(designTokens ?? {});
  const variables = flattenDesignTokensToCssVariables(normalized);
  const varMap = new Map<string, string>();
  variables.forEach(v => {
    varMap.set(v.name, v.value);
  });

  const exportTokenCss = compileStylesheetForProduction(varMap);

  const cleanGoogleFont = (googleFontAssetLinks || buildGoogleFontAssetLinks(designTokens))
    .replace(/\s*data-drawgle-font-preconnect="[^"]*"/g, "");

  return `<!DOCTYPE html>
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
        var active = item.getAttribute("data-nav-item-id") === ${JSON.stringify(activeNavigationItemId || "")};
        item.setAttribute("data-active", active ? "true" : "false");
        item.setAttribute("aria-current", active ? "page" : "false");
      });
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
  const normalizedTokens = normalizeDesignTokens(designTokens ?? {});
  const navigationPlan = context.projectNavigation?.plan ?? null;

  return `# Drawgle UI implementation handoff

Implement the selected Drawgle screen in this repository. The HTML below is the visual source of truth; adapt it to the repository instead of treating it as production application code.

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

## Selected screen

- Project: ${context.project.name}
- Screen: ${screen.name}
- Screen summary: ${screen.summary?.trim() || screen.prompt?.trim() || "No additional screen summary provided."}
- Chrome: ${screen.chromePolicy?.chrome || "Use repository conventions"}
- Navigation item: ${screen.navigationItemId || "None"}

## Design brief

${designMd}

## Universal design tokens

\`\`\`json
${JSON.stringify(normalizedTokens.tokens ?? {}, null, 2)}
\`\`\`

## Navigation plan

\`\`\`json
${JSON.stringify(navigationPlan, null, 2)}
\`\`\`

## Selected screen HTML

\`\`\`html
${sanitizeHtmlForExport(screen.code)}
\`\`\`

## Shared navigation HTML

${navigationCode ? `\`\`\`html\n${sanitizeHtmlForExport(navigationCode)}\n\`\`\`` : "This screen does not use the shared Drawgle navigation shell."}

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
3. Treat \`.drawgle/screens/*.html\` as visual source material, not production application code.
4. Map the exported design tokens to the repository's existing theme and reusable components.
5. Implement framework-native UI. Do not use a WebView unless explicitly requested.
6. Run the repository's relevant formatter, typecheck, tests, and build, then fix failures.
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
3. Use \`.drawgle/screens/*.html\` as the visual source of truth for each screen.
4. ${TARGET_INSTRUCTIONS[target]}
5. Do not use a WebView or ship the HTML as an embedded page unless HTML / Tailwind is explicitly the target.
6. Run the repository's relevant formatter, typecheck, tests, and build. Fix failures before finishing.

## Project

- Name: ${context.project.name}
- Original brief: ${context.project.prompt || "No original brief provided."}
- Target preference: ${TARGET_LABELS[target]}
- Screens: ${context.screens.map((screen) => screen.name).join(", ")}
`;

  const files: Record<string, string> = {
    ".drawgle/README.md": `# Drawgle Agent Pack

This folder contains portable design context and HTML visual references for local coding agents.

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
    files[screenEntries[index].file] = buildStandaloneHtmlExport({
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

export function buildNativeScaffold({
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
}): NativeScaffoldResult {
  try {
    const exportTokenCss = tokenCss?.trim() || buildDrawgleTokenCss(designTokens);
    const combinedHtml = `<div>
      <style>${exportTokenCss}</style>
      ${screen.code}
      ${navigationCode ? `<div id="drawgle-navigation-shell">${navigationCode}</div>` : ""}
    </div>`;
    const ast = parseScreenHtml(combinedHtml, designTokens);
    if (!ast) {
      throw new Error("Unable to parse this screen into a structural scaffold.");
    }

    const cleanName = cleanExportName(screen.name);
    const headers = generateTokenHeaderComment(designTokens);
    const { mainTree, fixedBottomNodes } = extractFixedBottomNodes(ast);
    const hasFixedBottom = fixedBottomNodes.length > 0;

    if (target === "swiftui") {
      const fixed = fixedBottomNodes.map((node) => transpileToSwiftUI(node)).join("");
      const body = hasFixedBottom
        ? `        ZStack(alignment: .bottom) {\n            ScrollView {\n${transpileToSwiftUI(mainTree)}            }\n${fixed}        }\n`
        : `        ScrollView {\n${transpileToSwiftUI(mainTree)}        }\n`;
      const screenCode = `import SwiftUI

// Drawgle structural scaffold (Beta). Adapt to your app architecture and theme.
struct ${cleanName}View: View {
    var body: some View {
${body}        .background(AppTheme.backgroundPrimary)
        .ignoresSafeArea(edges: .bottom)
    }
}
`;
      return {
        code: `${FILE_SEPARATOR}\n// FILE 1: AppTheme.swift\n${FILE_SEPARATOR}\n\n${headers.swift}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanName}View.swift\n${FILE_SEPARATOR}\n\n${screenCode}`,
        error: null,
      };
    }

    if (target === "compose") {
      const fixed = fixedBottomNodes.map((node) => transpileToCompose(node)).join("");
      const screenCode = `package com.drawgle.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

// Drawgle structural scaffold (Beta). Adapt to your app architecture and theme.
@Composable
fun ${cleanName}Screen() {
    Box(modifier = Modifier.fillMaxSize().background(AppTheme.BackgroundPrimary)) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
${transpileToCompose(mainTree)}        }
${hasFixedBottom ? fixed : ""}    }
}
`;
      return {
        code: `${FILE_SEPARATOR}\n// FILE 1: AppTheme.kt\n${FILE_SEPARATOR}\n\n${headers.compose}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanName}Screen.kt\n${FILE_SEPARATOR}\n\n${screenCode}`,
        error: null,
      };
    }

    if (target === "reactnative") {
      const fixed = fixedBottomNodes.map((node) => transpileToReactNative(node)).join("");
      const screenCode = `import React from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Drawgle structural scaffold (Beta). Adapt to your app architecture and theme.
function Icon({ size = 24, color = "#000" }: { name: string; size?: number; color?: string }) {
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Text style={{ color }}>•</Text></View>;
}

export default function ${cleanName}Screen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.colors.backgroundPrimary }}>
      ${hasFixedBottom ? `<View style={{ flex: 1 }}>` : ""}
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
${transpileToReactNative(mainTree)}      </ScrollView>
${hasFixedBottom ? `${fixed}      </View>` : ""}
    </SafeAreaView>
  );
}
`;
      return {
        code: `${FILE_SEPARATOR}\n// FILE 1: AppTheme.ts\n${FILE_SEPARATOR}\n\n${headers.rn}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanName}Screen.tsx\n${FILE_SEPARATOR}\n\n${screenCode}`,
        error: null,
      };
    }

    const fixed = fixedBottomNodes.map((node) => transpileToFlutter(node)).join("");
    const body = hasFixedBottom
      ? `Stack(children: [SingleChildScrollView(child: ${transpileToFlutter(mainTree).trim()}), ${fixed}])`
      : `SingleChildScrollView(child: ${transpileToFlutter(mainTree).trim()})`;
    const screenCode = `import "package:flutter/material.dart";

// Drawgle structural scaffold (Beta). Adapt to your app architecture and theme.
class ${cleanName}Screen extends StatelessWidget {
  const ${cleanName}Screen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundPrimary,
      body: SafeArea(child: ${body}),
    );
  }
}
`;
    return {
      code: `${FILE_SEPARATOR}\n// FILE 1: app_theme.dart\n${FILE_SEPARATOR}\n\n${headers.flutter}\n\n${FILE_SEPARATOR}\n// FILE 2: ${cleanName.toLowerCase()}_screen.dart\n${FILE_SEPARATOR}\n\n${screenCode}`,
      error: null,
    };
  } catch (error) {
    return {
      code: null,
      error: error instanceof Error ? error.message : "This Beta Scaffold could not be generated.",
    };
  }
}

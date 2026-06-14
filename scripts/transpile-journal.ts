import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import {
  buildTranspileTree,
  generateTokenHeaderComment,
  extractFixedBottomNodes,
  transpileToSwiftUI,
  transpileToCompose,
  transpileToReactNative,
  transpileToFlutter,
  parseCssStylesheet
} from "../lib/mobile-transpiler";
import type { DesignTokens } from "../lib/types";

// Helper to construct a mock DOM compatible with the browser HTMLElement interface
function cheerioToMockDom(htmlString: string): any {
  const $ = cheerio.load(htmlString);
  const rootElement = $("body").children().first()[0] || $("body")[0];

  function walk(node: any): any {
    if (!node) return null;

    if (node.type === "text") {
      return {
        nodeType: 3,
        textContent: node.data || "",
        childNodes: []
      };
    }

    if (node.type === "tag") {
      const tagName = node.tagName;
      const classList: any = $(node).attr("class")?.split(/\s+/).filter(Boolean) || [];
      classList.contains = (c: string) => classList.includes(c);
      const id = $(node).attr("id") || "";
      const styleText = $(node).attr("style") || "";

      const attributesList = Object.entries(node.attribs || {}).map(([name, value]) => ({
        name,
        value
      }));

      const mockElement: any = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        classList,
        id,
        getAttribute(name: string) {
          return $(node).attr(name) || null;
        },
        hasAttribute(name: string) {
          return $(node).attr(name) !== undefined;
        },
        getElementsByTagName(name: string) {
          const results: any[] = [];
          function traverse(curr: any) {
            curr.childNodes.forEach((child: any) => {
              if (child.nodeType === 1) {
                if (child.tagName.toLowerCase() === name.toLowerCase()) {
                  results.push(child);
                }
                traverse(child);
              }
            });
          }
          traverse(mockElement);
          return results;
        },
        attributes: attributesList,
        childNodes: []
      };

      (node.children || []).forEach((c: any) => {
        const parsed = walk(c);
        if (parsed) {
          parsed.parentElement = mockElement;
          mockElement.childNodes.push(parsed);
        }
      });

      return mockElement;
    }

    return null;
  }

  return walk(rootElement);
}

const mockTokens: DesignTokens = {
  colors: {
    "background-primary": { value: "#F5F5FA", category: "colors", name: "background-primary" },
    "background-secondary": { value: "#FFFFFF", category: "colors", name: "background-secondary" },
    "surface-card": { value: "#FFFFFF", category: "colors", name: "surface-card" },
    "action-primary": { value: "#FFD600", category: "colors", name: "action-primary" },
    "action-on-primary-text": { value: "#000000", category: "colors", name: "action-on-primary-text" },
    "text-high-emphasis": { value: "#000000", category: "colors", name: "text-high-emphasis" },
    "text-medium-emphasis": { value: "#666666", category: "colors", name: "text-medium-emphasis" },
    "text-low-emphasis": { value: "#999999", category: "colors", name: "text-low-emphasis" },
    "border-divider": { value: "rgba(0, 0, 0, 0.05)", category: "colors", name: "border-divider" },
  },
  typography: {
    "font-family": { value: "SF Pro Display", category: "typography", name: "font-family" }
  },
  spacing: {
    "md": { value: "16px", category: "spacing", name: "md" }
  },
  radii: {
    "app": { value: "32px", category: "radii", name: "app" },
    "pill": { value: "9999px", category: "radii", name: "pill" }
  },
  "mobile-layout": {
    "screen-margin": { value: "20px", category: "mobile-layout", name: "screen-margin" },
    "section-gap": { value: "32px", category: "mobile-layout", name: "section-gap" },
    "element-gap": { value: "12px", category: "mobile-layout", name: "element-gap" }
  }
};

function transpileJournalFile() {
  const rootDir = path.join(__dirname, "..");
  const htmlPath = path.join(rootDir, "Journal.html");

  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: ${htmlPath} does not exist!`);
    process.exit(1);
  }

  console.log(`Reading visual HTML layout from: ${htmlPath}...`);
  const htmlContent = fs.readFileSync(htmlPath, "utf-8");

  // Parse CSS stylesheet rules (Cheerio document wrapper for helper compatibility)
  const $ = cheerio.load(htmlContent);
  
  // Cheerio elements to HTMLDoc mock structure
  const mockDoc: any = {
    getElementsByTagName(name: string) {
      const results: any[] = [];
      $(`style`).each((_, el) => {
        results.push({
          textContent: $(el).text(),
          nodeName: "style",
          nodeType: 1
        });
      });
      return results;
    }
  };

  const cssRules = parseCssStylesheet(mockDoc);

  const mockDom = cheerioToMockDom(htmlContent);
  const varMap = new Map<string, string>();
  
  // Extract CSS variables from raw HTML styles
  const varMatches = htmlContent.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g);
  for (const match of varMatches) {
    varMap.set(match[1].trim(), match[2].trim());
  }

  // Fallbacks
  varMap.set("--dg-color-background-primary", "#F5F5FA");
  varMap.set("--dg-color-background-secondary", "#FFFFFF");
  varMap.set("--dg-color-surface-card", "#FFFFFF");
  varMap.set("--dg-color-action-primary", "#FFD600");
  varMap.set("--dg-color-action-on-primary-text", "#000000");
  varMap.set("--dg-color-text-high-emphasis", "#000000");
  varMap.set("--dg-color-text-medium-emphasis", "#666666");
  varMap.set("--dg-color-text-low-emphasis", "#999999");
  varMap.set("--dg-color-border-divider", "rgba(0, 0, 0, 0.05)");
  varMap.set("--dg-radii-app", "32px");
  varMap.set("--dg-radii-pill", "9999px");

  const ast = buildTranspileTree(mockDom, varMap, cssRules);
  if (!ast) {
    console.error("Error: AST build failed!");
    process.exit(1);
  }
  const headers = generateTokenHeaderComment(mockTokens);

  const { mainTree, fixedBottomNodes } = extractFixedBottomNodes(ast);
  const hasFixedBottom = fixedBottomNodes.length > 0;

  // SwiftUI
  const fixedBottomSwift = fixedBottomNodes.map(n => transpileToSwiftUI(n)).join('');
  const swiftBodyOpen = hasFixedBottom ? `        ZStack(alignment: .bottom) {\n            ScrollView {\n` : `        ScrollView {\n`;
  const swiftBodyClose = hasFixedBottom
    ? `            }\n${fixedBottomSwift}        }\n`
    : `        }\n`;
  const swiftCode = headers.swift + "\n" +
    `//\n//  JournalView.swift\n//  Auto-generated by Drawgle\n//\n\nimport SwiftUI\n// Requires: https://github.com/lucide-icons/lucide-swift\n\nstruct JournalView: View {\n    var body: some View {\n` +
    swiftBodyOpen +
    transpileToSwiftUI(mainTree) +
    swiftBodyClose +
    `        .background(AppTheme.backgroundPrimary)\n        .ignoresSafeArea(edges: .bottom)\n    }\n}\n\n#Preview {\n    JournalView()\n}\n`;

  // Jetpack Compose
  const fixedBottomCompose = fixedBottomNodes.map(n => transpileToCompose(n)).join('');
  const composeCode = headers.compose + "\n" +
    `/*\n * JournalScreen.kt\n * Auto-generated by Drawgle\n */\n\npackage com.drawgle.ui\n\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.rememberScrollState\nimport androidx.compose.foundation.verticalScroll\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.Alignment\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.text.font.FontWeight\nimport androidx.compose.ui.unit.sp\nimport androidx.compose.ui.text.style.TextAlign\nimport androidx.compose.material.icons.Icons\nimport androidx.compose.material.icons.filled.*\nimport androidx.compose.material3.* // For Button, Text, Icon\nimport androidx.compose.foundation.lazy.grid.*\nimport com.drawgle.theme.AppTheme\n\n@Composable\nfun JournalScreen() {\n    Box(\n        modifier = Modifier\n            .fillMaxSize()\n            .background(AppTheme.BackgroundPrimary)\n    ) {\n        Column(\n            modifier = Modifier\n                .fillMaxSize()\n                .verticalScroll(rememberScrollState())\n        ) {\n` +
    transpileToCompose(mainTree) +
    `        }\n` +
    (hasFixedBottom ? fixedBottomCompose : '') +
    `    }\n}\n`;

  // React Native
  const fixedBottomRN = fixedBottomNodes.map(n => transpileToReactNative(n)).join('');
  const rnCode = headers.rn + "\n" +
    `//\n// JournalScreen.tsx\n// Auto-generated by Drawgle\n//\n\nimport React from 'react';\nimport {\n  StyleSheet,\n  Text,\n  View,\n  Image,\n  ScrollView,\n  TouchableOpacity,\n  SafeAreaView\n} from 'react-native';\nimport { LinearGradient } from 'expo-linear-gradient';\nimport { AppTheme } from './AppTheme';\n\n// Visual icon placeholder\nfunction Icon({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) {\n  return (\n    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>\n      <Text style={{ color, fontSize: size * 0.8, fontWeight: 'bold' }}>•</Text>\n    </View>\n  );\n}\n\nexport default function JournalScreen() {\n  return (\n    <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.colors.backgroundPrimary }}>\n` +
    (hasFixedBottom ? `      <View style={{ flex: 1 }}>\n` : '') +
    `      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>\n` +
    transpileToReactNative(mainTree) +
    `      </ScrollView>\n` +
    (hasFixedBottom ? fixedBottomRN + `      </View>\n` : '') +
    `    </SafeAreaView>\n  );\n}\n`;

  // Flutter
  const fixedBottomFlutter = fixedBottomNodes.map(n => transpileToFlutter(n)).join('');
  const flutterCode = headers.flutter + "\n" +
    `//\n// journal_screen.dart\n// Auto-generated by Drawgle\n//\n\nimport 'package:flutter/material.dart';\nimport 'app_theme.dart';\n\nclass JournalScreen extends StatelessWidget {\n  const JournalScreen({Key? key}) : super(key: key);\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      backgroundColor: AppTheme.backgroundPrimary,\n      body: SafeArea(\n` +
    (hasFixedBottom
      ? `        child: Stack(\n          children: [\n            SingleChildScrollView(\n              child: ` + transpileToFlutter(mainTree).trim() + `,\n            ),\n` + fixedBottomFlutter + `          ],\n        ),\n`
      : `        child: SingleChildScrollView(\n          child: ` + transpileToFlutter(mainTree).trim() + `,\n        ),\n`) +
    `      ),\n    );\n  }\n}\n`;

  fs.writeFileSync(path.join(rootDir, "Journal.swift"), swiftCode, "utf-8");
  fs.writeFileSync(path.join(rootDir, "Journal.kt"), composeCode, "utf-8");
  fs.writeFileSync(path.join(rootDir, "Journal.tsx"), rnCode, "utf-8");
  fs.writeFileSync(path.join(rootDir, "Journal.dart"), flutterCode, "utf-8");

  console.log("Success! Regenerated Journal target files!");
}

transpileJournalFile();

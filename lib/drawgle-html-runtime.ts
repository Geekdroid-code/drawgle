type ExportRuntimeCssOptions = {
  includeNavigation?: boolean;
};

export function buildDrawgleTailwindConfigScript(): string {
  return `
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["var(--font-body, var(--dg-typography-font-family))", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
            },
            colors: {
              background: "var(--background, var(--dg-color-background-primary))",
              muted: {
                DEFAULT: "var(--muted, var(--dg-color-background-secondary))",
                foreground: "var(--muted-foreground, var(--dg-color-text-medium-emphasis))"
              },
              card: {
                DEFAULT: "var(--card, var(--dg-color-surface-card))",
                foreground: "var(--foreground, var(--dg-color-text-high-emphasis))"
              },
              popover: {
                DEFAULT: "var(--popover, var(--dg-color-surface-modal))",
                foreground: "var(--foreground, var(--dg-color-text-high-emphasis))"
              },
              foreground: "var(--foreground, var(--dg-color-text-high-emphasis))",
              primary: {
                DEFAULT: "var(--primary, var(--dg-color-action-primary))",
                foreground: "var(--primary-foreground, var(--dg-color-action-on-primary-text))"
              },
              secondary: "var(--secondary, var(--dg-color-action-secondary))",
              border: "var(--border, var(--dg-color-border-divider))",
              "low-foreground": "var(--low-foreground, var(--dg-color-text-low-emphasis))",
              tint: {
                blue: "var(--tint-blue, var(--dg-color-functional-tints-blue-base))",
                orange: "var(--tint-orange, var(--dg-color-functional-tints-orange-base))",
                cyan: "var(--tint-cyan, var(--dg-color-functional-tints-cyan-base))",
                purple: "var(--tint-purple, var(--dg-color-functional-tints-purple-base))",
                gray: "var(--surface-muted, #F5F5F5)"
              }
            },
            borderRadius: {
              lg: "var(--radius, var(--dg-radii-app))",
              md: "calc(var(--radius, var(--dg-radii-app)) - 2px)",
              sm: "calc(var(--radius, var(--dg-radii-app)) - 4px)"
            },
            spacing: {
              "screen-margin": "var(--screen-margin, var(--dg-mobile-layout-screen-margin))",
              "section-gap": "var(--section-gap, var(--dg-mobile-layout-section-gap))",
              "element-gap": "var(--element-gap, var(--dg-mobile-layout-element-gap))"
            },
            boxShadow: {
              surface: "var(--shadow-surface, var(--dg-shadows-surface))",
              overlay: "var(--shadow-overlay, var(--dg-shadows-overlay))"
            },
            fontSize: {
              "nav-title": ["var(--nav-title-size, var(--dg-type-nav-title-size))", { lineHeight: "var(--nav-title-line-height, var(--dg-type-nav-title-line-height))" }],
              "screen-title": ["var(--screen-title-size, var(--dg-type-screen-title-size))", { lineHeight: "var(--screen-title-line-height, var(--dg-type-screen-title-line-height))" }],
              "hero-title": ["var(--hero-title-size, var(--dg-type-hero-title-size))", { lineHeight: "var(--hero-title-line-height, var(--dg-type-hero-title-line-height))" }],
              "section-title": ["var(--section-title-size, var(--dg-type-section-title-size))", { lineHeight: "var(--section-title-line-height, var(--dg-type-section-title-line-height))" }],
              "metric-value": ["var(--metric-value-size, var(--dg-type-metric-value-size))", { lineHeight: "var(--metric-value-line-height, var(--dg-type-metric-value-line-height))" }],
              body: ["var(--body-size, var(--dg-type-body-size))", { lineHeight: "var(--body-line-height, var(--dg-type-body-line-height))" }],
              supporting: ["var(--supporting-size, var(--dg-type-supporting-size))", { lineHeight: "var(--supporting-line-height, var(--dg-type-supporting-line-height))" }],
              caption: ["var(--caption-size, var(--dg-type-caption-size))", { lineHeight: "var(--caption-line-height, var(--dg-type-caption-line-height))" }],
              "button-label": ["var(--button-label-size, var(--dg-type-button-label-size))", { lineHeight: "var(--button-label-line-height, var(--dg-type-button-label-line-height))" }]
            },
            fontWeight: {
              "nav-title": "var(--nav-title-weight, var(--dg-type-nav-title-weight))",
              "screen-title": "var(--screen-title-weight, var(--dg-type-screen-title-weight))",
              "hero-title": "var(--hero-title-weight, var(--dg-type-hero-title-weight))",
              "section-title": "var(--section-title-weight, var(--dg-type-section-title-weight))",
              "metric-value": "var(--metric-value-weight, var(--dg-type-metric-value-weight))",
              body: "var(--body-weight, var(--dg-type-body-weight))",
              supporting: "var(--supporting-weight, var(--dg-type-supporting-weight))",
              caption: "var(--caption-weight, var(--dg-type-caption-weight))",
              "button-label": "var(--button-label-weight, var(--dg-type-button-label-weight))"
            }
          }
        }
      };
    </script>
  `.trim();
}

export function buildDrawgleExportRuntimeCss(
  tokenCss: string,
  { includeNavigation = true }: ExportRuntimeCssOptions = {},
): string {
  return `
${tokenCss}
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
${includeNavigation ? "#drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }\n#drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }" : ""}
  `.trim();
}

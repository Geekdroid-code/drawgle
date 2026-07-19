import type { PlaygroundTokens } from "../tokens";
import { tokenCssText } from "../tokens";

const RUNTIME_CSS = `
  :root {
__TOKEN_CSS__
  }

  html,
  body {
    width: 100%;
    min-height: 100%;
    overflow-x: hidden;
  }

  body {
    background: var(--dg-color-background-primary);
  }

  h1, h2, h3, h4, h5, h6,
  .dg-type-nav-title, .dg-type-screen-title, .dg-type-hero-title, .dg-type-section-title {
    font-family: var(--dg-typography-heading-font-family) !important;
  }

  #drawgle-export-root,
  #drawgle-export-root > .w-full {
    min-height: 100vh;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .no-scrollbar {
    scrollbar-width: none;
  }

  [data-drawgle-primary-nav] .dg-nav-item[data-active="true"] .dg-nav-icon-wrapper,
  [data-drawgle-primary-nav] .dg-nav-item[aria-current="page"] .dg-nav-icon-wrapper {
    color: var(--dg-color-action-primary) !important;
  }

  [data-drawgle-primary-nav] .dg-nav-item[data-active="true"] .dg-nav-label,
  [data-drawgle-primary-nav] .dg-nav-item[aria-current="page"] .dg-nav-label {
    color: var(--dg-color-action-primary) !important;
    font-weight: 700 !important;
  }

  [data-drawgle-primary-nav] .dg-nav-item[data-active="true"]::after,
  [data-drawgle-primary-nav] .dg-nav-item[aria-current="page"]::after {
    content: '';
    position: absolute;
    top: 12px;
    width: 4px;
    height: 4px;
    background: var(--dg-color-action-primary);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--dg-color-action-primary);
  }
`;

export function buildProject2SrcDoc(html: string, tokens: PlaygroundTokens) {
  const runtimeCss = RUNTIME_CSS.replace("__TOKEN_CSS__", tokenCssText(tokens));

  const normalizedHtml = html.replace(/--dg-typography-font-family\\b/g, "--dg-typography-body-font-family");
  return normalizedHtml.replace("</head>", `<style id="drawgle-landing-token-overrides">${runtimeCss}</style></head>`);
}


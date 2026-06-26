import { JSDOM } from "jsdom";
const jsdom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.DOMParser = jsdom.window.DOMParser;
global.Element = jsdom.window.Element;

import { buildStandaloneHtmlExport } from "../lib/export-pipeline";
import fs from "fs";

const screen = {
  id: "593839a0-a420-455c-a547-68652055e42c",
  name: "Timer Dashboard",
  code: `<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" data-drawgle-id="dg-1">
  <!-- Header Section -->
  <header class="flex items-center justify-between px-[var(--dg-mobile-layout-screen-margin)] pt-[calc(var(--dg-mobile-layout-safe-area-top)+12px)] pb-[var(--dg-mobile-layout-element-gap)]" data-drawgle-id="dg-2" style="background-color: var(--dg-color-surface-card)">
    <h1 class="dg-type-screen-title dg-text-high" data-drawgle-id="dg-3">Welcome back, Hakim!</h1>
    <button class="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#E8E8E8] shadow-inner" data-drawgle-id="dg-4">
      <i data-lucide="bell" class="w-[20px] h-[20px] dg-text-high"></i>
    </button>
  </header>

  <!-- Main Content Scrollable Area -->
  <main class="flex-1 flex flex-col gap-[var(--dg-mobile-layout-section-gap)] px-[var(--dg-mobile-layout-screen-margin)] pb-[calc(var(--dg-mobile-layout-safe-area-bottom)+116px)]" data-drawgle-id="dg-5" style="background-color: var(--dg-color-surface-card)">
    
    <!-- Primary Timer Card -->
    <section class="dg-surface-card rounded-[var(--dg-radii-app)] dg-shadow-surface p-[var(--dg-spacing-md)] flex flex-col items-center" data-drawgle-id="dg-6" style="box-shadow: var(--dg-shadows-none); background-color: var(--dg-color-background-secondary)">
      <!-- Task Header Row -->
      <div class="w-full flex items-center justify-between mb-[var(--dg-spacing-xl)]" data-drawgle-id="dg-7">
        <div class="flex items-center gap-[var(--dg-spacing-md)]" data-drawgle-id="dg-8">
          <div class="w-[40px] h-[40px] rounded-xl bg-[#EEF2FF] flex items-center justify-center" data-drawgle-id="dg-9">
            <i data-lucide="mouse-pointer-2" class="w-[20px] h-[20px] text-[#4F46E5]"></i>
          </div>
          <div class="flex flex-col" data-drawgle-id="dg-a">
            <span class="dg-type-supporting dg-text-high font-semibold" data-drawgle-id="dg-b">Wireframing Crypto Wallet</span>
            <div class="flex items-center gap-[var(--dg-spacing-xs)]" data-drawgle-id="dg-c">
              <div class="flex items-center gap-[2px]" data-drawgle-id="dg-d">
                <i data-lucide="refresh-cw" class="w-[10px] h-[10px] dg-text-low"></i>
                <span class="dg-type-caption dg-text-low" data-drawgle-id="dg-e">3/5</span>
              </div>
              <div class="w-[3px] h-[3px] rounded-full bg-[var(--dg-color-text-low-emphasis)]" data-drawgle-id="dg-f"></div>
              <div class="flex items-center gap-[2px]" data-drawgle-id="dg-g">
                <i data-lucide="clock" class="w-[10px] h-[10px] dg-text-low"></i>
                <span class="dg-type-caption dg-text-low" data-drawgle-id="dg-h">25/125 mins</span>
              </div>
            </div>
          </div>
        </div>
        <button class="w-[32px] h-[32px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-i">
          <i data-lucide="chevron-down" class="w-[16px] h-[16px] dg-text-medium"></i>
        </button>
      </div>

      <!-- Timer Gauge Visualization -->
      <div class="relative w-[240px] h-[240px] flex items-center justify-center mb-[var(--dg-spacing-md)]" data-drawgle-id="dg-j">
        <!-- Background Track -->
        <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#F2F2F2" stroke-width="8" stroke-linecap="round" />
          <!-- Active Progress Arc -->
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--dg-color-action-primary)" stroke-width="8" stroke-linecap="round" stroke-dasharray="200 276" />
          <!-- Progress Handle -->
          <circle cx="94" cy="50" r="4" fill="var(--dg-color-action-primary)" transform="rotate(260 50 50)" />
        </svg>
        
        <!-- Inner Dashed Clock Face -->
        <div class="absolute inset-[30px] rounded-full border-[1px] border-dashed border-[var(--dg-color-action-disabled)]" data-drawgle-id="dg-k"></div>
        
        <!-- Clock Markers (Manual SVG for precision) -->
        <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <line x1="50" y1="12" x2="50" y2="16" stroke="#E5E7EB" stroke-width="1" />
          <line x1="50" y1="84" x2="50" y2="88" stroke="#E5E7EB" stroke-width="1" />
          <line x1="12" y1="50" x2="16" y2="50" stroke="#E5E7EB" stroke-width="1" />
          <line x1="84" y1="50" x2="88" y2="50" stroke="#E5E7EB" stroke-width="1" />
        </svg>

        <!-- Timer Value -->
        <div class="flex flex-col items-center z-10" data-drawgle-id="dg-l">
          <span class="text-[48px] font-bold tracking-tight leading-none dg-text-high" data-drawgle-id="dg-m">14:32</span>
          <span class="dg-type-caption dg-text-low mt-2" data-drawgle-id="dg-n">Back to the Zone</span>
        </div>
      </div>

      <!-- Playback Controls -->
      <div class="w-full flex items-center justify-between px-[var(--dg-spacing-md)] mt-[var(--dg-spacing-md)]" data-drawgle-id="dg-o">
        <div class="flex items-center gap-[var(--dg-spacing-md)]" data-drawgle-id="dg-p">
          <button class="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-q">
            <i data-lucide="maximize-2" class="w-[18px] h-[18px] dg-text-medium"></i>
          </button>
          <button class="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-r">
            <i data-lucide="rotate-ccw" class="w-[18px] h-[18px] dg-text-medium"></i>
          </button>
        </div>

        <button class="w-[64px] h-[64px] flex items-center justify-center rounded-full bg-[var(--dg-color-action-primary)] shadow-[0_8px_20px_rgba(16,185,129,0.3)]" data-drawgle-id="dg-s">
          <i data-lucide="play" class="w-[28px] h-[28px] text-white fill-current"></i>
        </button>

        <div class="flex items-center gap-[var(--dg-spacing-md)]" data-drawgle-id="dg-t">
          <button class="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-u">
            <i data-lucide="skip-forward" class="w-[18px] h-[18px] dg-text-medium"></i>
          </button>
          <button class="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-v">
            <i data-lucide="music" class="w-[18px] h-[18px] dg-text-medium"></i>
          </button>
        </div>
      </div>
    </section>

    <!-- Recents Task Section -->
    <section class="flex flex-col gap-[var(--dg-mobile-layout-element-gap)]" data-drawgle-id="dg-w">
      <div class="flex items-center justify-between" data-drawgle-id="dg-x">
        <h2 class="dg-type-section-title dg-text-high" data-drawgle-id="dg-y">Recents Task</h2>
        <button class="dg-type-supporting text-[var(--dg-color-action-primary)] font-semibold border-b border-[var(--dg-color-action-primary)]" data-drawgle-id="dg-z">View All</button>
      </div>

      <!-- Task List -->
      <div class="flex flex-col gap-[var(--dg-spacing-md)]" data-drawgle-id="dg-10">
        <!-- Task Item 1 -->
        <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] dg-shadow-surface flex items-center justify-between" data-drawgle-id="dg-11" style="box-shadow: var(--dg-shadows-none); background-color: var(--dg-color-background-secondary)">
          <div class="flex items-center gap-[var(--dg-spacing-md)]" data-drawgle-id="dg-12">
            <div class="w-[44px] h-[44px] rounded-2xl bg-[#ECFDF5] flex items-center justify-center" data-drawgle-id="dg-13">
              <i data-lucide="layout" class="w-[20px] h-[20px] text-[var(--dg-color-action-primary)]"></i>
            </div>
            <div class="flex flex-col" data-drawgle-id="dg-14">
              <span class="dg-type-body font-semibold dg-text-high" data-drawgle-id="dg-15">Spark Pixel Branding Asset...</span>
              <div class="flex items-center gap-[var(--dg-spacing-xs)]" data-drawgle-id="dg-16">
                <div class="flex items-center gap-[2px]" data-drawgle-id="dg-17">
                  <i data-lucide="refresh-cw" class="w-[10px] h-[10px] dg-text-low"></i>
                  <span class="dg-type-caption dg-text-low" data-drawgle-id="dg-18">1/6</span>
                </div>
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--dg-color-text-low-emphasis)]" data-drawgle-id="dg-19"></div>
                <div class="flex items-center gap-[2px]" data-drawgle-id="dg-1a">
                  <i data-lucide="clock" class="w-[10px] h-[10px] dg-text-low"></i>
                  <span class="dg-type-caption dg-text-low" data-drawgle-id="dg-1b">20/120 mins</span>
                </div>
              </div>
            </div>
          </div>
          <button class="w-[32px] h-[32px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-1c">
            <i data-lucide="play" class="w-[14px] h-[14px] dg-text-high fill-current"></i>
          </button>
        </div>

        <!-- Task Item 2 -->
        <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] dg-shadow-surface flex items-center justify-between" data-drawgle-id="dg-1d" style="box-shadow: var(--dg-shadows-none); background-color: var(--dg-color-background-secondary)">
          <div class="flex items-center gap-[var(--dg-spacing-md)]" data-drawgle-id="dg-1e">
            <div class="w-[44px] h-[44px] rounded-2xl bg-[#FFF7ED] flex items-center justify-center" data-drawgle-id="dg-1f">
              <i data-lucide="activity" class="w-[20px] h-[20px] text-[#F97316]"></i>
            </div>
            <div class="flex flex-col" data-drawgle-id="dg-1g">
              <span class="dg-type-body font-semibold dg-text-high" data-drawgle-id="dg-1h">User Flow for Fitness App</span>
              <div class="flex items-center gap-[var(--dg-spacing-xs)]" data-drawgle-id="dg-1i">
                <div class="flex items-center gap-[2px]" data-drawgle-id="dg-1j">
                  <i data-lucide="refresh-cw" class="w-[10px] h-[10px] dg-text-low"></i>
                  <span class="dg-type-caption dg-text-low" data-drawgle-id="dg-1k">1/4</span>
                </div>
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--dg-color-text-low-emphasis)]" data-drawgle-id="dg-1l"></div>
                <div class="flex items-center gap-[2px]" data-drawgle-id="dg-1m">
                  <i data-lucide="clock" class="w-[10px] h-[10px] dg-text-low"></i>
                  <span class="dg-type-caption dg-text-low" data-drawgle-id="dg-1n">25/100 mins</span>
                </div>
              </div>
            </div>
          </div>
          <button class="w-[32px] h-[32px] flex items-center justify-center rounded-full bg-[var(--dg-color-background-secondary)]" data-drawgle-id="dg-1o">
            <i data-lucide="play" class="w-[14px] h-[14px] dg-text-high fill-current"></i>
          </button>
        </div>
      </div>
    </section>
  </main>
</div>`,
  chromePolicy: {
    chrome: "bottom-tabs",
    showPrimaryNavigation: true,
    showsBackButton: false
  },
  navigationItemId: "home"
};

const designTokens = {
  meta: { recommendedFonts: ["SF Pro Display", "Inter"] },
  tokens: {
    color: {
      text: { low_emphasis: "#999999", high_emphasis: "#000000", medium_emphasis: "#666666" },
      action: { primary: "#10B981", disabled: "#E5E7EB", secondary: "#000000", on_primary_text: "#FFFFFF" },
      border: { divider: "#E5E7EB", focused: "#10B981" },
      surface: { card: "#FFFFFF", modal: "#FFFFFF", bottom_sheet: "#FFFFFF" },
      background: { primary: "#F2F2F2", secondary: "#F9F9F9" }
    },
    radii: { app: "24px", pill: "9999px" },
    sizing: {
      icon_small: "18px",
      icon_standard: "24px",
      min_touch_target: "48px",
      bottom_nav_height: "84px",
      standard_input_height: "52px",
      standard_button_height: "56px"
    },
    shadows: {
      none: "none",
      overlay: "0px 20px 50px rgba(0, 0, 0, 0.12)",
      surface: "0px 18px 48px -18px rgba(15, 23, 42, 0.18)"
    },
    spacing: {
      lg: "24px",
      md: "16px",
      sm: "12px",
      xl: "32px",
      xs: "8px",
      xxl: "48px",
      xxs: "4px",
      none: "0px"
    },
    z_index: {
      base: "0",
      bottom_nav: "20",
      bottom_sheet: "30",
      modal_dialog: "40",
      sticky_header: "10",
      toast_snackbar: "50"
    },
    opacities: {
      opaque: "1",
      pressed: "0.12",
      disabled: "0.38",
      transparent: "0",
      scrim_overlay: "0.50"
    },
    typography: {
      body: { size: "16px", weight: 400, line_height: "24px" },
      caption: { size: "12px", weight: 400, line_height: "16px" },
      nav_title: { size: "17px", weight: 600, line_height: "22px" },
      hero_title: { size: "48px", weight: 700, line_height: "56px" },
      supporting: { size: "14px", weight: 500, line_height: "20px" },
      font_family: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
      button_label: { size: "16px", weight: 600, line_height: "20px" },
      metric_value: { size: "14px", weight: 600, line_height: "18px" },
      screen_title: { size: "24px", weight: 700, line_height: "30px" },
      section_title: { size: "18px", weight: 600, line_height: "24px" }
    },
    border_widths: { standard: "1px" },
    mobile_layout: {
      element_gap: "16px",
      section_gap: "32px",
      safe_area_top: "16px",
      screen_margin: "20px",
      safe_area_bottom: "16px"
    }
  },
  system_schema: "mobile_universal_core"
};

const navigationCode = `<nav data-drawgle-primary-nav class="dg-nav-shell">
<div class="dg-nav-shell-inner">
<button type="button" class="dg-nav-item" data-nav-item-id="home">Home</button>
</div>
</nav>`;

const html = buildStandaloneHtmlExport({
  screen,
  navigationCode,
  activeNavigationItemId: "home",
  designTokens
});

if (!fs.existsSync("scratch")) {
  fs.mkdirSync("scratch");
}
fs.writeFileSync("scratch/exported_timer.html", html);
console.log("Compiled HTML written to scratch/exported_timer.html");

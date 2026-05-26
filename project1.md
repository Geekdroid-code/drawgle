HTML: 

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="drawgle-google-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap">
    <style>
:root {
  --dg-color-text-low-emphasis: #505050;
  --dg-color-text-high-emphasis: #FFFFFF;
  --dg-color-text-medium-emphasis: #A0A0A0;
  --dg-color-action-primary: #FFFFFF;
  --dg-color-action-disabled: #2C2C2C;
  --dg-color-action-secondary: #1A1A1A;
  --dg-color-action-on-primary-text: #000000;
  --dg-color-border-divider: #222222;
  --dg-color-border-focused: #FFFFFF;
  --dg-color-surface-card: #121212;
  --dg-color-surface-modal: #1C1C1C;
  --dg-color-surface-bottom-sheet: #161616;
  --dg-color-background-primary: #000000;
  --dg-color-background-secondary: #080808;
  --dg-radii-app: 23px;
  --dg-radii-pill: 9999px;
  --dg-sizing-icon-small: 16px;
  --dg-sizing-icon-standard: 24px;
  --dg-sizing-min-touch-target: 48px;
  --dg-sizing-bottom-nav-height: 84px;
  --dg-sizing-standard-input-height: 52px;
  --dg-sizing-standard-button-height: 56px;
  --dg-shadows-none: none;
  --dg-shadows-overlay: 0px 8px 32px rgba(0, 0, 0, 0.8);
  --dg-shadows-surface: 0px 4px 20px rgba(0, 0, 0, 0.5);
  --dg-spacing-none: 0px;
  --dg-spacing-lg: 24px;
  --dg-spacing-md: 16px;
  --dg-spacing-sm: 12px;
  --dg-spacing-xl: 32px;
  --dg-spacing-xs: 8px;
  --dg-spacing-xxl: 48px;
  --dg-spacing-xxs: 4px;
  --dg-z-index-base: 0;
  --dg-z-index-bottom-nav: 20;
  --dg-z-index-bottom-sheet: 30;
  --dg-z-index-modal-dialog: 40;
  --dg-z-index-sticky-header: 10;
  --dg-z-index-toast-snackbar: 50;
  --dg-opacities-opaque: 1;
  --dg-opacities-pressed: 0.15;
  --dg-opacities-disabled: 0.38;
  --dg-opacities-transparent: 0;
  --dg-opacities-scrim-overlay: 0.70;
  --dg-typography-font-family: 'Inter', -apple-system, sans-serif;
  --dg-type-nav-title-size: 18px;
  --dg-type-nav-title-weight: 600;
  --dg-type-nav-title-line-height: 24px;
  --dg-type-screen-title-size: 34px;
  --dg-type-screen-title-weight: 700;
  --dg-type-screen-title-line-height: 40px;
  --dg-type-hero-title-size: 42px;
  --dg-type-hero-title-weight: 800;
  --dg-type-hero-title-line-height: 48px;
  --dg-type-section-title-size: 16px;
  --dg-type-section-title-weight: 600;
  --dg-type-section-title-line-height: 20px;
  --dg-type-metric-value-size: 28px;
  --dg-type-metric-value-weight: 600;
  --dg-type-metric-value-line-height: 32px;
  --dg-type-body-size: 15px;
  --dg-type-body-weight: 400;
  --dg-type-body-line-height: 22px;
  --dg-type-supporting-size: 13px;
  --dg-type-supporting-weight: 400;
  --dg-type-supporting-line-height: 18px;
  --dg-type-caption-size: 11px;
  --dg-type-caption-weight: 500;
  --dg-type-caption-line-height: 14px;
  --dg-type-button-label-size: 14px;
  --dg-type-button-label-weight: 600;
  --dg-type-button-label-line-height: 16px;
  --dg-border-widths-standard: 1px;
  --dg-mobile-layout-element-gap: 8px;
  --dg-mobile-layout-section-gap: 12px;
  --dg-mobile-layout-safe-area-top: 16px;
  --dg-mobile-layout-screen-margin: 20px;
  --dg-mobile-layout-safe-area-bottom: 16px;
}

#root {
  --dg-preview-background: var(--dg-color-background-primary, #ffffff);
  background: var(--dg-preview-background);
}

.dg-bg-primary { background-color: var(--dg-color-background-primary); }
.dg-bg-secondary { background-color: var(--dg-color-background-secondary); }
.dg-surface-card { background-color: var(--dg-color-surface-card); }
.dg-surface-bottom-sheet { background-color: var(--dg-color-surface-bottom-sheet); }
.dg-surface-modal { background-color: var(--dg-color-surface-modal); }
.dg-text-high { color: var(--dg-color-text-high-emphasis); }
.dg-text-medium { color: var(--dg-color-text-medium-emphasis); }
.dg-text-low { color: var(--dg-color-text-low-emphasis); }
.dg-action-primary {
  background-color: var(--dg-color-action-primary);
  color: var(--dg-color-action-on-primary-text);
}
.dg-action-secondary { background-color: var(--dg-color-action-secondary); }
.dg-border-divider { border-color: var(--dg-color-border-divider); }
.dg-border-focused { border-color: var(--dg-color-border-focused); }
.dg-radius-app { border-radius: var(--dg-radii-app); }
.dg-radius-pill { border-radius: var(--dg-radii-pill); }
.dg-shadow-surface { box-shadow: var(--dg-shadows-surface); }
.dg-shadow-overlay { box-shadow: var(--dg-shadows-overlay); }
.dg-screen-padding { padding-left: var(--dg-mobile-layout-screen-margin); padding-right: var(--dg-mobile-layout-screen-margin); }
.dg-section-gap { gap: var(--dg-mobile-layout-section-gap); }
.dg-element-gap { gap: var(--dg-mobile-layout-element-gap); }

.dg-type-nav-title {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-nav-title-size);
  font-weight: var(--dg-type-nav-title-weight);
  line-height: var(--dg-type-nav-title-line-height);
}

.dg-type-screen-title {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-screen-title-size);
  font-weight: var(--dg-type-screen-title-weight);
  line-height: var(--dg-type-screen-title-line-height);
}

.dg-type-hero-title {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-hero-title-size);
  font-weight: var(--dg-type-hero-title-weight);
  line-height: var(--dg-type-hero-title-line-height);
}

.dg-type-section-title {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-section-title-size);
  font-weight: var(--dg-type-section-title-weight);
  line-height: var(--dg-type-section-title-line-height);
}

.dg-type-metric-value {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-metric-value-size);
  font-weight: var(--dg-type-metric-value-weight);
  line-height: var(--dg-type-metric-value-line-height);
}

.dg-type-body {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-body-size);
  font-weight: var(--dg-type-body-weight);
  line-height: var(--dg-type-body-line-height);
}

.dg-type-supporting {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-supporting-size);
  font-weight: var(--dg-type-supporting-weight);
  line-height: var(--dg-type-supporting-line-height);
}

.dg-type-caption {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-caption-size);
  font-weight: var(--dg-type-caption-weight);
  line-height: var(--dg-type-caption-line-height);
}

.dg-type-button-label {
  font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: var(--dg-type-button-label-size);
  font-weight: var(--dg-type-button-label-weight);
  line-height: var(--dg-type-button-label-line-height);
}
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
<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" style="font-family: 'Inter', -apple-system, sans-serif">
  <!-- Header Section -->
  <header class="flex items-center justify-between px-[var(--dg-mobile-layout-screen-margin)] pt-[56px] pb-[var(--dg-mobile-layout-section-gap)]">
    <h1 class="dg-type-screen-title">Workouts</h1>
    <div class="flex items-center gap-[var(--dg-mobile-layout-element-gap)]">
      <button class="w-[44px] h-[44px] flex items-center justify-center dg-surface-card rounded-full border border-[var(--dg-color-border-divider)]">
        <i data-lucide="sliders-horizontal" class="w-[20px] h-[20px]"></i>
      </button>
      <button class="w-[44px] h-[44px] flex items-center justify-center dg-surface-card rounded-full border border-[var(--dg-color-border-divider)]">
        <i data-lucide="plus-square" class="w-[20px] h-[20px]"></i>
      </button>
    </div>
  </header>

  <!-- Main Content Scroll Area -->
  <main class="flex-1 px-[var(--dg-mobile-layout-screen-margin)] flex flex-col gap-[var(--dg-mobile-layout-section-gap)] pb-[120px]">
    
    <!-- Top Grid: Workout # and Body Weight -->
    <div class="grid grid-cols-2 gap-[var(--dg-mobile-layout-section-gap)]">
      <!-- Workout Card -->
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col justify-between min-h-[160px]">
        <div class="flex justify-between items-start">
          <div class="relative w-[48px] h-[48px] flex items-center justify-center">
            <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="var(--dg-color-border-divider)" stroke-width="2"></circle>
              <circle cx="24" cy="24" r="22" fill="none" stroke="white" stroke-width="2" stroke-dasharray="138" stroke-dashoffset="35" stroke-linecap="round"></circle>
            </svg>
            <span class="dg-type-section-title">1</span>
          </div>
          <i data-lucide="sliders-horizontal" class="w-[16px] h-[16px] dg-text-medium"></i>
        </div>
        <div>
          <p class="dg-type-body font-semibold">Chest + Triceps</p>
          <p class="dg-type-supporting dg-text-medium">Saturday</p>
        </div>
      </div>

      <!-- Body Weight Card -->
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col justify-between min-h-[160px]">
        <div class="flex justify-end">
          <i data-lucide="sliders-horizontal" class="w-[16px] h-[16px] dg-text-medium"></i>
        </div>
        <div class="flex items-baseline gap-1">
          <span class="dg-type-metric-value">200</span>
          <span class="dg-type-supporting dg-text-medium">lbs</span>
        </div>
        <div>
          <p class="dg-type-body font-semibold">Body Weight</p>
          <p class="dg-type-supporting dg-text-medium">31 min ago</p>
        </div>
      </div>
    </div>

    <!-- Activity Heatmap Card -->
    <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col gap-[var(--dg-spacing-xl)]">
      <!-- Dot Matrix Heatmap -->
      <div class="flex justify-between">
        <!-- Jan -->
        <div class="flex flex-col gap-2">
          <span class="dg-type-caption dg-text-medium text-center">Jan</span>
          <div class="grid grid-cols-4 gap-[6px]">
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
          </div>
        </div>
        <!-- Feb -->
        <div class="flex flex-col gap-2">
          <span class="dg-type-caption dg-text-medium text-center">Feb</span>
          <div class="grid grid-cols-4 gap-[6px]">
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
          </div>
        </div>
        <!-- Mar -->
        <div class="flex flex-col gap-2">
          <span class="dg-type-caption dg-text-medium text-center">Mar</span>
          <div class="grid grid-cols-4 gap-[6px]">
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
            <div class="w-[6px] h-[6px] rounded-full dg-text-low opacity-20 bg-white"></div>
          </div>
        </div>
      </div>

      <!-- Recent Workout Row -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-[var(--dg-spacing-md)]">
          <div class="w-[40px] h-[40px] rounded-full border border-[var(--dg-color-border-divider)] flex items-center justify-center">
            <span class="dg-type-section-title">2</span>
          </div>
          <div>
            <p class="dg-type-body font-semibold">Back + Biceps + Legs</p>
            <p class="dg-type-supporting dg-text-medium">Monday</p>
          </div>
        </div>
        <i data-lucide="sliders-horizontal" class="w-[16px] h-[16px] dg-text-medium"></i>
      </div>
    </div>

    <!-- Volume Card -->
    <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex items-center justify-between">
      <div>
        <p class="dg-type-body font-semibold">Volume lifted</p>
        <p class="dg-type-supporting dg-text-medium">Last 7 days</p>
      </div>
      <div class="flex items-center gap-[var(--dg-spacing-md)]">
        <div class="flex items-baseline gap-1">
          <span class="dg-type-metric-value">3.200</span>
          <span class="dg-type-supporting dg-text-medium">lbs</span>
        </div>
        <i data-lucide="sliders-horizontal" class="w-[16px] h-[16px] dg-text-medium"></i>
      </div>
    </div>

    <!-- Secondary Feature Cards -->
    <div class="grid grid-cols-2 gap-[var(--dg-mobile-layout-section-gap)]">
      <div class="dg-surface-card relative overflow-hidden rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col gap-4 bg-gradient-to-br from-[var(--dg-color-surface-bottom-sheet)] to-[var(--dg-color-surface-card)] border border-[#1f1f1f]">
  <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-secondary)] flex items-center justify-center border border-[#252525]">
    <i data-lucide="target" class="w-[20px] h-[20px] text-white"></i>
  </div>
  <p class="dg-type-body font-semibold text-white">Weekly Goals</p>
</div>
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col gap-2 border border-[var(--dg-color-border-subtle)] shadow-sm" style="border-color: var(--dg-color-action-disabled)">
        <i data-lucide="activity" class="w-[24px] h-[24px] dg-text-medium"></i>
        <p class="dg-type-body font-semibold">Recovery Score</p>
      </div>
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col gap-2">
        <i data-lucide="heart" class="w-[24px] h-[24px] dg-text-medium"></i>
        <p class="dg-type-body font-semibold">Heart Rate</p>
      </div>
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex flex-col gap-2">
        <i data-lucide="book" class="w-[24px] h-[24px] dg-text-medium"></i>
        <p class="dg-type-body font-semibold">Workout Log</p>
      </div>
    </div>

    <!-- Square Action Button -->
    <div class="w-[100px] h-[100px] dg-surface-card rounded-[var(--dg-radii-app)] flex items-center justify-center">
      <div class="grid grid-cols-2 gap-[var(--dg-spacing-xxs)]">
        <div class="w-[12px] h-[12px] border border-white rounded-[2px]"></div>
        <div class="w-[12px] h-[12px] flex items-center justify-center text-[10px] font-bold">+</div>
        <div class="w-[12px] h-[12px] border border-white rounded-[2px]"></div>
        <div class="w-[12px] h-[12px] border border-white rounded-[2px]"></div>
      </div>
    </div>

  </main>

  <!-- Bottom Navigation -->
  <nav class="fixed bottom-0 left-0 right-0 h-[var(--dg-sizing-bottom-nav-height)] dg-bg-primary border-t border-[var(--dg-color-border-divider)] px-[var(--dg-mobile-layout-screen-margin)] flex items-center justify-between z-50">
    <div class="flex flex-col items-center gap-1">
      <div class="w-[48px] h-[48px] flex items-center justify-center dg-text-high">
        <i data-lucide="layout-grid" class="w-[24px] h-[24px]"></i>
      </div>
    </div>
    <div class="flex flex-col items-center gap-1">
      <div class="w-[48px] h-[48px] flex items-center justify-center dg-text-medium opacity-50">
        <i data-lucide="calendar" class="w-[24px] h-[24px]"></i>
      </div>
    </div>
    <div class="flex flex-col items-center gap-1">
      <div class="w-[48px] h-[48px] flex items-center justify-center dg-text-medium opacity-50">
        <i data-lucide="line-chart" class="w-[24px] h-[24px]"></i>
      </div>
    </div>
    <div class="flex flex-col items-center gap-1">
      <div class="w-[48px] h-[48px] flex items-center justify-center dg-text-medium opacity-50">
        <i data-lucide="message-circle" class="w-[24px] h-[24px]"></i>
      </div>
    </div>
  </nav>
</div>
      
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
</html>


Swift UI:

// ════════════════════════════════════════════════════════════
// FILE 1: AppTheme.swift — Add to your project's theme directory
// ════════════════════════════════════════════════════════════

//
//  DesignTokens.swift
//  Drawgle Auto-generated
//

import SwiftUI

struct AppTheme {
    static let backgroundPrimary = Color(hex: "#000000")
    static let backgroundSecondary = Color(hex: "#080808")
    static let surfaceCard = Color(hex: "#121212")
    static let actionPrimary = Color(hex: "#FFFFFF")
    static let actionOnPrimary = Color(hex: "#000000")
    static let textHigh = Color(hex: "#FFFFFF")
    static let textMedium = Color(hex: "#A0A0A0")
    static let textLow = Color(hex: "#505050")
    static let borderDivider = Color(hex: "#222222")
    
    static let borderRadiusApp: CGFloat = 23
    static let borderRadiusPill: CGFloat = 9999.0
    
    static let screenPadding: CGFloat = 20
    static let sectionGap: CGFloat = 12
    static let elementGap: CGFloat = 8
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}


// ════════════════════════════════════════════════════════════
// FILE 2: WorkoutsView.swift — Add to your screens directory
// ════════════════════════════════════════════════════════════

//
//  WorkoutsView.swift
//  Auto-generated by Drawgle
//

import SwiftUI
// Import your project's AppTheme file here
// import AppTheme

// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:
// Instead of copying the generated AppTheme class above, you can easily map the exported tokens
// directly into your project's native theme catalog:
// - AppTheme.backgroundPrimary ➔ Color("PrimaryBackground")
// - AppTheme.surfaceCard       ➔ Color("CardBackground")
// - AppTheme.actionPrimary     ➔ Color.accentColor
// - AppTheme.textHigh          ➔ Color.primary
// - AppTheme.borderRadiusApp   ➔ 32.0 (or your custom corner radius parameter)

struct WorkoutsView: View {
    var body: some View {
        ScrollView {
    VStack() {
        VStack() {
            VStack() {
                Text("Workouts")
                    .font(.system(size: 24))
                    .fontWeight(.semibold)
                    .foregroundColor(Color(hex: "#111827"))
                VStack(spacing: AppTheme.elementGap) {
                    Button(action: {
                        // Action here
                    }) {
                        HStack() {
                            Image(systemName: "sliders.horizontal") // Lucide: sliders-horizontal
                                .font(.system(size: 14))
                                .foregroundColor(Color(hex: "#111827"))
                        }
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                        .background(AppTheme.surfaceCard)
                        .cornerRadius(9999)
                        .foregroundColor(Color(hex: "#111827"))
                    }
                    Button(action: {
                        // Action here
                    }) {
                        HStack() {
                            Image(systemName: "plus.square") // Lucide: plus-square
                                .font(.system(size: 14))
                                .foregroundColor(Color(hex: "#111827"))
                        }
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                        .background(AppTheme.surfaceCard)
                        .cornerRadius(9999)
                        .foregroundColor(Color(hex: "#111827"))
                    }
                }
            }
            .padding(.horizontal, AppTheme.screenPadding)
            .padding(.top, 56)
            .padding(.bottom, AppTheme.sectionGap)
            VStack(spacing: AppTheme.sectionGap) {
                VStack(spacing: AppTheme.sectionGap) {
                    VStack() {
                        VStack(alignment: .leading) {
                            VStack() {
                                Image(systemName: "star") // Lucide: star
                                    .font(.system(size: 14))
                                    .foregroundColor(Color(hex: "#111827"))
                                Text("1")
                                    .font(.system(size: 18))
                                    .fontWeight(.semibold)
                                    .foregroundColor(Color(hex: "#111827"))
                            }
                            .frame(width: 48, height: 48)
                            Image(systemName: "sliders.horizontal") // Lucide: sliders-horizontal
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.textMedium)
                        }
                        VStack() {
                            Text("Chest + Triceps")
                                .font(.system(size: 16))
                                .fontWeight(.semibold)
                                .foregroundColor(Color(hex: "#111827"))
                            Text("Saturday")
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.textMedium)
                        }
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                    .padding(.leading, 16)
                    .padding(.trailing, 16)
                    .background(AppTheme.surfaceCard)
                    .cornerRadius(AppTheme.borderRadiusApp)
                    VStack() {
                        VStack() {
                            Image(systemName: "sliders.horizontal") // Lucide: sliders-horizontal
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.textMedium)
                        }
                        VStack(spacing: 4) {
                            Text("200")
                                .font(.system(size: 32))
                                .fontWeight(.semibold)
                                .foregroundColor(Color(hex: "#111827"))
                            Text("lbs")
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.textMedium)
                        }
                        VStack() {
                            Text("Body Weight")
                                .font(.system(size: 16))
                                .fontWeight(.semibold)
                                .foregroundColor(Color(hex: "#111827"))
                            Text("31 min ago")
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.textMedium)
                        }
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                    .padding(.leading, 16)
                    .padding(.trailing, 16)
                    .background(AppTheme.surfaceCard)
                    .cornerRadius(AppTheme.borderRadiusApp)
                }
                VStack(spacing: 32) {
                    VStack() {
                        VStack(spacing: 8) {
                            Text("Jan")
                                .font(.system(size: 12))
                                .fontWeight(.semibold)
                                .foregroundColor(AppTheme.textMedium)
                                .multilineTextAlignment(.center)
                            VStack(spacing: 6) {
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                            }
                        }
                        VStack(spacing: 8) {
                            Text("Feb")
                                .font(.system(size: 12))
                                .fontWeight(.semibold)
                                .foregroundColor(AppTheme.textMedium)
                                .multilineTextAlignment(.center)
                            VStack(spacing: 6) {
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                            }
                        }
                        VStack(spacing: 8) {
                            Text("Mar")
                                .font(.system(size: 12))
                                .fontWeight(.semibold)
                                .foregroundColor(AppTheme.textMedium)
                                .multilineTextAlignment(.center)
                            VStack(spacing: 6) {
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                                VStack() {
                                }
                                .background(Color(hex: "#FFFFFF"))
                                .cornerRadius(9999)
                                .frame(width: 6, height: 6)
                            }
                        }
                    }
                    VStack() {
                        VStack(spacing: 16) {
                            VStack() {
                                Text("2")
                                    .font(.system(size: 18))
                                    .fontWeight(.semibold)
                                    .foregroundColor(Color(hex: "#111827"))
                            }
                            .cornerRadius(9999)
                            .frame(width: 40, height: 40)
                            VStack() {
                                Text("Back + Biceps + Legs")
                                    .font(.system(size: 16))
                                    .fontWeight(.semibold)
                                    .foregroundColor(Color(hex: "#111827"))
                                Text("Monday")
                                    .font(.system(size: 14))
                                    .foregroundColor(AppTheme.textMedium)
                            }
                        }
                        Image(systemName: "sliders.horizontal") // Lucide: sliders-horizontal
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.textMedium)
                    }
                }
                .padding(.top, 16)
                .padding(.bottom, 16)
                .padding(.leading, 16)
                .padding(.trailing, 16)
                .background(AppTheme.surfaceCard)
                .cornerRadius(AppTheme.borderRadiusApp)
                VStack() {
                    VStack() {
                        Text("Volume lifted")
                            .font(.system(size: 16))
                            .fontWeight(.semibold)
                            .foregroundColor(Color(hex: "#111827"))
                        Text("Last 7 days")
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.textMedium)
                    }
                    VStack(spacing: 16) {
                        VStack(spacing: 4) {
                            Text("3.200")
                                .font(.system(size: 32))
                                .fontWeight(.semibold)
                                .foregroundColor(Color(hex: "#111827"))
                            Text("lbs")
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.textMedium)
                        }
                        Image(systemName: "sliders.horizontal") // Lucide: sliders-horizontal
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.textMedium)
                    }
                }
                .padding(.top, 16)
                .padding(.bottom, 16)
                .padding(.leading, 16)
                .padding(.trailing, 16)
                .background(AppTheme.surfaceCard)
                .cornerRadius(AppTheme.borderRadiusApp)
                VStack(spacing: AppTheme.sectionGap) {
                    VStack(spacing: 16) {
                        VStack() {
                            Image(systemName: "target") // Lucide: target
                                .font(.system(size: 14))
                                .foregroundColor(Color(hex: "#FFFFFF"))
                        }
                        .background(Color(hex: "#1A1A1A"))
                        .cornerRadius(9999)
                        .frame(width: 40, height: 40)
                        Text("Weekly Goals")
                            .font(.system(size: 16))
                            .fontWeight(.semibold)
                            .foregroundColor(Color(hex: "#FFFFFF"))
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                    .padding(.leading, 16)
                    .padding(.trailing, 16)
                    .background(AppTheme.surfaceCard)
                    .cornerRadius(AppTheme.borderRadiusApp)
                    VStack(spacing: 8) {
                        Image(systemName: "activity") // Lucide: activity
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.textMedium)
                        Text("Recovery Score")
                            .font(.system(size: 16))
                            .fontWeight(.semibold)
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                    .padding(.leading, 16)
                    .padding(.trailing, 16)
                    .background(AppTheme.surfaceCard)
                    .cornerRadius(AppTheme.borderRadiusApp)
                    VStack(spacing: 8) {
                        Image(systemName: "heart") // Lucide: heart
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.textMedium)
                        Text("Heart Rate")
                            .font(.system(size: 16))
                            .fontWeight(.semibold)
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                    .padding(.leading, 16)
                    .padding(.trailing, 16)
                    .background(AppTheme.surfaceCard)
                    .cornerRadius(AppTheme.borderRadiusApp)
                    VStack(spacing: 8) {
                        Image(systemName: "book") // Lucide: book
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.textMedium)
                        Text("Workout Log")
                            .font(.system(size: 16))
                            .fontWeight(.semibold)
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 16)
                    .padding(.leading, 16)
                    .padding(.trailing, 16)
                    .background(AppTheme.surfaceCard)
                    .cornerRadius(AppTheme.borderRadiusApp)
                }
                VStack() {
                    VStack(spacing: 4) {
                        VStack() {
                        }
                        .cornerRadius(2)
                        .frame(width: 12, height: 12)
                        VStack() {
                            Text("+")
                        }
                        .frame(width: 12, height: 12)
                        VStack() {
                        }
                        .cornerRadius(2)
                        .frame(width: 12, height: 12)
                        VStack() {
                        }
                        .cornerRadius(2)
                        .frame(width: 12, height: 12)
                    }
                }
                .background(AppTheme.surfaceCard)
                .cornerRadius(AppTheme.borderRadiusApp)
                .frame(width: 100, height: 100)
            }
            .padding(.horizontal, AppTheme.screenPadding)
            .padding(.bottom, 120)
            VStack() {
                VStack(spacing: 4) {
                    VStack() {
                        Image(systemName: "layout.grid") // Lucide: layout-grid
                            .font(.system(size: 14))
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .frame(width: 48, height: 48)
                }
                VStack(spacing: 4) {
                    VStack() {
                        Image(systemName: "calendar") // Lucide: calendar
                            .font(.system(size: 14))
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .frame(width: 48, height: 48)
                }
                VStack(spacing: 4) {
                    VStack() {
                        Image(systemName: "line.chart") // Lucide: line-chart
                            .font(.system(size: 14))
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .frame(width: 48, height: 48)
                }
                VStack(spacing: 4) {
                    VStack() {
                        Image(systemName: "message.circle") // Lucide: message-circle
                            .font(.system(size: 14))
                            .foregroundColor(Color(hex: "#111827"))
                    }
                    .frame(width: 48, height: 48)
                }
            }
            .padding(.horizontal, AppTheme.screenPadding)
            .background(AppTheme.backgroundPrimary)
            .frame(height: 84)
        }
        .background(AppTheme.backgroundPrimary)
        .frame(maxWidth: .infinity)
    }
        }
        .background(AppTheme.backgroundPrimary)
        .edgesIgnoringSafeArea(.all)
    }
}

#Preview {
    WorkoutsView()
}

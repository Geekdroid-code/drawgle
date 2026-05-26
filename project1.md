## HTML:
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="drawgle-google-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@400;500;600;700;800&amp;display=swap">
    <style>
:root {
  --dg-color-text-low-emphasis: #48484A;
  --dg-color-text-high-emphasis: #FFFFFF;
  --dg-color-text-medium-emphasis: #8E8E93;
  --dg-color-action-primary: #32D74B;
  --dg-color-action-disabled: #2C2C2E;
  --dg-color-action-secondary: #FF453A;
  --dg-color-action-on-primary-text: #000000;
  --dg-color-border-divider: rgba(255, 255, 255, 0.08);
  --dg-color-border-focused: rgba(255, 255, 255, 0.20);
  --dg-color-surface-card: #121212;
  --dg-color-surface-modal: #1C1C1E;
  --dg-color-surface-bottom-sheet: #161616;
  --dg-color-background-primary: #000000;
  --dg-color-background-secondary: #0A0A0A;
  --dg-radii-app: 22px;
  --dg-radii-pill: 9999px;
  --dg-sizing-icon-small: 18px;
  --dg-sizing-icon-standard: 24px;
  --dg-sizing-min-touch-target: 48px;
  --dg-sizing-bottom-nav-height: 84px;
  --dg-sizing-standard-input-height: 44px;
  --dg-sizing-standard-button-height: 52px;
  --dg-shadows-none: none;
  --dg-shadows-overlay: 0 12px 32px rgba(0,0,0,0.8);
  --dg-shadows-surface: 0 4px 12px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.1);
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
  --dg-typography-font-family: SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif;
  --dg-type-nav-title-size: 17px;
  --dg-type-nav-title-weight: 600;
  --dg-type-nav-title-line-height: 22px;
  --dg-type-screen-title-size: 34px;
  --dg-type-screen-title-weight: 700;
  --dg-type-screen-title-line-height: 41px;
  --dg-type-hero-title-size: 28px;
  --dg-type-hero-title-weight: 800;
  --dg-type-hero-title-line-height: 34px;
  --dg-type-section-title-size: 13px;
  --dg-type-section-title-weight: 600;
  --dg-type-section-title-line-height: 18px;
  --dg-type-metric-value-size: 24px;
  --dg-type-metric-value-weight: 700;
  --dg-type-metric-value-line-height: 28px;
  --dg-type-body-size: 16px;
  --dg-type-body-weight: 400;
  --dg-type-body-line-height: 21px;
  --dg-type-supporting-size: 14px;
  --dg-type-supporting-weight: 400;
  --dg-type-supporting-line-height: 18px;
  --dg-type-caption-size: 12px;
  --dg-type-caption-weight: 500;
  --dg-type-caption-line-height: 16px;
  --dg-type-button-label-size: 15px;
  --dg-type-button-label-weight: 600;
  --dg-type-button-label-line-height: 20px;
  --dg-border-widths-standard: 1px;
  --dg-mobile-layout-element-gap: 12px;
  --dg-mobile-layout-section-gap: 32px;
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
<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" style="font-family: SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif">
    <!-- Background Immersive Layer -->
    <div class="absolute inset-0 z-0">
        <img src="https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/visual-assets/b8041495-1552-4079-9c20-80bd656e240f/display_1024.png" alt="Background" class="w-full h-full object-cover opacity-20 blur-2xl scale-110">
        <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black"></div>
    </div>

    <!-- Top Navigation Bar -->
    <header class="relative z-10 flex items-center justify-between px-[var(--dg-mobile-layout-screen-margin)] pt-[var(--dg-mobile-layout-safe-area-top)] h-[64px]">
        <button class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <i data-lucide="chevron-left" class="w-6 h-6"></i>
        </button>
        <div class="flex flex-col items-center">
            <span class="text-[10px] uppercase tracking-widest text-[var(--dg-color-text-medium-emphasis)] font-bold">Tempo Decorrido</span>
            <span class="text-[20px] font-mono font-bold tracking-tighter">00:00:01</span>
        </div>
        <button class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <i data-lucide="x" class="w-6 h-6"></i>
        </button>
    </header>

    <!-- Main Content Area -->
    <main class="relative z-10 flex-1 flex flex-col items-center justify-center px-[var(--dg-mobile-layout-screen-margin)] py-[var(--dg-mobile-layout-section-gap)]">
        <!-- Exercise Visual -->
        <div class="w-full max-w-[280px] aspect-square relative flex items-center justify-center mb-8">
            <!-- Red Exercise Icon/Illustration Placeholder -->
            <div class="w-full h-full rounded-[var(--dg-radii-app)] bg-gradient-to-br from-[var(--dg-color-action-secondary)] to-[#C42B22] flex items-center justify-center shadow-2xl">
                <img src="https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/visual-assets/b8041495-1552-4079-9c20-80bd656e240f/display_1024.png" alt="Exercise Illustration" class="w-4/5 h-4/5 object-contain drop-shadow-2xl">
            </div>
        </div>

        <!-- Exercise Info -->
        <div class="text-center space-y-2">
            <h1 class="text-[32px] font-bold leading-tight tracking-tight">Alongamento Dinâmico</h1>
            <p class="text-[var(--dg-color-text-medium-emphasis)] text-[18px]">Próximo: Agachamento Livre</p>
        </div>

        <!-- YouTube Help Button -->
        <button class="mt-8 flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm active:opacity-70 transition-opacity">
            <i data-lucide="youtube" class="w-5 h-5 text-[#FF0000]"></i>
            <span class="text-[14px] font-semibold">Ver execução</span>
        </button>
    </main>

    <!-- Bottom Controls Section -->
    <section class="relative z-10 px-[var(--dg-mobile-layout-screen-margin)] pb-[calc(var(--dg-mobile-layout-safe-area-bottom)+24px)] space-y-8">
        
        <!-- Spotify Integration Card -->
        <div class="dg-surface-card rounded-[var(--dg-radii-app)] p-4 flex items-center gap-4 border border-white/5 shadow-[var(--dg-shadows-surface)]">
            <div class="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                <div class="w-full h-full bg-gradient-to-tr from-green-900 to-zinc-700 flex items-center justify-center">
                    <i data-lucide="music" class="w-6 h-6 text-white/40"></i>
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[14px] font-bold truncate">Phonk Workout Mix 2024</p>
                <p class="text-[12px] text-[var(--dg-color-text-medium-emphasis)] truncate">Spotify • Tocando agora</p>
            </div>
            <div class="flex items-center gap-4 px-2">
                <i data-lucide="skip-back" class="w-5 h-5 text-white/60"></i>
                <i data-lucide="pause" class="w-5 h-5 text-white"></i>
                <i data-lucide="skip-forward" class="w-5 h-5 text-white/60"></i>
            </div>
        </div>

        <!-- Multi-colored Segmented Progress Bar -->
        <div class="space-y-3">
            <div class="h-2 w-full flex gap-1 rounded-full overflow-hidden">
                <div class="h-full w-[15%] bg-[var(--dg-color-action-secondary)]"></div>
                <div class="h-full w-[20%] bg-[#FF9F0A]"></div>
                <div class="h-full w-[25%] bg-[#FFD60A]"></div>
                <div class="h-full w-[30%] bg-[var(--dg-color-action-primary)]"></div>
                <div class="h-full w-[10%] bg-[#BF5AF2]"></div>
            </div>
            <div class="flex justify-between text-[12px] font-bold text-[var(--dg-color-text-medium-emphasis)] uppercase tracking-widest">
                <span>Aquecimento</span>
                <span>01:45 / 12:00</span>
            </div>
        </div>

        <!-- Playback Controls -->
        <div class="flex items-center justify-center gap-10">
            <button class="w-14 h-14 flex items-center justify-center rounded-full bg-white/5 border border-white/10 active:scale-95 transition-transform">
                <i data-lucide="skip-back" class="w-7 h-7"></i>
            </button>
            
            <button class="w-20 h-20 flex items-center justify-center rounded-full bg-[var(--dg-color-action-primary)] text-black shadow-[0_0_30px_rgba(50,215,75,0.3)] active:scale-90 transition-transform">
                <i data-lucide="pause" class="w-10 h-10 fill-current"></i>
            </button>
            
            <button class="w-14 h-14 flex items-center justify-center rounded-full bg-white/5 border border-white/10 active:scale-95 transition-transform">
                <i data-lucide="skip-forward" class="w-7 h-7"></i>
            </button>
        </div>
    </section>
</div>
      <div id="drawgle-export-navigation"><nav data-drawgle-primary-nav class="dg-nav-shell" aria-label="Primary navigation">
  <style>
    [data-drawgle-primary-nav].dg-nav-shell {
      position: fixed;
      bottom: var(--dg-mobile-layout-safe-area-bottom, 16px);
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - (var(--dg-mobile-layout-screen-margin, 20px) * 2));
      max-width: 350px;
      height: 72px;
      background: rgba(18, 18, 18, 0.8);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-radius: var(--dg-radii-pill, 9999px);
      border: 1px solid var(--dg-color-border-divider, rgba(255, 255, 255, 0.08));
      box-shadow: var(--dg-shadows-overlay);
      padding: 6px;
      z-index: 1000;
      display: flex;
      align-items: center;
      box-sizing: border-box;
    }

    [data-drawgle-primary-nav] .dg-nav-shell-inner {
      display: flex;
      width: 100%;
      height: 100%;
      justify-content: space-between;
      align-items: center;
    }

    [data-drawgle-primary-nav] .dg-nav-item {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      color: var(--dg-color-text-medium-emphasis, #8E8E93);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    [data-drawgle-primary-nav] .dg-nav-icon {
      width: var(--dg-sizing-icon-standard, 24px);
      height: var(--dg-sizing-icon-standard, 24px);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    [data-drawgle-primary-nav] .dg-nav-icon svg {
      width: 22px;
      height: 22px;
      stroke-width: 1.5px;
    }

    [data-drawgle-primary-nav] .dg-nav-label {
      font-size: var(--dg-type-caption-size, 11px);
      font-weight: var(--dg-type-caption-weight, 500);
      line-height: var(--dg-type-caption-line-height, 1);
      letter-spacing: 0.02em;
    }

    /* Active State for Standard Tabs */
    [data-drawgle-primary-nav] .dg-nav-item[]:not([data-nav-item-id="active-session"]) {
      color: var(--dg-color-text-high-emphasis, #FFFFFF);
    }

    [data-drawgle-primary-nav] .dg-nav-item[]:not([data-nav-item-id="active-session"])::after {
      content: '';
      position: absolute;
      bottom: 4px;
      width: 4px;
      height: 4px;
      background: var(--dg-color-action-primary, #32D74B);
      border-radius: 50%;
    }

    /* Specialized Play Button Treatment */
    [data-drawgle-primary-nav] .dg-nav-item[data-nav-item-id="active-session"] {
      flex: 0 0 60px;
      height: 60px;
      background: var(--dg-color-action-primary, #32D74B);
      color: var(--dg-color-action-on-primary-text, #000000);
      border-radius: 50%;
      margin-left: 4px;
      box-shadow: 0 4px 12px rgba(50, 215, 75, 0.3);
    }

    [data-drawgle-primary-nav] .dg-nav-item[data-nav-item-id="active-session"] .dg-nav-label {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
    }

    [data-drawgle-primary-nav] .dg-nav-item[data-nav-item-id="active-session"] .dg-nav-icon svg {
      fill: currentColor;
      stroke-width: 0;
    }

    [data-drawgle-primary-nav] .dg-nav-item:active {
      opacity: 0.7;
      transform: scale(0.96);
    }
  </style>

  <div class="dg-nav-shell-inner">
    <button type="button" class="dg-nav-item" data-nav-item-id="home" aria-label="Home">
      <span class="dg-nav-icon"><i data-lucide="home"></i></span>
      <span class="dg-nav-label">Home</span>
    </button>

    <button type="button" class="dg-nav-item" data-nav-item-id="routine" aria-label="Rotina">
      <span class="dg-nav-icon"><i data-lucide="calendar"></i></span>
      <span class="dg-nav-label">Rotina</span>
    </button>

    <button type="button" class="dg-nav-item" data-nav-item-id="settings" aria-label="Ajustes">
      <span class="dg-nav-icon"><i data-lucide="settings"></i></span>
      <span class="dg-nav-label">Ajustes</span>
    </button>

    <button type="button" class="dg-nav-item" data-nav-item-id="active-session" aria-label="Play Workout">
      <span class="dg-nav-icon"><i data-lucide="play"></i></span>
      <span class="dg-nav-label">Play</span>
    </button>
  </div>
</nav></div>
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



## flutter

// ════════════════════════════════════════════════════════════
// FILE 1: app_theme.dart — Add to your project's theme directory
// ════════════════════════════════════════════════════════════

//
// app_theme.dart
// Drawgle Auto-generated
//

import 'package:flutter/material.dart';

class AppTheme {
  static const Color backgroundPrimary = Color(0xFF000000);
  static const Color backgroundSecondary = Color(0xFF0A0A0A);
  static const Color surfaceCard = Color(0xFF121212);
  static const Color actionPrimary = Color(0xFF32D74B);
  static const Color actionOnPrimary = Color(0xFF000000);
  static const Color textHigh = Color(0xFFFFFFFF);
  static const Color textMedium = Color(0xFF8E8E93);
  static const Color textLow = Color(0xFF48484A);
  static const Color borderDivider = Color(0xFFFFFFFF);
  
  static const double borderRadiusApp = 22;
  static const double borderRadiusPill = 9999.0;
  
  static const double screenPadding = 20;
  static const double sectionGap = 32;
  static const double elementGap = 12;
}


// ════════════════════════════════════════════════════════════
// FILE 2: workoutplayer_screen.dart — Add to your screens directory
// ════════════════════════════════════════════════════════════

//
// workoutplayer_screen.dart
// Auto-generated by Drawgle
//

import 'package:flutter/material.dart';
// Import your project's AppTheme here
// import 'package:your_app/theme/app_theme.dart';

// 💡 PRODUCTION DESIGN SYSTEM INTEGRATION HINT:
// Instead of copying the generated AppTheme class above, you can easily map the exported tokens
// directly to your existing Flutter ColorScheme / TextTheme design system:
// - AppTheme.backgroundPrimary ➔ Theme.of(context).colorScheme.background
// - AppTheme.surfaceCard       ➔ Theme.of(context).colorScheme.surface
// - AppTheme.actionPrimary     ➔ Theme.of(context).colorScheme.primary
// - AppTheme.textHigh          ➔ Theme.of(context).colorScheme.onBackground
// - AppTheme.borderRadiusApp   ➔ 32.0 (or your custom double corner constant)

class WorkoutPlayerScreen extends StatelessWidget {
  const WorkoutPlayerScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold( 
      backgroundColor: AppTheme.backgroundPrimary,
      body: SafeArea(
        child: Stack(
          children: [
            SingleChildScrollView(
              child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisAlignment: MainAxisAlignment.start,
    children: [
    Stack(
      children: [
      Positioned.fill(
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(0.0),
          child: Image.network(
            'https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/visual-assets/b8041495-1552-4079-9c20-80bd656e240f/display_1024.png',
            fit: BoxFit.cover,
          ),
        )
        ],
      ),
      ),
    Container(
      width: double.infinity,
      decoration: BoxDecoration(
      color: AppTheme.backgroundPrimary,
    ),
      child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
      Container(
        height: 64.0,
        padding: EdgeInsets.only(left: AppTheme.screenPadding, top: 16.0, right: AppTheme.screenPadding, bottom: 0.0),
        child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: Color(0xFFFFFFFF),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9999.0),
            ),
            padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chevron_left, size: 14.0, color: Color(0xFF111827))
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
          Text(
            'Tempo Decorrido',
            style: TextStyle(
              fontSize: 14.0,
              color: AppTheme.textMedium,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            '00:00:01',
            style: TextStyle(
              fontSize: 14.0,
              color: Color(0xFF111827),
              fontWeight: FontWeight.bold,
            ),
          )
          ],
        ),
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: Color(0xFFFFFFFF),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9999.0),
            ),
            padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.x, size: 14.0, color: Color(0xFF111827))
            ],
          ),
        )
        ],
      ),
      ),
      Expanded(
        child: Container(
        width: double.infinity,
        padding: EdgeInsets.only(left: AppTheme.screenPadding, top: AppTheme.sectionGap, right: AppTheme.screenPadding, bottom: AppTheme.sectionGap),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
        Container(
          width: double.infinity,
          child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFFF453A), Color(0xFFC42B22)],
      ),
      borderRadius: BorderRadius.circular(AppTheme.borderRadiusApp),
    ),
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(0.0),
              child: Image.network(
                'https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/visual-assets/b8041495-1552-4079-9c20-80bd656e240f/display_1024.png',
                fit: BoxFit.cover,
              ),
            )
            ],
          ),
          )
          ],
        ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
          Text(
            'Alongamento Dinâmico',
            style: TextStyle(
              fontSize: 14.0,
              color: Color(0xFF111827),
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            'Próximo: Agachamento Livre',
            style: TextStyle(
              fontSize: 14.0,
              color: AppTheme.textMedium,
            ),
          )
          ],
        ),
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: Color(0xFFFFFFFF),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9999.0),
            ),
            padding: EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.youtube, size: 14.0, color: Color(0xFFFF0000)),
              SizedBox(width: 8.0),
              Text(
                'Ver execução',
                style: TextStyle(
                  fontSize: 14.0,
                  color: Color(0xFF111827),
                  fontWeight: FontWeight.bold,
                ),
              )
            ],
          ),
        )
        ],
      ),
      ),
      ),
      Container(
        padding: EdgeInsets.only(left: AppTheme.screenPadding, top: 0.0, right: AppTheme.screenPadding, bottom: 40.0),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
        Container(
          padding: EdgeInsets.only(left: 16.0, top: 16.0, right: 16.0, bottom: 16.0),
          decoration: BoxDecoration(
      color: AppTheme.surfaceCard,
      borderRadius: BorderRadius.circular(AppTheme.borderRadiusApp),
      border: Border.all(color: Color(0xFFFFFFFF), width: 1.0),
    ),
          child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
          Container(
            width: 48.0,
    height: 48.0,
            decoration: BoxDecoration(
      color: Color(0xFF27272A),
      borderRadius: BorderRadius.circular(12.0),
    ),
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
            Container(
              width: double.infinity,
              child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
              Icon(Icons.music, size: 14.0, color: Color(0xFF111827))
              ],
            ),
            )
            ],
          ),
          ),
          SizedBox(width: 16.0),
          Expanded(
            child: Container(
            width: double.infinity,
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
            Text(
              'Phonk Workout Mix 2024',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'Spotify • Tocando agora',
              style: TextStyle(
                fontSize: 14.0,
                color: AppTheme.textMedium,
              ),
            )
            ],
          ),
          ),
          ),
          SizedBox(width: 16.0),
          Container(
            padding: EdgeInsets.only(left: 8.0, top: 0.0, right: 8.0, bottom: 0.0),
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
            Icon(Icons.skip_back, size: 14.0, color: Color(0xFF111827)),
            SizedBox(width: 16.0),
            Icon(Icons.pause, size: 14.0, color: Color(0xFFFFFFFF)),
            SizedBox(width: 16.0),
            Icon(Icons.skip_forward, size: 14.0, color: Color(0xFF111827))
            ],
          ),
          )
          ],
        ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
          Container(
            width: double.infinity,
    height: 8.0,
            decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(9999.0),
    ),
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
            Container(
              decoration: BoxDecoration(
      color: Color(0xFFFF453A),
    ),
            ),
            SizedBox(width: 4.0),
            Container(
              decoration: BoxDecoration(
      color: Color(0xFFFF9F0A),
    ),
            ),
            SizedBox(width: 4.0),
            Container(
              decoration: BoxDecoration(
      color: Color(0xFFFFD60A),
    ),
            ),
            SizedBox(width: 4.0),
            Container(
              decoration: BoxDecoration(
      color: AppTheme.actionPrimary,
    ),
            ),
            SizedBox(width: 4.0),
            Container(
              decoration: BoxDecoration(
      color: Color(0xFFBF5AF2),
    ),
            )
            ],
          ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
            Text(
              'Aquecimento',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
              ),
            ),
            Text(
              '01:45 / 12:00',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
              ),
            )
            ],
          )
          ],
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: Color(0xFFFFFFFF),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9999.0),
              ),
              padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.skip_back, size: 14.0, color: Color(0xFF111827))
              ],
            ),
          ),
          SizedBox(width: 40.0),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.actionPrimary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9999.0),
              ),
              padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.pause, size: 14.0, color: Color(0xFF111827))
              ],
            ),
          ),
          SizedBox(width: 40.0),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: Color(0xFFFFFFFF),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(9999.0),
              ),
              padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.skip_forward, size: 14.0, color: Color(0xFF111827))
              ],
            ),
          )
          ],
        )
        ],
      ),
      )
      ],
    ),
    ),
      ],
    ),
    ],
  ),
            ),
  Align(
    alignment: Alignment.bottomCenter,
    child: Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    mainAxisAlignment: MainAxisAlignment.start,
    children: [
    Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
      ElevatedButton(
        onPressed: () {},
        style: ElevatedButton.styleFrom(
          backgroundColor: Color(0xFFFFFFFF),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.0),
          ),
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.home, size: 14.0, color: Color(0xFF111827)),
            SizedBox(width: 8.0),
            Text(
              'Home',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
              ),
            )
          ],
        ),
      ),
      ElevatedButton(
        onPressed: () {},
        style: ElevatedButton.styleFrom(
          backgroundColor: Color(0xFFFFFFFF),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.0),
          ),
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.calendar, size: 14.0, color: Color(0xFF111827)),
            SizedBox(width: 8.0),
            Text(
              'Rotina',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
              ),
            )
          ],
        ),
      ),
      ElevatedButton(
        onPressed: () {},
        style: ElevatedButton.styleFrom(
          backgroundColor: Color(0xFFFFFFFF),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.0),
          ),
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.settings, size: 14.0, color: Color(0xFF111827)),
            SizedBox(width: 8.0),
            Text(
              'Ajustes',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
              ),
            )
          ],
        ),
      ),
      ElevatedButton(
        onPressed: () {},
        style: ElevatedButton.styleFrom(
          backgroundColor: Color(0xFFFFFFFF),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.0),
          ),
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.play, size: 14.0, color: Color(0xFF111827)),
            SizedBox(width: 8.0),
            Text(
              'Play',
              style: TextStyle(
                fontSize: 14.0,
                color: Color(0xFF111827),
              ),
            )
          ],
        ),
      )
      ],
    )
    ],
  ),
  )
          ],
        ),
      ),
    );
  }
}

screen 1

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="drawgle-google-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&amp;display=swap">
    <style>
:root {
  --dg-color-text-low-emphasis: #666666;
  --dg-color-text-high-emphasis: #FFFFFF;
  --dg-color-text-medium-emphasis: #A1A1A1;
  --dg-color-action-primary: #D4FF5E;
  --dg-color-action-disabled: #2A2A2A;
  --dg-color-action-secondary: #C8B6FF;
  --dg-color-action-on-primary-text: #000000;
  --dg-color-border-divider: #262626;
  --dg-color-border-focused: #D4FF5E;
  --dg-color-surface-card: #161616;
  --dg-color-surface-modal: #1E1E1E;
  --dg-color-surface-bottom-sheet: #121212;
  --dg-color-background-primary: #0F0F0F;
  --dg-color-background-secondary: #1A1A1A;
  --dg-radii-app: 24px;
  --dg-radii-pill: 9999px;
  --dg-sizing-icon-small: 20px;
  --dg-sizing-icon-standard: 24px;
  --dg-sizing-min-touch-target: 48px;
  --dg-sizing-bottom-nav-height: 80px;
  --dg-sizing-standard-input-height: 52px;
  --dg-sizing-standard-button-height: 56px;
  --dg-shadows-none: none;
  --dg-shadows-overlay: 0px 12px 40px rgba(0, 0, 0, 0.8);
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
  --dg-typography-font-family: 'Space Grotesk', 'JetBrains Mono', sans-serif;
  --dg-type-nav-title-size: 18px;
  --dg-type-nav-title-weight: 700;
  --dg-type-nav-title-line-height: 24px;
  --dg-type-screen-title-size: 28px;
  --dg-type-screen-title-weight: 800;
  --dg-type-screen-title-line-height: 32px;
  --dg-type-hero-title-size: 34px;
  --dg-type-hero-title-weight: 800;
  --dg-type-hero-title-line-height: 40px;
  --dg-type-section-title-size: 14px;
  --dg-type-section-title-weight: 600;
  --dg-type-section-title-line-height: 20px;
  --dg-type-metric-value-size: 24px;
  --dg-type-metric-value-weight: 700;
  --dg-type-metric-value-line-height: 28px;
  --dg-type-body-size: 16px;
  --dg-type-body-weight: 400;
  --dg-type-body-line-height: 24px;
  --dg-type-supporting-size: 14px;
  --dg-type-supporting-weight: 500;
  --dg-type-supporting-line-height: 20px;
  --dg-type-caption-size: 12px;
  --dg-type-caption-weight: 400;
  --dg-type-caption-line-height: 16px;
  --dg-type-button-label-size: 16px;
  --dg-type-button-label-weight: 700;
  --dg-type-button-label-line-height: 20px;
  --dg-border-widths-standard: 1.5px;
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
<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" style="font-family: 'Space Grotesk', 'JetBrains Mono', sans-serif">
  <!-- Header Section -->
  <header class="flex items-center justify-between px-[var(--dg-mobile-layout-screen-margin)] pt-[var(--dg-mobile-layout-safe-area-top)] mt-4">
    <div class="flex flex-col">
      <span class="text-[var(--dg-color-text-medium-emphasis)] dg-type-supporting">Welcome back,</span>
      <h1 class="dg-type-screen-title">Alex Rivera</h1>
    </div>
    <div class="w-12 h-12 rounded-full border-[1.5px] border-[var(--dg-color-border-divider)] overflow-hidden">
      <img src="https://images.pexels.com/photos/27663571/pexels-photo-27663571.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" alt="Profile" class="w-full h-full object-cover">
    </div>
  </header>

  <!-- Main Content Scrollable Rail -->
  <main class="flex-1 flex flex-col gap-[var(--dg-mobile-layout-section-gap)] pt-8 pb-[calc(var(--dg-mobile-layout-safe-area-bottom)+112px)]">
    
    <!-- Hero Progress Section -->
    <section class="px-[var(--dg-mobile-layout-screen-margin)] flex flex-col items-center">
      <div class="relative w-64 h-64 flex items-center justify-center">
        <!-- Progress Ring Background -->
        <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" stroke="var(--dg-color-background-secondary)" stroke-width="8" fill="transparent" />
          <!-- Progress Ring Foreground (Lime #D4FF5E) -->
          <circle cx="50" cy="50" r="44" stroke="#D4FF5E" stroke-width="8" fill="transparent" stroke-dasharray="276.46" stroke-dashoffset="110.58" stroke-linecap="round" />
        </svg>
        <!-- Metric Value Center -->
        <div class="flex flex-col items-center text-center z-10">
          <span class="text-[48px] font-extrabold leading-none text-[var(--dg-color-action-primary)]">3/5</span>
          <span class="dg-type-section-title uppercase tracking-widest text-[var(--dg-color-text-medium-emphasis)]">Tasks Done</span>
        </div>
      </div>
      
      <!-- Quick Stats Row -->
      <div class="grid grid-cols-3 gap-[var(--dg-mobile-layout-element-gap)] w-full mt-8">
        <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] p-[var(--dg-spacing-md)] flex flex-col items-center">
          <i data-lucide="zap" class="text-[var(--dg-color-action-primary)] mb-1" width="20" height="20"></i>
          <span class="dg-type-metric-value">12</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Day Streak</span>
        </div>
        <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] p-[var(--dg-spacing-md)] flex flex-col items-center">
          <i data-lucide="leaf" class="text-[var(--dg-color-action-secondary)] mb-1" width="20" height="20"></i>
          <span class="dg-type-metric-value">4.2</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">CO2 Saved</span>
        </div>
        <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] p-[var(--dg-spacing-md)] flex flex-col items-center">
          <i data-lucide="award" class="text-white mb-1" width="20" height="20"></i>
          <span class="dg-type-metric-value">850</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Points</span>
        </div>
      </div>
    </section>

    <!-- Streak Badges Horizontal Scroll -->
    <section class="flex flex-col gap-[var(--dg-mobile-layout-element-gap)]">
      <div class="px-[var(--dg-mobile-layout-screen-margin)] flex justify-between items-end">
        <h2 class="dg-type-section-title uppercase tracking-wider text-[var(--dg-color-text-medium-emphasis)]">Achievements</h2>
        <span class="dg-type-caption text-[var(--dg-color-action-primary)]">View All</span>
      </div>
      <div class="flex overflow-x-auto no-scrollbar gap-4 px-[var(--dg-mobile-layout-screen-margin)]">
        <div class="flex-shrink-0 w-20 h-24 dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-action-primary)] flex flex-col items-center justify-center gap-2">
          <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-primary)] flex items-center justify-center">
            <i data-lucide="flame" class="text-black" width="20" height="20"></i>
          </div>
          <span class="dg-type-caption font-bold">7 Day</span>
        </div>
        <div class="flex-shrink-0 w-20 h-24 dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] flex flex-col items-center justify-center gap-2">
          <div class="w-10 h-10 rounded-full bg-[var(--dg-color-background-secondary)] flex items-center justify-center">
            <i data-lucide="droplets" class="text-[var(--dg-color-text-medium-emphasis)]" width="20" height="20"></i>
          </div>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Water</span>
        </div>
        <div class="flex-shrink-0 w-20 h-24 dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] flex flex-col items-center justify-center gap-2">
          <div class="w-10 h-10 rounded-full bg-[var(--dg-color-background-secondary)] flex items-center justify-center">
            <i data-lucide="wind" class="text-[var(--dg-color-text-medium-emphasis)]" width="20" height="20"></i>
          </div>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Air</span>
        </div>
        <div class="flex-shrink-0 w-20 h-24 dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] flex flex-col items-center justify-center gap-2">
          <div class="w-10 h-10 rounded-full bg-[var(--dg-color-background-secondary)] flex items-center justify-center">
            <i data-lucide="recycle" class="text-[var(--dg-color-text-medium-emphasis)]" width="20" height="20"></i>
          </div>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Waste</span>
        </div>
        <div class="flex-shrink-0 w-20 h-24 dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] flex flex-col items-center justify-center gap-2">
          <div class="w-10 h-10 rounded-full bg-[var(--dg-color-background-secondary)] flex items-center justify-center">
            <i data-lucide="sun" class="text-[var(--dg-color-text-medium-emphasis)]" width="20" height="20"></i>
          </div>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Solar</span>
        </div>
      </div>
    </section>

    <!-- Daily Tasks List -->
    <section class="px-[var(--dg-mobile-layout-screen-margin)] flex flex-col gap-[var(--dg-mobile-layout-element-gap)]">
      <h2 class="dg-type-section-title uppercase tracking-wider text-[var(--dg-color-text-medium-emphasis)]">Daily Tasks</h2>
      
      <!-- Task Card 1 (Completed) -->
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] p-[var(--dg-spacing-md)] flex items-center justify-between opacity-60">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[var(--dg-color-background-secondary)] flex items-center justify-center">
            <i data-lucide="bike" class="text-[var(--dg-color-action-primary)]"></i>
          </div>
          <div class="flex flex-col">
            <span class="dg-type-body font-bold line-through">Cycle to Work</span>
            <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">+50 Points</span>
          </div>
        </div>
        <div class="w-8 h-8 rounded-full bg-[var(--dg-color-action-primary)] flex items-center justify-center">
          <i data-lucide="check" class="text-black" width="18" height="18"></i>
        </div>
      </div>

      <!-- Task Card 2 (Active) -->
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-action-primary)] p-[var(--dg-spacing-md)] flex items-center justify-between shadow-[var(--dg-shadows-surface)]">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[var(--dg-color-action-primary)] flex items-center justify-center">
            <i data-lucide="shopping-bag" class="text-black"></i>
          </div>
          <div class="flex flex-col">
            <span class="dg-type-body font-bold">No Plastic Bags</span>
            <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">+30 Points</span>
          </div>
        </div>
        <div class="w-8 h-8 rounded-full border-2 border-[var(--dg-color-action-primary)] flex items-center justify-center">
          <!-- Empty Checkbox -->
        </div>
      </div>

      <!-- Task Card 3 (Active) -->
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] p-[var(--dg-spacing-md)] flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[var(--dg-color-background-secondary)] flex items-center justify-center">
            <i data-lucide="timer" class="text-white"></i>
          </div>
          <div class="flex flex-col">
            <span class="dg-type-body font-bold">5-Min Shower</span>
            <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">+20 Points</span>
          </div>
        </div>
        <div class="w-8 h-8 rounded-full border-2 border-[var(--dg-color-border-divider)] flex items-center justify-center">
          <!-- Empty Checkbox -->
        </div>
      </div>
    </section>

    <!-- Weekly Impact Chart -->
    <section class="px-[var(--dg-mobile-layout-screen-margin)] flex flex-col gap-[var(--dg-mobile-layout-element-gap)]">
      <h2 class="dg-type-section-title uppercase tracking-wider text-[var(--dg-color-text-medium-emphasis)]">Weekly Impact</h2>
      <div class="dg-surface-card rounded-[var(--dg-radii-app)] border-[1.5px] border-[var(--dg-color-border-divider)] p-[var(--dg-spacing-md)] h-48 flex flex-col justify-between">
        <div class="flex items-end justify-between h-32 px-2">
          <!-- Mon -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-secondary)] rounded-t-full" style="height: 40%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">M</span>
          </div>
          <!-- Tue -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-secondary)] rounded-t-full" style="height: 65%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">T</span>
          </div>
          <!-- Wed -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-secondary)] rounded-t-full" style="height: 50%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">W</span>
          </div>
          <!-- Thu -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-primary)] rounded-t-full shadow-[0_0_10px_rgba(212,255,94,0.4)]" style="height: 90%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-high-emphasis)] font-bold">T</span>
          </div>
          <!-- Fri -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-disabled)] rounded-t-full" style="height: 10%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">F</span>
          </div>
          <!-- Sat -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-disabled)] rounded-t-full" style="height: 10%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">S</span>
          </div>
          <!-- Sun -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-3 bg-[var(--dg-color-action-disabled)] rounded-t-full" style="height: 10%"></div>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">S</span>
          </div>
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-[var(--dg-color-border-divider)]">
          <span class="dg-type-supporting text-[var(--dg-color-text-medium-emphasis)]">Best Day: Thursday</span>
          <span class="dg-type-supporting font-bold text-[var(--dg-color-action-primary)]">120kg CO2</span>
        </div>
      </div>
    </section>

  </main>
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
      height: var(--dg-sizing-bottom-nav-height, 80px);
      background: rgba(18, 18, 18, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: var(--dg-border-widths-standard, 1.5px) solid var(--dg-color-border-divider, #262626);
      border-radius: var(--dg-radii-app, 24px);
      box-shadow: var(--dg-shadows-overlay);
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 0 8px;
      z-index: 1000;
      box-sizing: border-box;
    }

    [data-drawgle-primary-nav] .dg-nav-item {
      position: relative;
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      gap: 6px;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    [data-drawgle-primary-nav] .dg-nav-item:active {
      transform: scale(0.92);
    }

    [data-drawgle-primary-nav] .dg-nav-icon-wrapper {
      position: relative;
      width: 44px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--dg-radii-pill, 9999px);
      transition: background-color 0.2s ease, color 0.2s ease;
      color: var(--dg-color-text-low-emphasis, #666666);
    }

    [data-drawgle-primary-nav] .dg-nav-icon-wrapper i {
      width: var(--dg-sizing-icon-standard, 24px);
      height: var(--dg-sizing-icon-standard, 24px);
      stroke-width: 2px;
    }

    [data-drawgle-primary-nav] .dg-nav-label {
      font-family: inherit;
      font-size: var(--dg-type-caption-size, 12px);
      font-weight: var(--dg-type-caption-weight, 400);
      line-height: var(--dg-type-caption-line-height, 16px);
      color: var(--dg-color-text-low-emphasis, #666666);
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    /* Active State: Neon Earth Style */
    [data-drawgle-primary-nav] .dg-nav-item[] .dg-nav-icon-wrapper {
      color: var(--dg-color-action-primary, #D4FF5E);
    }

    [data-drawgle-primary-nav] .dg-nav-item[] .dg-nav-label {
      color: var(--dg-color-action-primary, #D4FF5E);
      font-weight: 700;
    }

    /* Active Indicator Glow */
    [data-drawgle-primary-nav] .dg-nav-item[]::after {
      content: '';
      position: absolute;
      top: 12px;
      width: 4px;
      height: 4px;
      background: var(--dg-color-action-primary, #D4FF5E);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--dg-color-action-primary, #D4FF5E);
    }
  </style>

  <button type="button" class="dg-nav-item" data-nav-item-id="home" aria-label="Today">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="leaf"></i>
    </span>
    <span class="dg-nav-label">Today</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="challenges" aria-label="Challenges">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="target"></i>
    </span>
    <span class="dg-nav-label">Challenges</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="leaderboard" aria-label="Community">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="trophy"></i>
    </span>
    <span class="dg-nav-label">Community</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="profile" aria-label="Impact">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="user"></i>
    </span>
    <span class="dg-nav-label">Impact</span>
  </button>
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


2. 

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="drawgle-google-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&amp;display=swap">
    <style>
:root {
  --dg-color-text-low-emphasis: #666666;
  --dg-color-text-high-emphasis: #FFFFFF;
  --dg-color-text-medium-emphasis: #A1A1A1;
  --dg-color-action-primary: #D4FF5E;
  --dg-color-action-disabled: #2A2A2A;
  --dg-color-action-secondary: #C8B6FF;
  --dg-color-action-on-primary-text: #000000;
  --dg-color-border-divider: #262626;
  --dg-color-border-focused: #D4FF5E;
  --dg-color-surface-card: #161616;
  --dg-color-surface-modal: #1E1E1E;
  --dg-color-surface-bottom-sheet: #121212;
  --dg-color-background-primary: #0F0F0F;
  --dg-color-background-secondary: #1A1A1A;
  --dg-radii-app: 24px;
  --dg-radii-pill: 9999px;
  --dg-sizing-icon-small: 20px;
  --dg-sizing-icon-standard: 24px;
  --dg-sizing-min-touch-target: 48px;
  --dg-sizing-bottom-nav-height: 80px;
  --dg-sizing-standard-input-height: 52px;
  --dg-sizing-standard-button-height: 56px;
  --dg-shadows-none: none;
  --dg-shadows-overlay: 0px 12px 40px rgba(0, 0, 0, 0.8);
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
  --dg-typography-font-family: 'Space Grotesk', 'JetBrains Mono', sans-serif;
  --dg-type-nav-title-size: 18px;
  --dg-type-nav-title-weight: 700;
  --dg-type-nav-title-line-height: 24px;
  --dg-type-screen-title-size: 28px;
  --dg-type-screen-title-weight: 800;
  --dg-type-screen-title-line-height: 32px;
  --dg-type-hero-title-size: 34px;
  --dg-type-hero-title-weight: 800;
  --dg-type-hero-title-line-height: 40px;
  --dg-type-section-title-size: 14px;
  --dg-type-section-title-weight: 600;
  --dg-type-section-title-line-height: 20px;
  --dg-type-metric-value-size: 24px;
  --dg-type-metric-value-weight: 700;
  --dg-type-metric-value-line-height: 28px;
  --dg-type-body-size: 16px;
  --dg-type-body-weight: 400;
  --dg-type-body-line-height: 24px;
  --dg-type-supporting-size: 14px;
  --dg-type-supporting-weight: 500;
  --dg-type-supporting-line-height: 20px;
  --dg-type-caption-size: 12px;
  --dg-type-caption-weight: 400;
  --dg-type-caption-line-height: 16px;
  --dg-type-button-label-size: 16px;
  --dg-type-button-label-weight: 700;
  --dg-type-button-label-line-height: 20px;
  --dg-border-widths-standard: 1.5px;
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
<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" style="font-family: 'Space Grotesk', 'JetBrains Mono', sans-serif">
  <!-- Header Section -->
  <header class="pt-[var(--dg-mobile-layout-safe-area-top)] px-[var(--dg-mobile-layout-screen-margin)] flex flex-col gap-[var(--dg-spacing-md)]">
    <div class="flex items-center justify-between">
      <h1 class="dg-type-screen-title">Challenges</h1>
      <div class="w-10 h-10 rounded-full overflow-hidden border-[1.5px] border-[var(--dg-color-border-divider)]">
        <img src="https://images.pexels.com/photos/27663571/pexels-photo-27663571.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" alt="Profile" class="w-full h-full object-cover">
      </div>
    </div>

    <!-- Search Bar -->
    <div class="relative w-full h-[var(--dg-sizing-standard-input-height)]">
      <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <i data-lucide="search" class="w-5 h-5 text-[var(--dg-color-text-low-emphasis)]"></i>
      </div>
      <input type="text" placeholder="Search missions..." class="w-full h-full bg-[var(--dg-color-background-secondary)] border-[var(--dg-border-widths-standard)] border-[var(--dg-color-border-divider)] rounded-[var(--dg-radii-pill)] pl-12 pr-4 text-[var(--dg-type-body-size)] focus:border-[var(--dg-color-border-focused)] outline-none transition-colors">
    </div>

    <!-- Segmented Control -->
    <div class="flex p-1 bg-[var(--dg-color-background-secondary)] rounded-[var(--dg-radii-pill)] w-full">
      <button class="flex-1 py-2 rounded-[var(--dg-radii-pill)] bg-[var(--dg-color-surface-card)] text-[var(--dg-color-text-high-emphasis)] font-semibold text-sm shadow-sm">
        Available
      </button>
      <button class="flex-1 py-2 rounded-[var(--dg-radii-pill)] text-[var(--dg-color-text-medium-emphasis)] font-semibold text-sm">
        Active
      </button>
    </div>
  </header>

  <!-- Category Chips (Horizontal Scroll) -->
  <div class="mt-6 flex overflow-x-auto no-scrollbar px-[var(--dg-mobile-layout-screen-margin)] gap-[var(--dg-spacing-xs)]">
    <div class="flex-shrink-0 px-5 py-2 bg-[var(--dg-color-action-secondary)] rounded-[var(--dg-radii-pill)]">
      <span class="text-black font-bold text-xs uppercase tracking-wider">All</span>
    </div>
    <div class="flex-shrink-0 px-5 py-2 bg-[var(--dg-color-background-secondary)] border-[var(--dg-border-widths-standard)] border-[var(--dg-color-border-divider)] rounded-[var(--dg-radii-pill)]">
      <span class="text-[var(--dg-color-text-medium-emphasis)] font-bold text-xs uppercase tracking-wider">Energy</span>
    </div>
    <div class="flex-shrink-0 px-5 py-2 bg-[var(--dg-color-background-secondary)] border-[var(--dg-border-widths-standard)] border-[var(--dg-color-border-divider)] rounded-[var(--dg-radii-pill)]">
      <span class="text-[var(--dg-color-text-medium-emphasis)] font-bold text-xs uppercase tracking-wider">Waste</span>
    </div>
    <div class="flex-shrink-0 px-5 py-2 bg-[var(--dg-color-background-secondary)] border-[var(--dg-border-widths-standard)] border-[var(--dg-color-border-divider)] rounded-[var(--dg-radii-pill)]">
      <span class="text-[var(--dg-color-text-medium-emphasis)] font-bold text-xs uppercase tracking-wider">Water</span>
    </div>
    <div class="flex-shrink-0 px-5 py-2 bg-[var(--dg-color-background-secondary)] border-[var(--dg-border-widths-standard)] border-[var(--dg-color-border-divider)] rounded-[var(--dg-radii-pill)]">
      <span class="text-[var(--dg-color-text-medium-emphasis)] font-bold text-xs uppercase tracking-wider">Transport</span>
    </div>
  </div>

  <!-- Main Content: Challenge Cards -->
  <main class="mt-[32px] px-[var(--dg-mobile-layout-screen-margin)] flex flex-col gap-[var(--dg-mobile-layout-element-gap)] pb-[calc(var(--dg-sizing-bottom-nav-height)+40px)]">
    
    <!-- Card 1 -->
    <div class="dg-surface-card rounded-[24px] border-[1.5px] border-[var(--dg-color-border-divider)] overflow-hidden relative group active:scale-[0.98] transition-transform duration-200">
      <div class="absolute top-0 right-0 w-32 h-32 bg-[var(--dg-color-action-secondary)] opacity-10 blur-[40px] rounded-full -mr-10 -mt-10"></div>
      <div class="p-[var(--dg-spacing-md)] flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <span class="px-3 py-1 bg-[var(--dg-color-action-secondary)] text-black text-[10px] font-bold rounded-full uppercase tracking-widest">Energy</span>
          <div class="flex items-center gap-1 text-[var(--dg-color-action-primary)]">
            <i data-lucide="zap" class="w-4 h-4 fill-current"></i>
            <span class="text-sm font-bold">+450 XP</span>
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold leading-tight">The 24-Hour Zero Watt Challenge</h3>
          <p class="text-[var(--dg-color-text-medium-emphasis)] text-sm mt-1">Unplug all non-essential electronics for a full day.</p>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex -space-x-2">
            <div class="w-6 h-6 rounded-full border-2 border-[var(--dg-color-surface-card)] bg-gray-700 flex items-center justify-center text-[8px] font-bold">JD</div>
            <div class="w-6 h-6 rounded-full border-2 border-[var(--dg-color-surface-card)] bg-gray-600 flex items-center justify-center text-[8px] font-bold">AS</div>
            <div class="w-6 h-6 rounded-full border-2 border-[var(--dg-color-surface-card)] bg-[var(--dg-color-background-secondary)] flex items-center justify-center text-[8px] font-bold">+12</div>
          </div>
          <button class="h-10 px-6 bg-[var(--dg-color-action-primary)] text-black font-bold rounded-[var(--dg-radii-pill)] text-sm flex items-center justify-center">
            Join Mission
          </button>
        </div>
      </div>
    </div>

    <!-- Card 2 -->
    <div class="dg-surface-card rounded-[24px] border-[1.5px] border-[var(--dg-color-border-divider)] overflow-hidden relative group active:scale-[0.98] transition-transform duration-200">
      <div class="absolute top-0 right-0 w-32 h-32 bg-[var(--dg-color-action-primary)] opacity-5 blur-[40px] rounded-full -mr-10 -mt-10"></div>
      <div class="p-[var(--dg-spacing-md)] flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <span class="px-3 py-1 bg-[var(--dg-color-action-secondary)] text-black text-[10px] font-bold rounded-full uppercase tracking-widest">Waste</span>
          <div class="flex items-center gap-1 text-[var(--dg-color-action-primary)]">
            <i data-lucide="leaf" class="w-4 h-4 fill-current"></i>
            <span class="text-sm font-bold">+300 XP</span>
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold leading-tight">Plastic-Free Grocery Run</h3>
          <p class="text-[var(--dg-color-text-medium-emphasis)] text-sm mt-1">Complete a full grocery shop without buying single-use plastic.</p>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <i data-lucide="clock" class="w-4 h-4 text-[var(--dg-color-text-low-emphasis)]"></i>
            <span class="text-xs text-[var(--dg-color-text-low-emphasis)]">Ends in 2 days</span>
          </div>
          <button class="h-10 px-6 bg-[var(--dg-color-action-primary)] text-black font-bold rounded-[var(--dg-radii-pill)] text-sm flex items-center justify-center">
            Join Mission
          </button>
        </div>
      </div>
    </div>

    <!-- Card 3 -->
    <div class="dg-surface-card rounded-[24px] border-[1.5px] border-[var(--dg-color-border-divider)] overflow-hidden relative group active:scale-[0.98] transition-transform duration-200">
      <div class="p-[var(--dg-spacing-md)] flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <span class="px-3 py-1 bg-[var(--dg-color-action-secondary)] text-black text-[10px] font-bold rounded-full uppercase tracking-widest">Transport</span>
          <div class="flex items-center gap-1 text-[var(--dg-color-action-primary)]">
            <i data-lucide="bike" class="w-4 h-4"></i>
            <span class="text-sm font-bold">+600 XP</span>
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold leading-tight">The Commuter Cycle</h3>
          <p class="text-[var(--dg-color-text-medium-emphasis)] text-sm mt-1">Bike to work or school for 5 consecutive days.</p>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span class="text-xs text-[var(--dg-color-text-low-emphasis)]">842 People Active</span>
          </div>
          <button class="h-10 px-6 bg-[var(--dg-color-action-primary)] text-black font-bold rounded-[var(--dg-radii-pill)] text-sm flex items-center justify-center">
            Join Mission
          </button>
        </div>
      </div>
    </div>

    <!-- Card 4 (Locked/Upcoming) -->
    <div class="dg-surface-card rounded-[24px] border-[1.5px] border-[var(--dg-color-border-divider)] overflow-hidden relative opacity-60 grayscale">
      <div class="p-[var(--dg-spacing-md)] flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <span class="px-3 py-1 bg-[var(--dg-color-background-secondary)] text-[var(--dg-color-text-low-emphasis)] text-[10px] font-bold rounded-full uppercase tracking-widest">Water</span>
          <div class="flex items-center gap-1 text-[var(--dg-color-text-low-emphasis)]">
            <i data-lucide="lock" class="w-4 h-4"></i>
            <span class="text-sm font-bold">Locked</span>
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold leading-tight">The 4-Minute Shower Streak</h3>
          <p class="text-[var(--dg-color-text-medium-emphasis)] text-sm mt-1">Unlock by reaching Level 5 in the Energy category.</p>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="h-2 flex-1 bg-[var(--dg-color-background-secondary)] rounded-full mr-4 overflow-hidden">
            <div class="h-full bg-[var(--dg-color-action-secondary)] w-[65%]"></div>
          </div>
          <span class="text-xs font-bold text-[var(--dg-color-action-secondary)]">65%</span>
        </div>
      </div>
    </div>

  </main>
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
      height: var(--dg-sizing-bottom-nav-height, 80px);
      background: rgba(18, 18, 18, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: var(--dg-border-widths-standard, 1.5px) solid var(--dg-color-border-divider, #262626);
      border-radius: var(--dg-radii-app, 24px);
      box-shadow: var(--dg-shadows-overlay);
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 0 8px;
      z-index: 1000;
      box-sizing: border-box;
    }

    [data-drawgle-primary-nav] .dg-nav-item {
      position: relative;
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      gap: 6px;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    [data-drawgle-primary-nav] .dg-nav-item:active {
      transform: scale(0.92);
    }

    [data-drawgle-primary-nav] .dg-nav-icon-wrapper {
      position: relative;
      width: 44px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--dg-radii-pill, 9999px);
      transition: background-color 0.2s ease, color 0.2s ease;
      color: var(--dg-color-text-low-emphasis, #666666);
    }

    [data-drawgle-primary-nav] .dg-nav-icon-wrapper i {
      width: var(--dg-sizing-icon-standard, 24px);
      height: var(--dg-sizing-icon-standard, 24px);
      stroke-width: 2px;
    }

    [data-drawgle-primary-nav] .dg-nav-label {
      font-family: inherit;
      font-size: var(--dg-type-caption-size, 12px);
      font-weight: var(--dg-type-caption-weight, 400);
      line-height: var(--dg-type-caption-line-height, 16px);
      color: var(--dg-color-text-low-emphasis, #666666);
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    /* Active State: Neon Earth Style */
    [data-drawgle-primary-nav] .dg-nav-item[] .dg-nav-icon-wrapper {
      color: var(--dg-color-action-primary, #D4FF5E);
    }

    [data-drawgle-primary-nav] .dg-nav-item[] .dg-nav-label {
      color: var(--dg-color-action-primary, #D4FF5E);
      font-weight: 700;
    }

    /* Active Indicator Glow */
    [data-drawgle-primary-nav] .dg-nav-item[]::after {
      content: '';
      position: absolute;
      top: 12px;
      width: 4px;
      height: 4px;
      background: var(--dg-color-action-primary, #D4FF5E);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--dg-color-action-primary, #D4FF5E);
    }
  </style>

  <button type="button" class="dg-nav-item" data-nav-item-id="home" aria-label="Today">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="leaf"></i>
    </span>
    <span class="dg-nav-label">Today</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="challenges" aria-label="Challenges">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="target"></i>
    </span>
    <span class="dg-nav-label">Challenges</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="leaderboard" aria-label="Community">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="trophy"></i>
    </span>
    <span class="dg-nav-label">Community</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="profile" aria-label="Impact">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="user"></i>
    </span>
    <span class="dg-nav-label">Impact</span>
  </button>
</nav></div>
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      document.querySelectorAll('[data-nav-item-id]').forEach(function(item) {
        var active = item.getAttribute('data-nav-item-id') === "challenges";
        item.setAttribute('data-active', active ? 'true' : 'false');
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });
    </script>
  </body>
</html>

3. 


<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="drawgle-google-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&amp;display=swap">
    <style>
:root {
  --dg-color-text-low-emphasis: #666666;
  --dg-color-text-high-emphasis: #FFFFFF;
  --dg-color-text-medium-emphasis: #A1A1A1;
  --dg-color-action-primary: #D4FF5E;
  --dg-color-action-disabled: #2A2A2A;
  --dg-color-action-secondary: #C8B6FF;
  --dg-color-action-on-primary-text: #000000;
  --dg-color-border-divider: #262626;
  --dg-color-border-focused: #D4FF5E;
  --dg-color-surface-card: #161616;
  --dg-color-surface-modal: #1E1E1E;
  --dg-color-surface-bottom-sheet: #121212;
  --dg-color-background-primary: #0F0F0F;
  --dg-color-background-secondary: #1A1A1A;
  --dg-radii-app: 24px;
  --dg-radii-pill: 9999px;
  --dg-sizing-icon-small: 20px;
  --dg-sizing-icon-standard: 24px;
  --dg-sizing-min-touch-target: 48px;
  --dg-sizing-bottom-nav-height: 80px;
  --dg-sizing-standard-input-height: 52px;
  --dg-sizing-standard-button-height: 56px;
  --dg-shadows-none: none;
  --dg-shadows-overlay: 0px 12px 40px rgba(0, 0, 0, 0.8);
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
  --dg-typography-font-family: 'Space Grotesk', 'JetBrains Mono', sans-serif;
  --dg-type-nav-title-size: 18px;
  --dg-type-nav-title-weight: 700;
  --dg-type-nav-title-line-height: 24px;
  --dg-type-screen-title-size: 28px;
  --dg-type-screen-title-weight: 800;
  --dg-type-screen-title-line-height: 32px;
  --dg-type-hero-title-size: 34px;
  --dg-type-hero-title-weight: 800;
  --dg-type-hero-title-line-height: 40px;
  --dg-type-section-title-size: 14px;
  --dg-type-section-title-weight: 600;
  --dg-type-section-title-line-height: 20px;
  --dg-type-metric-value-size: 24px;
  --dg-type-metric-value-weight: 700;
  --dg-type-metric-value-line-height: 28px;
  --dg-type-body-size: 16px;
  --dg-type-body-weight: 400;
  --dg-type-body-line-height: 24px;
  --dg-type-supporting-size: 14px;
  --dg-type-supporting-weight: 500;
  --dg-type-supporting-line-height: 20px;
  --dg-type-caption-size: 12px;
  --dg-type-caption-weight: 400;
  --dg-type-caption-line-height: 16px;
  --dg-type-button-label-size: 16px;
  --dg-type-button-label-weight: 700;
  --dg-type-button-label-line-height: 20px;
  --dg-border-widths-standard: 1.5px;
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
<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" style="font-family: 'Space Grotesk', 'JetBrains Mono', sans-serif">
  <!-- Header -->
  <header class="pt-[var(--dg-mobile-layout-safe-area-top)] px-[var(--dg-mobile-layout-screen-margin)] flex justify-between items-end pb-4">
    <div class="flex flex-col">
      <span class="dg-type-section-title text-[var(--dg-color-action-secondary)] uppercase tracking-wider">Community</span>
      <h1 class="dg-type-screen-title">Leaderboard</h1>
    </div>
    <div class="flex gap-2">
      <button class="w-10 h-10 rounded-full dg-bg-secondary flex items-center justify-center border border-[var(--dg-color-border-divider)]">
        <i data-lucide="search" class="w-5 h-5 text-[var(--dg-color-text-medium-emphasis)]"></i>
      </button>
      <button class="w-10 h-10 rounded-full dg-bg-secondary flex items-center justify-center border border-[var(--dg-color-border-divider)]">
        <i data-lucide="filter" class="w-5 h-5 text-[var(--dg-color-text-medium-emphasis)]"></i>
      </button>
    </div>
  </header>

  <!-- Podium Section -->
  <section class="px-[var(--dg-mobile-layout-screen-margin)] pt-8 pb-4">
    <div class="flex items-end justify-center gap-4 h-[240px]">
      
      <!-- Rank 2 -->
      <div class="flex flex-col items-center flex-1">
        <div class="relative mb-3">
          <div class="w-16 h-16 rounded-full border-2 border-[var(--dg-color-action-secondary)] p-1">
            <div class="w-full h-full rounded-full bg-[var(--dg-color-action-disabled)] flex items-center justify-center overflow-hidden">
              <span class="dg-type-body font-bold">JD</span>
            </div>
          </div>
          <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--dg-color-action-secondary)] flex items-center justify-center text-black text-[10px] font-bold">2</div>
        </div>
        <div class="w-full dg-surface-card rounded-t-xl pt-4 pb-2 flex flex-col items-center h-[100px] border-x border-t border-[var(--dg-color-border-divider)]">
          <span class="dg-type-caption truncate w-full text-center px-1">Jane Doe</span>
          <span class="dg-type-section-title text-[var(--dg-color-action-secondary)]">2,840</span>
        </div>
      </div>

      <!-- Rank 1 -->
      <div class="flex flex-col items-center flex-1">
        <div class="relative mb-4 scale-110">
          <div class="w-20 h-20 rounded-full border-4 border-[var(--dg-color-action-primary)] p-1 shadow-[0_0_20px_rgba(212,255,94,0.3)]">
            <div class="w-full h-full rounded-full bg-[var(--dg-color-action-disabled)] flex items-center justify-center overflow-hidden">
              <img src="https://images.pexels.com/photos/27663571/pexels-photo-27663571.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" alt="Leader" class="w-full h-full object-cover">
            </div>
          </div>
          <div class="absolute -top-4 left-1/2 -translate-x-1/2">
            <i data-lucide="crown" class="w-6 h-6 text-[var(--dg-color-action-primary)] fill-[var(--dg-color-action-primary)]"></i>
          </div>
          <div class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--dg-color-action-primary)] flex items-center justify-center text-black text-xs font-black">1</div>
        </div>
        <div class="w-full bg-gradient-to-b from-[#222] to-[var(--dg-color-surface-card)] rounded-t-2xl pt-6 pb-2 flex flex-col items-center h-[140px] border-x border-t border-[var(--dg-color-action-primary)]/30">
          <span class="dg-type-body font-bold truncate w-full text-center px-1">Alex Rivers</span>
          <span class="dg-type-metric-value text-[var(--dg-color-action-primary)]">3,120</span>
        </div>
      </div>

      <!-- Rank 3 -->
      <div class="flex flex-col items-center flex-1">
        <div class="relative mb-3">
          <div class="w-16 h-16 rounded-full border-2 border-[var(--dg-color-text-medium-emphasis)] p-1">
            <div class="w-full h-full rounded-full bg-[var(--dg-color-action-disabled)] flex items-center justify-center overflow-hidden">
              <span class="dg-type-body font-bold">MK</span>
            </div>
          </div>
          <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--dg-color-text-medium-emphasis)] flex items-center justify-center text-black text-[10px] font-bold">3</div>
        </div>
        <div class="w-full dg-surface-card rounded-t-xl pt-4 pb-2 flex flex-col items-center h-[80px] border-x border-t border-[var(--dg-color-border-divider)]">
          <span class="dg-type-caption truncate w-full text-center px-1">Mike K.</span>
          <span class="dg-type-section-title text-white">2,415</span>
        </div>
      </div>

    </div>
  </section>

  <!-- List Section -->
  <main class="flex-1 px-[var(--dg-mobile-layout-screen-margin)] pb-[180px]">
    <div class="dg-surface-card rounded-[var(--dg-radii-app)] overflow-hidden border border-[var(--dg-color-border-divider)]">
      
      <!-- List Item 4 -->
      <div class="flex items-center p-[var(--dg-spacing-md)] border-b border-[var(--dg-color-border-divider)]">
        <span class="w-8 dg-type-metric-value text-[var(--dg-color-text-low-emphasis)] text-lg">4</span>
        <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-disabled)] mr-3 flex items-center justify-center">
          <span class="text-xs">SR</span>
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <span class="dg-type-body font-medium truncate">Sarah Jenkins</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">12 challenges completed</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="dg-type-body font-bold">2,100</span>
          <span class="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <i data-lucide="trending-up" class="w-2 h-2"></i> +120
          </span>
        </div>
      </div>

      <!-- List Item 5 -->
      <div class="flex items-center p-[var(--dg-spacing-md)] border-b border-[var(--dg-color-border-divider)]">
        <span class="w-8 dg-type-metric-value text-[var(--dg-color-text-low-emphasis)] text-lg">5</span>
        <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-disabled)] mr-3 flex items-center justify-center">
          <span class="text-xs">TH</span>
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <span class="dg-type-body font-medium truncate">Tom Holland</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">9 challenges completed</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="dg-type-body font-bold">1,950</span>
          <span class="text-[10px] text-red-400 flex items-center gap-0.5">
            <i data-lucide="trending-down" class="w-2 h-2"></i> -45
          </span>
        </div>
      </div>

      <!-- List Item 6 -->
      <div class="flex items-center p-[var(--dg-spacing-md)] border-b border-[var(--dg-color-border-divider)]">
        <span class="w-8 dg-type-metric-value text-[var(--dg-color-text-low-emphasis)] text-lg">6</span>
        <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-disabled)] mr-3 flex items-center justify-center">
          <span class="text-xs">LB</span>
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <span class="dg-type-body font-medium truncate">Lisa Black</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">15 challenges completed</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="dg-type-body font-bold">1,820</span>
          <span class="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <i data-lucide="trending-up" class="w-2 h-2"></i> +310
          </span>
        </div>
      </div>

      <!-- List Item 7 -->
      <div class="flex items-center p-[var(--dg-spacing-md)] border-b border-[var(--dg-color-border-divider)]">
        <span class="w-8 dg-type-metric-value text-[var(--dg-color-text-low-emphasis)] text-lg">7</span>
        <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-disabled)] mr-3 flex items-center justify-center">
          <span class="text-xs">CM</span>
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <span class="dg-type-body font-medium truncate">Chris Miller</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">8 challenges completed</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="dg-type-body font-bold">1,740</span>
          <span class="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <i data-lucide="trending-up" class="w-2 h-2"></i> +15
          </span>
        </div>
      </div>

      <!-- List Item 8 -->
      <div class="flex items-center p-[var(--dg-spacing-md)]">
        <span class="w-8 dg-type-metric-value text-[var(--dg-color-text-low-emphasis)] text-lg">8</span>
        <div class="w-10 h-10 rounded-full bg-[var(--dg-color-action-disabled)] mr-3 flex items-center justify-center">
          <span class="text-xs">AW</span>
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <span class="dg-type-body font-medium truncate">Anna White</span>
          <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">11 challenges completed</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="dg-type-body font-bold">1,690</span>
          <span class="text-[10px] text-red-400 flex items-center gap-0.5">
            <i data-lucide="trending-down" class="w-2 h-2"></i> -80
          </span>
        </div>
      </div>

    </div>
  </main>

  <!-- Sticky User Bar -->
  <div class="fixed bottom-[calc(var(--dg-sizing-bottom-nav-height)+16px)] left-0 right-0 px-[var(--dg-mobile-layout-screen-margin)] z-40">
    <div class="dg-surface-modal rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)] flex items-center shadow-[var(--dg-shadows-overlay)] border border-[var(--dg-color-action-primary)]/20">
      <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--dg-color-action-primary)] text-black font-bold mr-3">
        42
      </div>
      <div class="flex flex-col flex-1 min-w-0">
        <span class="dg-type-body font-bold">You (Eco Warrior)</span>
        <span class="dg-type-caption text-[var(--dg-color-action-primary)]">Top 15% this week</span>
      </div>
      <div class="flex flex-col items-end">
        <span class="dg-type-metric-value text-xl">845</span>
        <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)]">Points</span>
      </div>
      <div class="ml-4 pl-4 border-l border-[var(--dg-color-border-divider)]">
        <i data-lucide="chevron-up" class="w-5 h-5 text-[var(--dg-color-action-primary)]"></i>
      </div>
    </div>
  </div>

  <!-- Bottom Nav Clearance -->
  <div class="h-[calc(var(--dg-sizing-bottom-nav-height)+16px)]"></div>
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
      height: var(--dg-sizing-bottom-nav-height, 80px);
      background: rgba(18, 18, 18, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: var(--dg-border-widths-standard, 1.5px) solid var(--dg-color-border-divider, #262626);
      border-radius: var(--dg-radii-app, 24px);
      box-shadow: var(--dg-shadows-overlay);
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 0 8px;
      z-index: 1000;
      box-sizing: border-box;
    }

    [data-drawgle-primary-nav] .dg-nav-item {
      position: relative;
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      gap: 6px;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    [data-drawgle-primary-nav] .dg-nav-item:active {
      transform: scale(0.92);
    }

    [data-drawgle-primary-nav] .dg-nav-icon-wrapper {
      position: relative;
      width: 44px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--dg-radii-pill, 9999px);
      transition: background-color 0.2s ease, color 0.2s ease;
      color: var(--dg-color-text-low-emphasis, #666666);
    }

    [data-drawgle-primary-nav] .dg-nav-icon-wrapper i {
      width: var(--dg-sizing-icon-standard, 24px);
      height: var(--dg-sizing-icon-standard, 24px);
      stroke-width: 2px;
    }

    [data-drawgle-primary-nav] .dg-nav-label {
      font-family: inherit;
      font-size: var(--dg-type-caption-size, 12px);
      font-weight: var(--dg-type-caption-weight, 400);
      line-height: var(--dg-type-caption-line-height, 16px);
      color: var(--dg-color-text-low-emphasis, #666666);
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    /* Active State: Neon Earth Style */
    [data-drawgle-primary-nav] .dg-nav-item[] .dg-nav-icon-wrapper {
      color: var(--dg-color-action-primary, #D4FF5E);
    }

    [data-drawgle-primary-nav] .dg-nav-item[] .dg-nav-label {
      color: var(--dg-color-action-primary, #D4FF5E);
      font-weight: 700;
    }

    /* Active Indicator Glow */
    [data-drawgle-primary-nav] .dg-nav-item[]::after {
      content: '';
      position: absolute;
      top: 12px;
      width: 4px;
      height: 4px;
      background: var(--dg-color-action-primary, #D4FF5E);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--dg-color-action-primary, #D4FF5E);
    }
  </style>

  <button type="button" class="dg-nav-item" data-nav-item-id="home" aria-label="Today">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="leaf"></i>
    </span>
    <span class="dg-nav-label">Today</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="challenges" aria-label="Challenges">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="target"></i>
    </span>
    <span class="dg-nav-label">Challenges</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="leaderboard" aria-label="Community">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="trophy"></i>
    </span>
    <span class="dg-nav-label">Community</span>
  </button>

  <button type="button" class="dg-nav-item" data-nav-item-id="profile" aria-label="Impact">
    <span class="dg-nav-icon-wrapper">
      <i data-lucide="user"></i>
    </span>
    <span class="dg-nav-label">Impact</span>
  </button>
</nav></div>
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      document.querySelectorAll('[data-nav-item-id]').forEach(function(item) {
        var active = item.getAttribute('data-nav-item-id') === "challenges";
        item.setAttribute('data-active', active ? 'true' : 'false');
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });
    </script>
  </body>
</html>
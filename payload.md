
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
:root {
  --dg-color-text-low-emphasis: #C2C2C2;
  --dg-color-text-high-emphasis: #D6D6D6;
  --dg-color-text-medium-emphasis: #CFCFCF;
  --dg-color-action-primary: #FF1A1A;
  --dg-color-action-disabled: #534A4A;
  --dg-color-action-secondary: #000000;
  --dg-color-action-on-primary-text: #FFFFFF;
  --dg-color-border-divider: #747474;
  --dg-color-border-focused: #FF1A1A;
  --dg-color-surface-card: #1E1E1E;
  --dg-color-surface-modal: #FFFFFF;
  --dg-color-surface-bottom-sheet: #FDFDFD;
  --dg-color-background-primary: #0A0A0A;
  --dg-color-background-secondary: #2A2A2A;
  --dg-radii-app: 20px;
  --dg-radii-pill: 9999px;
  --dg-sizing-icon-small: 18px;
  --dg-sizing-icon-standard: 24px;
  --dg-sizing-min-touch-target: 48px;
  --dg-sizing-bottom-nav-height: 84px;
  --dg-sizing-standard-input-height: 52px;
  --dg-sizing-standard-button-height: 56px;
  --dg-shadows-none: no;
  --dg-shadows-overlay: 0px 10px 40px rgba(0, 0, 0, 0.12);
  --dg-shadows-surface: 0px 4px 20px rgba(0, 0, 0, 0.04);
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
  --dg-opacities-pressed: 0.12;
  --dg-opacities-disabled: 0.38;
  --dg-opacities-transparent: 0;
  --dg-opacities-scrim-overlay: 0.50;
  --dg-typography-font-family: 'Plus Jakarta Sans', sans-serif;
  --dg-type-nav-title-size: 17px;
  --dg-type-nav-title-weight: 600;
  --dg-type-nav-title-line-height: 22px;
  --dg-type-screen-title-size: 24px;
  --dg-type-screen-title-weight: 700;
  --dg-type-screen-title-line-height: 32px;
  --dg-type-hero-title-size: 28px;
  --dg-type-hero-title-weight: 800;
  --dg-type-hero-title-line-height: 34px;
  --dg-type-section-title-size: 18px;
  --dg-type-section-title-weight: 600;
  --dg-type-section-title-line-height: 24px;
  --dg-type-metric-value-size: 20px;
  --dg-type-metric-value-weight: 700;
  --dg-type-metric-value-line-height: 26px;
  --dg-type-body-size: 15px;
  --dg-type-body-weight: 400;
  --dg-type-body-line-height: 20px;
  --dg-type-supporting-size: 13px;
  --dg-type-supporting-weight: 500;
  --dg-type-supporting-line-height: 18px;
  --dg-type-caption-size: 11px;
  --dg-type-caption-weight: 500;
  --dg-type-caption-line-height: 14px;
  --dg-type-button-label-size: 16px;
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
      body { font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); background: var(--dg-color-background-primary, #ffffff); }
      #drawgle-export-root { position: relative; min-height: 100vh; overflow-x: hidden; }
      #drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }
      #drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden" style="font-family: 'Plus Jakarta Sans', sans-serif">
  <!-- Header Section -->
  <header class="px-[var(--dg-mobile-layout-screen-margin)] pt-[var(--dg-mobile-layout-safe-area-top)] flex justify-between items-center mb-[var(--dg-mobile-layout-element-gap)]">
    <div class="flex flex-col">
      <h1 class="dg-type-screen-title text-[var(--dg-color-action-primary)]">Eventify</h1>
      <p class="dg-type-body text-[var(--dg-color-text-medium-emphasis)]">Plan your perfect moments</p>
    </div>
    <div class="w-[44px] h-[44px] rounded-full overflow-hidden border-2 border-white shadow-[var(--dg-shadows-surface)]">
      <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=100&auto=format&fit=crop" alt="User Avatar" class="w-full h-full object-cover">
    </div>
  </header>

  <!-- Metric Row -->
  <div class="px-[var(--dg-mobile-layout-screen-margin)] grid grid-cols-3 gap-[var(--dg-spacing-xs)] mb-[var(--dg-mobile-layout-section-gap)]">
    <!-- Events Metric -->
    <button class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)] flex flex-col items-start text-left shadow-[var(--dg-shadows-surface)] min-h-[120px]">
      <div class="w-[32px] h-[32px] rounded-[8px] bg-blue-50 flex items-center justify-center mb-[var(--dg-spacing-xs)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </div>
      <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)] mb-[2px]">Events</span>
      <span class="dg-type-metric-value">3</span>
      <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)] mt-auto">Total planned</span>
    </button>

    <!-- Guests Metric -->
    <button class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)] flex flex-col items-start text-left shadow-[var(--dg-shadows-surface)] min-h-[120px]">
      <div class="w-[32px] h-[32px] rounded-[8px] bg-orange-50 flex items-center justify-center mb-[var(--dg-spacing-xs)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      </div>
      <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)] mb-[2px]">Guests</span>
      <span class="dg-type-metric-value">11</span>
      <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)] mt-auto">Total invited</span>
    </button>

    <!-- Budgets Metric -->
    <button class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)] flex flex-col items-start text-left shadow-[var(--dg-shadows-surface)] min-h-[120px]">
      <div class="w-[32px] h-[32px] rounded-[8px] bg-pink-50 flex items-center justify-center mb-[var(--dg-spacing-xs)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      </div>
      <span class="dg-type-caption text-[var(--dg-color-text-medium-emphasis)] mb-[2px]">Budgets</span>
      <span class="dg-type-metric-value">$4000</span>
      <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)] mt-auto">$1500 left</span>
    </button>
  </div>

  <!-- Notification Banner -->
  <div class="px-[var(--dg-mobile-layout-screen-margin)] mb-[var(--dg-mobile-layout-section-gap)]">
    <div class="w-full bg-pink-50/50 border border-pink-100 rounded-[16px] p-[var(--dg-spacing-md)] flex items-center justify-between">
      <div class="flex items-center gap-[var(--dg-spacing-xs)]">
        <span class="text-[16px]">🎂</span>
        <p class="dg-type-supporting text-[var(--dg-color-text-high-emphasis)]">Sameer is celebrating his birthday...</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--dg-color-text-medium-emphasis)]"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
    </div>
  </div>

  <!-- Upcoming Events Section -->
  <section class="px-[var(--dg-mobile-layout-screen-margin)] mb-[var(--dg-mobile-layout-section-gap)]">
    <div class="flex justify-between items-center mb-[var(--dg-mobile-layout-element-gap)]">
      <h2 class="dg-type-section-title">Upcoming Events</h2>
      <button class="text-[var(--dg-color-action-primary)] dg-type-button-label flex items-center gap-1">
        <span class="text-[20px] leading-none">+</span> New
      </button>
    </div>

    <div class="flex flex-col gap-[var(--dg-mobile-layout-element-gap)]">
      <!-- Event Card 1 -->
      <div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)] flex items-center gap-[var(--dg-spacing-md)] shadow-[var(--dg-shadows-surface)]">
        <div class="w-[48px] h-[48px] rounded-[16px] bg-gray-50 flex items-center justify-center text-[24px]">🎂</div>
        <div class="flex-1">
          <h3 class="dg-type-body font-semibold">Hamed birthday bash</h3>
          <div class="flex items-center gap-1 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[var(--dg-color-text-low-emphasis)]"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">Downtown lounge, Lagos</span>
          </div>
        </div>
        <div class="relative w-[40px] h-[40px] flex items-center justify-center">
          <svg class="w-full h-full transform -rotate-90">
            <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="3" fill="transparent" class="text-gray-100" />
            <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="3" fill="transparent" stroke-dasharray="113" stroke-dashoffset="56.5" class="text-[var(--dg-color-action-primary)]" />
          </svg>
          <span class="absolute text-[9px] font-bold">50%</span>
        </div>
      </div>

      <!-- Event Card 2 -->
      <div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)] flex items-center gap-[var(--dg-spacing-md)] shadow-[var(--dg-shadows-surface)]">
        <div class="w-[48px] h-[48px] rounded-[16px] bg-gray-50 flex items-center justify-center text-[24px]">🏊‍♂️</div>
        <div class="flex-1">
          <h3 class="dg-type-body font-semibold">Swimming pool party</h3>
          <div class="flex items-center gap-1 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[var(--dg-color-text-low-emphasis)]"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">Downtown lounge, Lagos</span>
          </div>
        </div>
        <div class="relative w-[40px] h-[40px] flex items-center justify-center">
          <svg class="w-full h-full transform -rotate-90">
            <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="3" fill="transparent" class="text-gray-100" />
            <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="3" fill="transparent" stroke-dasharray="113" stroke-dashoffset="84.75" class="text-blue-500" />
          </svg>
          <span class="absolute text-[9px] font-bold">25%</span>
        </div>
      </div>

      <!-- Event Card 3 -->
      <div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)] flex items-center gap-[var(--dg-spacing-md)] shadow-[var(--dg-shadows-surface)]">
        <div class="w-[48px] h-[48px] rounded-[16px] bg-gray-50 flex items-center justify-center text-[24px]">🎉</div>
        <div class="flex-1">
          <h3 class="dg-type-body font-semibold">400 lvl final celebration</h3>
          <div class="flex items-center gap-1 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[var(--dg-color-text-low-emphasis)]"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span class="dg-type-caption text-[var(--dg-color-text-low-emphasis)]">Osun state university</span>
          </div>
        </div>
        <div class="relative w-[40px] h-[40px] flex items-center justify-center">
          <svg class="w-full h-full transform -rotate-90">
            <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="3" fill="transparent" class="text-gray-100" />
            <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="3" fill="transparent" stroke-dasharray="113" stroke-dashoffset="84.75" class="text-orange-500" />
          </svg>
          <span class="absolute text-[9px] font-bold">25%</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Recent Activities Section -->
  <section class="px-[var(--dg-mobile-layout-screen-margin)] pb-[100px]">
    <div class="flex justify-between items-center mb-[var(--dg-mobile-layout-element-gap)]">
      <h2 class="dg-type-section-title">Recent Activities</h2>
      <button class="text-[var(--dg-color-text-low-emphasis)] dg-type-supporting">See all</button>
    </div>
    
    <!-- Empty State -->
    <div class="flex flex-col items-center justify-center py-[40px] opacity-60">
      <div class="w-[48px] h-[48px] bg-gray-200 rounded-[12px] flex items-center justify-center mb-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
      </div>
      <p class="dg-type-body text-[var(--dg-color-text-low-emphasis)]">No activity for now</p>
    </div>
  </section>
</div>
      <div id="drawgle-export-navigation"><nav data-drawgle-primary-nav class="dg-bg-secondary border-t dg-border-divider flex items-center justify-between w-full h-[var(--dg-sizing-bottom-nav-height)] pb-[var(--dg-mobile-layout-safe-area-bottom)] px-[var(--dg-mobile-layout-screen-margin)] fixed bottom-0 left-0 z-[100]">
  <style>
    [data-drawgle-primary-nav] button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex: 1;
      height: 100%;
      background: transparent;
      border: none;
      padding: 0;
      position: relative;
      -webkit-tap-highlight-color: transparent;
    }

    [data-drawgle-primary-nav] .nav-icon-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    [data-drawgle-primary-nav] button:active .nav-icon-wrapper {
      transform: scale(0.85);
    }

    /* Active State: High energy Red indicator dot as per creative direction */
    [data-drawgle-primary-nav] button[data-active="true"]::after {
      content: '';
      position: absolute;
      top: 8px;
      right: 25%;
      width: 6px;
      height: 6px;
      background-color: var(--dg-color-action-primary);
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(255, 26, 26, 0.4);
    }

    [data-drawgle-primary-nav] .nav-icon {
      stroke-width: 1.5px;
      transition: color 0.2s ease, stroke-width 0.2s ease;
    }

    [data-drawgle-primary-nav] button[data-active="true"] .nav-icon {
      color: var(--dg-color-text-high-emphasis);
      stroke-width: 2px;
    }

    [data-drawgle-primary-nav] button[data-active="false"] .nav-icon {
      color: var(--dg-color-text-low-emphasis);
    }

    [data-drawgle-primary-nav] .nav-label {
      font-family: inherit;
      font-size: var(--dg-type-caption-size);
      font-weight: var(--dg-type-caption-weight);
      line-height: var(--dg-type-caption-line-height);
      letter-spacing: 0.01em;
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    [data-drawgle-primary-nav] button[data-active="true"] .nav-label {
      color: var(--dg-color-text-high-emphasis);
      font-weight: 700;
    }

    [data-drawgle-primary-nav] button[data-active="false"] .nav-label {
      color: var(--dg-color-text-low-emphasis);
    }
  </style>

  <button data-nav-item-id="home" data-active="true">
    <div class="nav-icon-wrapper">
      <i data-lucide="home" class="nav-icon w-[var(--dg-sizing-icon-standard)] h-[var(--dg-sizing-icon-standard)]"></i>
    </div>
    <span class="nav-label">Home</span>
  </button>

  <button data-nav-item-id="events" data-active="false">
    <div class="nav-icon-wrapper">
      <i data-lucide="layout-list" class="nav-icon w-[var(--dg-sizing-icon-standard)] h-[var(--dg-sizing-icon-standard)]"></i>
    </div>
    <span class="nav-label">Events</span>
  </button>

  <button data-nav-item-id="calendar" data-active="false">
    <div class="nav-icon-wrapper">
      <i data-lucide="calendar" class="nav-icon w-[var(--dg-sizing-icon-standard)] h-[var(--dg-sizing-icon-standard)]"></i>
    </div>
    <span class="nav-label">Calendar</span>
  </button>

  <button data-nav-item-id="profile" data-active="false">
    <div class="nav-icon-wrapper">
      <i data-lucide="user" class="nav-icon w-[var(--dg-sizing-icon-standard)] h-[var(--dg-sizing-icon-standard)]"></i>
    </div>
    <span class="nav-label">Profile</span>
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
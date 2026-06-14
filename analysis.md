## my saas genearetd code:

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
            },
            colors: {
              background: "var(--background)",
              muted: {
                DEFAULT: "var(--muted)",
                foreground: "var(--muted-foreground)"
              },
              card: {
                DEFAULT: "var(--card)",
                foreground: "var(--foreground)"
              },
              popover: {
                DEFAULT: "var(--popover)",
                foreground: "var(--foreground)"
              },
              foreground: "var(--foreground)",
              primary: {
                DEFAULT: "var(--primary)",
                foreground: "var(--primary-foreground)"
              },
              secondary: "var(--secondary)",
              border: "var(--border)",
              "low-foreground": "var(--low-foreground)",
              tint: {
                blue: "var(--tint-blue)",
                orange: "var(--tint-orange)",
                cyan: "var(--tint-cyan)",
                purple: "var(--tint-purple)",
                gray: "var(--surface-muted)"
              }
            },
            borderRadius: {
              lg: "var(--radius)",
              md: "calc(var(--radius) - 2px)",
              sm: "calc(var(--radius) - 4px)"
            },
            spacing: {
              "screen-margin": "var(--screen-margin)",
              "section-gap": "var(--section-gap)",
              "element-gap": "var(--element-gap)"
            },
            boxShadow: {
              surface: "var(--shadow-surface)",
              overlay: "var(--shadow-overlay)"
            },
            fontSize: {
              "nav-title": ["var(--nav-title-size)", { lineHeight: "var(--nav-title-line-height)" }],
              "screen-title": ["var(--screen-title-size)", { lineHeight: "var(--screen-title-line-height)" }],
              "hero-title": ["var(--hero-title-size)", { lineHeight: "var(--hero-title-line-height)" }],
              "section-title": ["var(--section-title-size)", { lineHeight: "var(--section-title-line-height)" }],
              "metric-value": ["var(--metric-value-size)", { lineHeight: "var(--metric-value-line-height)" }],
              body: ["var(--body-size)", { lineHeight: "var(--body-line-height)" }],
              supporting: ["var(--supporting-size)", { lineHeight: "var(--supporting-line-height)" }],
              caption: ["var(--caption-size)", { lineHeight: "var(--caption-line-height)" }],
              "button-label": ["var(--button-label-size)", { lineHeight: "var(--button-label-line-height)" }]
            },
            fontWeight: {
              "nav-title": "var(--nav-title-weight)",
              "screen-title": "var(--screen-title-weight)",
              "hero-title": "var(--hero-title-weight)",
              "section-title": "var(--section-title-weight)",
              "metric-value": "var(--metric-value-weight)",
              body: "var(--body-weight)",
              supporting: "var(--supporting-weight)",
              caption: "var(--caption-weight)",
              "button-label": "var(--button-label-weight)"
            }
          }
        }
      };
    </script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="drawgle-google-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@400;500;600;700;800&amp;display=swap">
    <style>
:root {
  --low-foreground: #9E9E9E;
  --foreground: #1A1A1A;
  --muted-foreground: #666666;
  --primary: #1A73E8;
  --action-disabled: #E0E0E0;
  --secondary: #FF8A00;
  --primary-foreground: #FFFFFF;
  --border: #F0F0F0;
  --ring: #1A73E8;
  --card: #FFFFFF;
  --popover: #FFFFFF;
  --card: #FFFFFF;
  --background: #F8F9FA;
  --muted: #FFFFFF;
  --tint-blue: #F0F7FF;
  --tint-cyan: #F0FBFF;
  --tint-orange: #FFF7F0;
  --tint-purple: #F9F5FF;
  --radius: 16px;
  --radius-pill: 9999px;
  --icon-small: 18px;
  --icon-standard: 24px;
  --min-touch-target: 48px;
  --bottom-nav-height: 84px;
  --standard-input-height: 56px;
  --standard-button-height: 52px;
  --shadow-none: none;
  --shadow-overlay: 0px 12px 32px rgba(0, 0, 0, 0.08);
  --shadow-surface: 0px 4px 12px rgba(0, 0, 0, 0.03);
  --spacing-none: 0px;
  --spacing-lg: 24px;
  --spacing-md: 16px;
  --spacing-sm: 12px;
  --spacing-xl: 32px;
  --spacing-xs: 8px;
  --spacing-xxl: 48px;
  --spacing-xxs: 4px;
  --z-index-base: 0;
  --z-index-bottom-nav: 20;
  --z-index-bottom-sheet: 30;
  --z-index-modal-dialog: 40;
  --z-index-sticky-header: 10;
  --z-index-toast-snackbar: 50;
  --opacity-opaque: 1;
  --opacity-pressed: 0.10;
  --opacity-disabled: 0.38;
  --opacity-transparent: 0;
  --opacity-scrim-overlay: 0.40;
  --font-body: SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif;
  --nav-title-size: 17px;
  --nav-title-weight: 600;
  --nav-title-line-height: 22px;
  --screen-title-size: 24px;
  --screen-title-weight: 700;
  --screen-title-line-height: 30px;
  --hero-title-size: 28px;
  --hero-title-weight: 800;
  --hero-title-line-height: 34px;
  --section-title-size: 18px;
  --section-title-weight: 600;
  --section-title-line-height: 24px;
  --metric-value-size: 32px;
  --metric-value-weight: 700;
  --metric-value-line-height: 38px;
  --body-size: 16px;
  --body-weight: 400;
  --body-line-height: 24px;
  --supporting-size: 14px;
  --supporting-weight: 500;
  --supporting-line-height: 20px;
  --caption-size: 12px;
  --caption-weight: 500;
  --caption-line-height: 16px;
  --button-label-size: 15px;
  --button-label-weight: 600;
  --button-label-line-height: 20px;
  --border-widths-standard: 0px;
  --element-gap: 12px;
  --section-gap: 20px;
  --safe-area-top: 16px;
  --screen-margin: 14px;
  --safe-area-bottom: 16px;
  --surface-muted: #F5F5F5;
}

html, body { margin: 0; min-height: 100%; }
body {
  font-family: var(--font-body), -apple-system, sans-serif;
  background: var(--background);
  color: var(--foreground);
}
#drawgle-export-root {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--background);
}
#drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }
#drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
<div class="w-full min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden font-sans">
  <div class="pt-[var(--safe-area-top)]"></div>

  <main class="flex-1 px-[var(--screen-margin)] flex flex-col gap-[var(--section-gap)] pb-[calc(var(--safe-area-bottom)+8px)]">

    <!-- Header -->
    <header class="flex items-center justify-between min-h-[var(--min-touch-target)] py-1">
      <button class="w-12 h-12 rounded-full flex items-center justify-center bg-card shadow-surface">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </button>
      <h1 class="text-[var(--supporting-line-height)] font-bold tracking-tight text-foreground">Good morning!</h1>
      <button class="w-12 h-12 rounded-full flex items-center justify-center bg-card shadow-surface">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        </svg>
      </button>
    </header>

    <!-- Section: Weekly Progress -->
    <section class="flex flex-col gap-3">
      <h2 class="text-[var(--supporting-line-height)] font-bold leading-tight tracking-tight text-foreground">Your Weekly <span class="text-primary">Progress</span></h2>

      <div class="rounded-[var(--hero-title-size)] p-4 flex flex-col gap-4 bg-tint-gray pt-[var(--spacing-sm)] pr-[var(--spacing-xs)] pb-[var(--spacing-xs)] pl-[var(--spacing-xs)]">
        <!-- Date header row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-foreground">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="text-[var(--supporting-size)] font-semibold text-foreground">May 9, 2026</span>
          </div>
          <div class="flex items-center gap-1">
            <button class="w-8 h-8 rounded-full flex items-center justify-center bg-card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="w-8 h-8 rounded-full flex items-center justify-center bg-card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- Date pills strip -->
        <div class="rounded-lg p-3 flex items-center justify-between bg-card shadow-surface">
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">S</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-bold bg-primary text-primary-foreground">9</div>
          </div>
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">S</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-semibold bg-[var(--border)] text-foreground">10</div>
          </div>
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">m</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-semibold bg-[var(--border)] text-foreground">10</div>
          </div>
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">t</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-semibold bg-[var(--border)] text-foreground">12</div>
          </div>
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">w</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-semibold bg-[var(--border)] text-foreground">13</div>
          </div>
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">t</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-semibold bg-[var(--border)] text-foreground">14</div>
          </div>
          <div class="flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[11px] font-semibold text-muted-foreground">f</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--spacing-sm)] font-semibold bg-[var(--border)] text-foreground">15</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Metrics Grid -->
    <section class="grid grid-cols-2 gap-3">
      <!-- Water card -->
      <div class="rounded-[var(--icon-standard)] p-3 flex flex-col gap-2.5 bg-[#EBF2FF] rounded-lg pt-[var(--spacing-xs)] pr-[var(--spacing-xs)] pb-[var(--spacing-xs)] pl-[var(--spacing-xs)]">
        <p class="text-[13px] font-semibold px-1 text-foreground">Litres of water</p>
        <div class="rounded-[var(--icon-small)] p-3 flex items-center gap-2.5 bg-card shadow-surface rounded-[var(--supporting-size)] h-[64px]">
          <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#EBF2FF]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" stroke-width="1" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
          </div>
          <div class="flex items-baseline gap-1 min-w-0">
            <span class="text-[26px] font-bold leading-none text-foreground">4.5</span>
            <span class="text-[11px] font-medium text-muted-foreground">Litres</span>
          </div>
        </div>
      </div>
      <!-- Calories card -->
      <div class="rounded-[var(--icon-standard)] p-3 flex flex-col gap-2.5 bg-[#FFF4EB] rounded-lg">
        <p class="text-[13px] font-semibold px-1 text-foreground">Calories</p>
        <div class="rounded-[var(--icon-small)] p-3 flex items-center gap-2.5 bg-card shadow-surface rounded-[var(--spacing-md)] h-[64px]">
          <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#FFF4EB]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--secondary)" stroke="var(--secondary)" stroke-width="1" stroke-linejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
            </svg>
          </div>
          <div class="flex items-baseline gap-1 min-w-0">
            <span class="text-[26px] font-bold leading-none text-foreground">2.3k</span>
            <span class="text-[11px] font-medium text-muted-foreground">Kcal</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Today's Goals -->
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-[var(--icon-small)] font-semibold text-foreground">Today's Goals</h2>
        <a class="text-[13px] font-semibold cursor-pointer text-primary">See all</a>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- Running card -->
        <div class="rounded-[var(--icon-standard)] p-3 flex flex-col gap-2.5 bg-[#EBF2FF] rounded-lg pt-[var(--spacing-xs)] pr-[var(--spacing-xs)] pb-[var(--spacing-xs)] pl-[var(--spacing-xs)]">
          <div class="rounded-[var(--icon-small)] p-3 flex flex-col gap-2 bg-card shadow-surface">
            <p class="text-[13px] font-semibold text-foreground">Running</p>
            <div class="flex items-baseline gap-1">
              <span class="text-[26px] font-bold leading-none text-foreground">30</span>
              <span class="text-[11px] font-medium text-muted-foreground">mins</span>
            </div>
            <div class="w-full h-12 overflow-hidden">
              <svg viewBox="0 0 100 40" class="w-full h-full" preserveAspectRatio="none">
                <path d="M 2 30 C 10 22, 18 32, 28 24 C 38 18, 48 28, 60 18 C 72 10, 84 16, 98 4" fill="none" stroke="var(--primary)" stroke-width="7" stroke-opacity="0.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M 2 30 C 10 22, 18 32, 28 24 C 38 18, 48 28, 60 18 C 72 10, 84 16, 98 4" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                <circle cx="2" cy="30" r="3.2" fill="var(--primary)"></circle>
                <circle cx="98" cy="4" r="3.2" fill="var(--primary)"></circle>
              </svg>
            </div>
          </div>
          <a class="flex items-center justify-between px-1 text-[13px] font-semibold cursor-pointer text-foreground">
            <span>Start Now</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
        <!-- Cycling card -->
        <div class="rounded-[var(--icon-standard)] p-3 flex flex-col gap-2.5 bg-[#FFF4EB] rounded-lg pt-[var(--spacing-xs)] pr-[var(--spacing-xs)] pb-[var(--spacing-xs)] pl-[var(--spacing-xs)]">
          <div class="rounded-[var(--icon-small)] p-3 flex flex-col gap-2 bg-card shadow-surface">
            <p class="text-[13px] font-semibold text-foreground">Cycling</p>
            <div class="flex items-baseline gap-1">
              <span class="text-[26px] font-bold leading-none text-foreground">40</span>
              <span class="text-[11px] font-medium text-muted-foreground">mins</span>
            </div>
            <div class="w-full h-12 overflow-hidden">
              <svg viewBox="0 0 100 40" class="w-full h-full" preserveAspectRatio="none">
                <path d="M 2 28 C 12 20, 22 28, 32 22 C 42 16, 54 20, 66 14 C 78 8, 88 14, 98 6" fill="none" stroke="var(--secondary)" stroke-width="7" stroke-opacity="0.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M 2 28 C 12 20, 22 28, 32 22 C 42 16, 54 20, 66 14 C 78 8, 88 14, 98 6" fill="none" stroke="var(--secondary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                <circle cx="2" cy="28" r="3.2" fill="var(--secondary)"></circle>
                <circle cx="98" cy="6" r="3.2" fill="var(--secondary)"></circle>
              </svg>
            </div>
          </div>
          <a class="flex items-center justify-between px-1 text-[13px] font-semibold cursor-pointer text-foreground">
            <span>Start Now</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </section>

    <!-- Section: Duel with friends -->
    <section class="rounded-[var(--hero-title-size)] p-4 flex flex-col gap-4 bg-tint-gray pt-[var(--spacing-xs)] pr-[var(--spacing-xs)] pb-[var(--spacing-xs)] pl-[var(--spacing-xs)]">
      <div class="flex items-center justify-between">
        <h2 class="text-[var(--icon-small)] font-semibold text-foreground">Duel with friends</h2>
        <button class="flex items-center gap-1 text-[13px] font-semibold cursor-pointer text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New</span>
        </button>
      </div>

      <div class="rounded-lg p-3 flex items-center justify-between bg-card shadow-surface">
        <div class="flex flex-col items-center gap-1.5 min-w-0">
          <div class="w-11 h-11 rounded-full overflow-hidden bg-[#EBF2FF]">
            <img src="https://images.pexels.com/photos/15019490/pexels-photo-15019490.jpeg?auto=compress&amp;cs=tinysrgb&amp;dpr=2&amp;h=650&amp;w=940" alt="Karrem avatar portrait" class="w-full h-full object-cover" referrerpolicy="no-referrer" loading="lazy">
          </div>
          <span class="text-[11px] font-medium truncate text-foreground max-w-[64px]">Karrem</span>
        </div>
        <div class="flex flex-col items-center gap-1.5 min-w-0">
          <div class="w-11 h-11 rounded-full overflow-hidden bg-[#FFF4EB]">
            <img src="https://images.pexels.com/photos/15019490/pexels-photo-15019490.jpeg?auto=compress&amp;cs=tinysrgb&amp;dpr=2&amp;h=650&amp;w=940" alt="Peter avatar portrait" class="w-full h-full object-cover" referrerpolicy="no-referrer" loading="lazy">
          </div>
          <span class="text-[11px] font-medium truncate text-foreground max-w-[64px]">Peter</span>
        </div>
        <div class="flex flex-col items-center gap-1.5 min-w-0">
          <div class="w-11 h-11 rounded-full flex items-center justify-center bg-[#FFE0F0]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#E91E63" stroke="#E91E63" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span class="text-[11px] font-medium truncate text-foreground max-w-[64px]">Pasel</span>
        </div>
        <div class="flex flex-col items-center gap-1.5 min-w-0">
          <div class="w-11 h-11 rounded-full flex items-center justify-center bg-[#E0F2FE]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1A73E8" stroke="#1A73E8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span class="text-[11px] font-medium truncate text-foreground max-w-[64px]">Libura</span>
        </div>
        <div class="flex flex-col items-center gap-1.5 min-w-0">
          <div class="w-11 h-11 rounded-full flex items-center justify-center bg-[#EFEBE9]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#795548" stroke="#795548" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span class="text-[11px] font-medium truncate text-foreground max-w-[64px]">Hakem</span>
        </div>
      </div>
    </section>

  </main>
</div>
      
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
      document.querySelectorAll("[data-nav-item-id]").forEach(function(item) {
        var active = item.getAttribute("data-nav-item-id") === "";
        item.setAttribute("data-active", active ? "true" : "false");
        item.setAttribute("aria-current", active ? "page" : "false");
      });
    </script>
  </body>
</html>




## compititor genearetd code :

<!DOCTYPE html>
<html lang="en">

  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Screen</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter&family=Space%20Grotesk&display=swap"
      rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script
      src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.2/dist/iconify-icon.min.js">
    </script>
    <style type="text/tailwindcss">
      @theme inline {
        --color-background: var(--background);
        --color-foreground: var(--foreground);
        --color-primary: var(--primary);
        --color-primary-foreground: var(--primary-foreground);
        --color-secondary: var(--secondary);
        --color-secondary-foreground: var(--secondary-foreground);
        --color-muted: var(--muted);
        --color-muted-foreground: var(--muted-foreground);
        --color-accent: var(--accent);
        --color-destructive: var(--destructive);
        --color-card: var(--card);
        --color-card-foreground: var(--card-foreground);
        --color-border: var(--border);
        --color-input: var(--input);
        --color-ring: var(--ring);
        --radius-sm: calc(var(--radius) - 4px);
        --radius-md: calc(var(--radius) - 2px);
        --radius-lg: var(--radius);
        --font-body: var(--font-body);
        --font-heading: var(--font-heading);
      }
      :root {         --card: hsl(0 0% 15);
        --ring: hsl(241 100% 80);
        --input: hsl(0 0% 20);
        --muted: hsl(0 0% 20);
        --accent: hsl(52 100% 78);
        --border: hsl(0 0% 20);
        --radius: 1rem;
        --popover: hsl(0 0% 10);
        --primary: hsl(241 100% 80);
        --font-body: 'Inter';
        --secondary: hsl(8 100% 78);
        --background: hsl(0 0% 10);
        --foreground: hsl(0 0% 95);
        --destructive: hsl(0 63% 31);
        --font-heading: 'Space Grotesk';
        --card-foreground: hsl(0 0% 95);
        --muted-foreground: hsl(0 0% 60);
        --accent-foreground: hsl(52 100% 10);
        --popover-foreground: hsl(0 0% 95);
        --primary-foreground: hsl(241 100% 10);
        --secondary-foreground: hsl(8 100% 10);
        --destructive-foreground: hsl(0 86% 97); }
      body { font-family: var(--font-body); }
      h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
    </style>
  </head>

  <body>
    <div
      class="bg-background min-h-screen w-full font-body text-foreground pb-24">
      <!-- Header -->
      <header
        class="flex items-center justify-between px-5 py-4 bg-background sticky top-0 z-10">
        <button
          class="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 transition-transform">
          <iconify-icon icon="lucide:menu" class="text-xl"></iconify-icon>
        </button>
        <h1 class="font-heading text-lg font-semibold">My tasks</h1>
        <button
          class="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 transition-transform">
          <iconify-icon icon="lucide:plus" class="text-xl"></iconify-icon>
        </button>
      </header>

      <!-- Calendar Strip -->
      <div class="px-5 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-col items-center gap-2 flex-1">
            <span
              class="text-xs font-medium text-muted-foreground uppercase">S</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-transparent text-foreground hover:bg-muted/50 transition-colors">8</button>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <span
              class="text-xs font-medium text-muted-foreground uppercase">M</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-transparent text-foreground hover:bg-muted/50 transition-colors">9</button>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <span
              class="text-xs font-medium text-muted-foreground uppercase">T</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-transparent text-foreground hover:bg-muted/50 transition-colors">10</button>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <span
              class="text-xs font-medium text-muted-foreground uppercase">W</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-transparent text-foreground hover:bg-muted/50 transition-colors">11</button>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <span class="text-xs font-medium text-primary uppercase">T</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-primary/10 text-primary border border-primary/20 transition-colors">12</button>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <span
              class="text-xs font-medium text-muted-foreground uppercase">F</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-transparent text-foreground hover:bg-muted/50 transition-colors">13</button>
          </div>
          <div class="flex flex-col items-center gap-2 flex-1">
            <span
              class="text-xs font-medium text-muted-foreground uppercase">S</span>
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center font-medium bg-transparent text-foreground hover:bg-muted/50 transition-colors">14</button>
          </div>
        </div>
      </div>

      <!-- Task List -->
      <main class="px-5 py-4 flex flex-col gap-6">

        <!-- TO-DO Section -->
        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <iconify-icon icon="lucide:circle"
                  class="text-sm"></iconify-icon>
              </div>
              <span
                class="text-sm font-semibold tracking-wide text-primary uppercase">To-Do</span>
            </div>
            <span class="text-sm text-muted-foreground font-medium">2
              task</span>
          </div>

          <!-- Task Card 1 -->
          <div
            class="bg-card rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-4 active:scale-[0.98] transition-transform cursor-pointer">
            <h3
              class="font-heading font-medium text-base text-card-foreground leading-snug">
              Feedback on empty state visuals</h3>
            <div class="flex items-center flex-wrap gap-2">
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground border border-border/50 text-xs font-medium">
                <iconify-icon icon="lucide:user"
                  class="text-[14px]"></iconify-icon>
                Andrew S
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-600 border border-green-500/20 text-xs font-medium">
                <iconify-icon icon="lucide:calendar"
                  class="text-[14px]"></iconify-icon>
                Tomorrow
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-medium">
                <iconify-icon icon="lucide:flag"
                  class="text-[14px] fill-current"></iconify-icon>
                Urgent
              </div>
            </div>
          </div>

          <!-- Task Card 2 -->
          <div
            class="bg-card rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-4 active:scale-[0.98] transition-transform cursor-pointer">
            <h3
              class="font-heading font-medium text-base text-card-foreground leading-snug">
              Set up dashboard grid system</h3>
            <div class="flex items-center flex-wrap gap-2">
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground border border-border/50 text-xs font-medium">
                <iconify-icon icon="lucide:user"
                  class="text-[14px]"></iconify-icon>
                Carlos S
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground border border-border/50 text-xs font-medium">
                <iconify-icon icon="lucide:calendar"
                  class="text-[14px]"></iconify-icon>
                Mar 16, 2026
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-medium">
                <iconify-icon icon="lucide:flag"
                  class="text-[14px] fill-current"></iconify-icon>
                High
              </div>
            </div>
          </div>
        </section>

        <!-- IN PROGRESS Section -->
        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-600 flex items-center justify-center">
                <iconify-icon icon="lucide:sun" class="text-sm"></iconify-icon>
              </div>
              <span
                class="text-sm font-semibold tracking-wide text-cyan-600 uppercase">In
                Progress</span>
            </div>
            <span class="text-sm text-muted-foreground font-medium">1
              task</span>
          </div>

          <!-- Task Card 3 -->
          <div
            class="bg-card rounded-2xl p-4 shadow-sm border border-border flex flex-col gap-4 active:scale-[0.98] transition-transform cursor-pointer">
            <h3
              class="font-heading font-medium text-base text-card-foreground leading-snug">
              Complete dashboard features screen</h3>
            <div class="flex items-center flex-wrap gap-2">
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground border border-border/50 text-xs font-medium">
                <iconify-icon icon="lucide:user"
                  class="text-[14px]"></iconify-icon>
                Carlos S
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-medium">
                <iconify-icon icon="lucide:calendar"
                  class="text-[14px]"></iconify-icon>
                3 days ago
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs font-medium">
                <iconify-icon icon="lucide:flag"
                  class="text-[14px] fill-current"></iconify-icon>
                Low
              </div>
            </div>
          </div>
        </section>

        <!-- PENDING Section -->
        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center">
                <iconify-icon icon="lucide:clock"
                  class="text-sm"></iconify-icon>
              </div>
              <span
                class="text-sm font-semibold tracking-wide text-orange-600 uppercase">Pending</span>
            </div>
            <span class="text-sm text-muted-foreground font-medium">3
              task</span>
          </div>
          <!-- Add empty state or partial tasks here if needed to fill out bottom -->
        </section>

      </main>

      <!-- Bottom Navigation -->
      <div
        class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-md rounded-full px-2 py-2 shadow-lg border border-border flex items-center gap-2 z-50">
        <a href="floow://dashboard"
          class="w-12 h-12 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors">
          <iconify-icon icon="lucide:home" class="text-2xl"></iconify-icon>
        </a>
        <a href="#"
          class="w-12 h-12 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors">
          <iconify-icon icon="lucide:search" class="text-2xl"></iconify-icon>
        </a>
        <a href="floow://my-tasks"
          class="w-12 h-12 flex items-center justify-center rounded-full bg-foreground text-background shadow-md transition-colors">
          <iconify-icon icon="lucide:check-circle"
            class="text-2xl"></iconify-icon>
        </a>
        <a href="floow://settings"
          class="w-12 h-12 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors">
          <iconify-icon icon="lucide:user" class="text-2xl"></iconify-icon>
        </a>
      </div>
    </div>
  </body>

</html>
{
  "generationRunId": "f42b5227-402d-4f44-b09b-b3e019e2d113",
  "screenId": "6ea464c5-9f63-43f6-b26a-07a018cf5494",
  "projectId": "f938f404-7387-42fb-8be5-9a3855d243df",
  "screenPlan": {
    "name": "Home",
    "type": "root",
    "description": "Reference DNA: Inspired by the 'pre-run density' requirement. Visual Goal: Prepare the runner with context and a clear launch trigger. Layout Anatomy: A vertical stack starting with a greeting and 'Last Run' summary, followed by a large map preview card, and anchored by a massive 'Start Run' button. Key Components: Map preview (muted dark tiles with a glowing Volt polyline), 'Last Run' card with distance and pace in dg-type-metric-value, and a full-width 64px tall 'Start' button in dg-action-primary. Visual Styling: Background is dg-bg-primary. The map card has a subtle dg-border-divider. Typography uses Outfit with high-emphasis white for primary stats. Interaction Notes: Tapping the map opens route selection; the Start button has a haptic 'click' feel. Must Preserve: The 64px button height and the single Volt Green accent for the Start button.",
    "chromePolicy": {
      "chrome": "bottom-tabs",
      "showPrimaryNavigation": true,
      "showsBackButton": false
    },
    "navigationItemId": "run"
  },
  "prompt": "Running app home screen\n\nFast, aerodynamic, and mid-run readable. A high-contrast dark base — deep graphite, not pure black — with a single electric accent that defines the entire brand identity: pick one and commit (neon coral, volt green, or electric blue — never more than one). All secondary information lives in warm grays. Typography is the hardest-working element: a wide, open sans-serif with large x-height (think Outfit or General Sans) chosen specifically for legibility at arm's length while bouncing — your current pace in 48pt+ should be readable with sweat in your eyes and sun on your screen. Numbers use tabular mono-width figures and update without layout shift. The active run screen is sacred — radically minimal, three stats maximum (time, distance, pace) stacked vertically with massive type, no chrome, no borders, nothing to accidentally tap. A single thin accent-colored line at the top acts as distance progress. Everything else — splits, heart rate, elevation — lives behind a half-swipe overlay that slides up without pausing the run. Pre and post-run screens can afford more density: route maps use a thick, glowing accent-colored polyline on muted dark map tiles, split tables use alternating subtle row shading for scannability, and elevation profiles fill with a soft gradient beneath the line. Components are built for gross motor control — buttons are full-width and tall (56px+), swipe gestures replace small tap targets, and the start/stop button is physically large with a long-press to stop to prevent accidental ends. The single moment of celebration: finishing a run triggers a brief full-screen stat summary with the route map as a background, your headline stat (distance or time) in massive display type, and a subtle pulse animation on any new personal record. No confetti, no badges — just your number, bigger than anything else on the screen, saying that was enough. The app should feel like lacing up a shoe that fits perfectly. Think Strava's route map meets Nike Run Club's mid-run focus meets a Formula 1 dashboard's respect for real-time data.",
  "designTokens": {
    "system_schema": "mobile_universal_core",
    "tokens": {
      "color": {
        "background": {
          "primary": "#121212",
          "secondary": "#1A1A1A"
        },
        "surface": {
          "card": "#1E1E1E",
          "bottom_sheet": "#1A1A1A",
          "modal": "#121212"
        },
        "text": {
          "high_emphasis": "#FFFFFF",
          "medium_emphasis": "#A0A098",
          "low_emphasis": "#60605A"
        },
        "action": {
          "primary": "#DFFF00",
          "secondary": "#2A2A2A",
          "disabled": "#333333",
          "on_primary_text": "#000000"
        },
        "border": {
          "divider": "#262626",
          "focused": "#DFFF00"
        }
      },
      "typography": {
        "font_family": "'Outfit', 'General Sans', sans-serif",
        "nav_title": {
          "size": "18px",
          "weight": "600",
          "line_height": "24px"
        },
        "screen_title": {
          "size": "32px",
          "weight": "700",
          "line_height": "38px"
        },
        "hero_title": {
          "size": "64px",
          "weight": "800",
          "line_height": "72px"
        },
        "section_title": {
          "size": "14px",
          "weight": "600",
          "line_height": "20px"
        },
        "metric_value": {
          "size": "56px",
          "weight": "700",
          "line_height": "64px"
        },
        "body": {
          "size": "16px",
          "weight": "400",
          "line_height": "24px"
        },
        "supporting": {
          "size": "14px",
          "weight": "400",
          "line_height": "20px"
        },
        "caption": {
          "size": "12px",
          "weight": "500",
          "line_height": "16px"
        },
        "button_label": {
          "size": "16px",
          "weight": "700",
          "line_height": "24px"
        }
      },
      "spacing": {
        "none": "0px",
        "xxs": "4px",
        "xs": "8px",
        "sm": "12px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "xxl": "48px"
      },
      "mobile_layout": {
        "screen_margin": "20px",
        "safe_area_top": "16px",
        "safe_area_bottom": "16px",
        "section_gap": "40px",
        "element_gap": "12px"
      },
      "sizing": {
        "min_touch_target": "48px",
        "standard_button_height": "64px",
        "standard_input_height": "56px",
        "icon_small": "20px",
        "icon_standard": "24px",
        "bottom_nav_height": "72px"
      },
      "radii": {
        "app": "4px",
        "pill": "9999px"
      },
      "border_widths": {
        "standard": "1px"
      },
      "shadows": {
        "none": "none",
        "surface": "none",
        "overlay": "0px 8px 32px rgba(0, 0, 0, 0.8)"
      },
      "opacities": {
        "transparent": "0",
        "disabled": "0.38",
        "scrim_overlay": "0.70",
        "pressed": "0.12",
        "opaque": "1"
      },
      "z_index": {
        "base": "0",
        "sticky_header": "10",
        "bottom_nav": "20",
        "bottom_sheet": "30",
        "modal_dialog": "40",
        "toast_snackbar": "50"
      }
    },
    "meta": {
      "recommendedFonts": [
        "Outfit",
        "General Sans",
        "Inter"
      ]
    }
  },
  "image": null,
  "requiresBottomNav": true,
  "navigationArchitecture": {
    "kind": "bottom-tabs-app",
    "primaryNavigation": "bottom-tabs",
    "rootChrome": "bottom-tabs",
    "detailChrome": "top-bar-back",
    "consistencyRules": [
      "All primary navigation destinations use the bottom-tabs shell.",
      "The Active Run screen is an immersive detail view that hides all chrome for maximum focus.",
      "Accent color (Volt Green) is used exclusively for primary actions and critical performance data.",
      "Typography must maintain high contrast against the deep graphite background."
    ],
    "rationale": "A bottom-tabs structure provides quick access to history and settings, while the 'Run' tab serves as the high-performance cockpit. This allows for a clear separation between the 'sacred' tracking experience and the data-dense review experience."
  },
  "navigationPlan": {
    "enabled": true,
    "kind": "bottom-tabs",
    "items": [
      {
        "id": "run",
        "label": "Run",
        "icon": "play",
        "role": "Primary launch point for tracking",
        "linkedScreenName": "Home"
      },
      {
        "id": "activity",
        "label": "Activity",
        "icon": "activity",
        "role": "Historical run data and trends",
        "linkedScreenName": "Activity History"
      },
      {
        "id": "profile",
        "label": "Profile",
        "icon": "user",
        "role": "User settings and personal records",
        "linkedScreenName": "Profile"
      }
    ],
    "visualBrief": "A floating glass pill dock with a deep graphite (dg-bg-secondary) surface and high-blur backdrop. Icons use dg-text-medium for inactive states and dg-action-primary (Volt Green) for the active state. The dock is compact, with a 24px bottom margin to feel 'aerodynamic' and detached from the screen edges.",
    "screenChrome": [
      {
        "screenName": "Home",
        "chrome": "bottom-tabs",
        "navigationItemId": "run"
      },
      {
        "screenName": "Active Run",
        "chrome": "immersive",
        "navigationItemId": null
      },
      {
        "screenName": "Post-Run Celebration",
        "chrome": "immersive",
        "navigationItemId": null
      },
      {
        "screenName": "Activity History",
        "chrome": "bottom-tabs",
        "navigationItemId": "activity"
      }
    ]
  },
  "projectCharter": {
    "originalPrompt": "A high-performance running app with a focus on mid-run readability and aerodynamic design. Features a dark graphite base with a single 'Volt Green' accent. Typography is massive and legible (Outfit/General Sans). Includes a pre-run home screen, a radically minimal active run screen with a vertical stat stack, and a celebratory post-run summary screen.",
    "imageReferenceSummary": null,
    "appType": "Performance Running Tracker",
    "targetAudience": "Serious runners and data-focused athletes",
    "navigationModel": "Bottom-tab navigation for general app areas with an immersive, chrome-free mode for active tracking.",
    "keyFeatures": [
      "High-readability mid-run cockpit",
      "Volt Green performance accents",
      "Tabular mono-width metric updates",
      "Half-swipe stat overlays",
      "Celebratory post-run data visualization"
    ],
    "designRationale": "The visual DNA is 'Formula 1 for Runners.' It prioritizes real-time data legibility above all else. By using a deep graphite base instead of pure black, we reduce harsh contrast while maintaining a premium, technical feel. The single accent color (Volt Green) acts as a functional beacon for progress and action.",
    "creativeDirection": {
      "conceptName": "Volt Velocity",
      "styleEssence": "Aerodynamic, technical, and radically focused. Every pixel serves the run.",
      "colorStory": "Deep Graphite (#121212) base, Warm Gray (#A0A098) secondary info, and a single Electric Volt (#DFFF00) accent.",
      "typographyMood": "Wide, open, and authoritative. Numbers are tabular and massive to ensure zero layout shift during high-speed updates.",
      "surfaceLanguage": "Flat, technical surfaces with subtle depth provided by soft gradients and glowing polylines rather than shadows.",
      "iconographyStyle": "Thin-stroke, geometric, and functional. No decorative elements.",
      "compositionPrinciples": [
        "Vertical stacking for primary metrics",
        "Full-width touch targets for gross motor control",
        "Radical reduction of non-essential chrome"
      ],
      "signatureMoments": [
        "The glowing Volt polyline on dark map tiles",
        "The massive, screen-filling post-run headline stat",
        "The half-swipe 'drawer' for secondary run data"
      ],
      "motionTone": "Snappy, precise, and frictionless. Overlays slide with high-tension easing.",
      "avoid": [
        "Confetti or gamified badges",
        "Pure black backgrounds",
        "Small tap targets",
        "Multiple accent colors"
      ]
    },
    "navigationArchitecture": {
      "kind": "bottom-tabs-app",
      "primaryNavigation": "bottom-tabs",
      "rootChrome": "bottom-tabs",
      "detailChrome": "top-bar-back",
      "consistencyRules": [
        "All primary navigation destinations use the bottom-tabs shell.",
        "The Active Run screen is an immersive detail view that hides all chrome for maximum focus.",
        "Accent color (Volt Green) is used exclusively for primary actions and critical performance data.",
        "Typography must maintain high contrast against the deep graphite background."
      ],
      "rationale": "A bottom-tabs structure provides quick access to history and settings, while the 'Run' tab serves as the high-performance cockpit. This allows for a clear separation between the 'sacred' tracking experience and the data-dense review experience."
    },
    "referenceScreens": [],
    "designSystemSignals": null,
    "planningDiagnostics": {
      "source": "planner",
      "rawPlanKeys": [
        "navigation_architecture",
        "navigation_plan",
        "charter",
        "screens"
      ],
      "rawScreenCount": 4,
      "recoveredScreens": 4
    },
    "charterSource": "planner"
  },
  "projectContext": null
}
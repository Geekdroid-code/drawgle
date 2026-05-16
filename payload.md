project_charter:

{
  "appType": "Event Planning & Management",
  "keyFeatures": [
    "Budget and Guest Tracking Metrics",
    "Event Progress Visualization",
    "Interactive Calendar Scheduling",
    "Activity Feed"
  ],
  "charterSource": "planner",
  "originalPrompt": "build these clean, minimal, premium and modern ios app screens with great design aesthetics as shown in screenshot",
  "targetAudience": "Social event planners and individuals managing personal celebrations",
  "designRationale": "The design uses a 'Soft Premium' aesthetic. It relies on a light gray background (dg-bg-primary) to make white cards (dg-surface-card) pop with depth. The primary brand color (dg-action-primary) is used sparingly for high-intent actions and progress indicators to maintain a clean, minimal feel.",
  "navigationModel": "Bottom-tabbed navigation for high-level feature access with hierarchical drill-downs for event details.",
  "referenceScreens": [],
  "creativeDirection": {
    "avoid": [
      "Heavy borders",
      "Dark mode (unless requested)",
      "Dense text blocks"
    ],
    "colorStory": "Monochromatic base (White/Gray) with a high-energy Red (#FF1A1A) for focus and momentum.",
    "motionTone": "Subtle vertical slides and soft fades between tab transitions.",
    "conceptName": "Eventify Minimalist",
    "styleEssence": "Premium utility through whitespace and refined typography.",
    "typographyMood": "Friendly yet structured, using a mix of bold weights for hierarchy and lighter weights for metadata.",
    "surfaceLanguage": "Floating white cards with large corner radii (24px) and soft, diffused shadows.",
    "iconographyStyle": "Thin-stroke line icons with rounded terminals, occasionally paired with colorful background containers for category identification.",
    "signatureMoments": [
      "The metric card trio with distinct icon backgrounds",
      "The circular progress rings on event list items",
      "The floating 'Create Event' button in the calendar view"
    ],
    "compositionPrinciples": [
      "Generous horizontal margins (20px)",
      "Vertical stacking with clear section gaps (32px)",
      "Progress rings for visual status updates"
    ]
  },
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
  "imageReferenceSummary": "The reference shows a three-screen flow for an event planning app (Eventify) featuring a dashboard with metrics, an event list with progress rings, and a calendar view. The style is characterized by high-contrast red accents, soft rounded cards, and generous whitespace.",
  "navigationArchitecture": {
    "kind": "bottom-tabs-app",
    "rationale": "The app uses a standard iOS-style bottom tab bar to provide quick access to the four main functional pillars: Dashboard, Event Management, Scheduling, and User Settings.",
    "rootChrome": "bottom-tabs",
    "detailChrome": "top-bar-back",
    "consistencyRules": [
      "All root screens must use the dg-bg-primary background color.",
      "Primary navigation must remain visible on all root destinations.",
      "Section headers must use dg-type-section-title with horizontal screen_edge_padding.",
      "Cards must use dg-surface-card with dg-radius-app and dg-shadow-surface."
    ],
    "primaryNavigation": "bottom-tabs"
  }
}







{
  "meta": {
    "recommendedFonts": [
      "Plus Jakarta Sans",
      "Outfit",
      "Inter"
    ]
  },
  "tokens": {
    "color": {
      "text": {
        "low_emphasis": "#999999",
        "high_emphasis": "#000000",
        "medium_emphasis": "#666666"
      },
      "action": {
        "primary": "#FF1A1A",
        "disabled": "#E0E0E0",
        "secondary": "#F2F2F2",
        "on_primary_text": "#FFFFFF"
      },
      "border": {
        "divider": "#EEEEEE",
        "focused": "#FF1A1A"
      },
      "surface": {
        "card": "#FFFFFF",
        "modal": "#FFFFFF",
        "bottom_sheet": "#FFFFFF"
      },
      "background": {
        "primary": "#F5F5F5",
        "secondary": "#FFFFFF"
      }
    },
    "radii": {
      "app": "24px",
      "pill": "9999px"
    },
    "sizing": {
      "icon_small": "18px",
      "icon_standard": "24px",
      "min_touch_target": "48px",
      "bottom_nav_height": "84px",
      "standard_input_height": "52px",
      "standard_button_height": "56px"
    },
    "shadows": {
      "none": "none",
      "overlay": "0px 10px 40px rgba(0, 0, 0, 0.12)",
      "surface": "0px 4px 20px rgba(0, 0, 0, 0.04)"
    },
    "spacing": {
      "lg": "24px",
      "md": "16px",
      "sm": "12px",
      "xl": "32px",
      "xs": "8px",
      "xxl": "48px",
      "xxs": "4px",
      "none": "0px"
    },
    "z_index": {
      "base": "0",
      "bottom_nav": "20",
      "bottom_sheet": "30",
      "modal_dialog": "40",
      "sticky_header": "10",
      "toast_snackbar": "50"
    },
    "opacities": {
      "opaque": "1",
      "pressed": "0.12",
      "disabled": "0.38",
      "transparent": "0",
      "scrim_overlay": "0.50"
    },
    "typography": {
      "body": {
        "size": "15px",
        "weight": 400,
        "line_height": "20px"
      },
      "caption": {
        "size": "11px",
        "weight": 500,
        "line_height": "14px"
      },
      "nav_title": {
        "size": "17px",
        "weight": 600,
        "line_height": "22px"
      },
      "hero_title": {
        "size": "28px",
        "weight": 800,
        "line_height": "34px"
      },
      "supporting": {
        "size": "13px",
        "weight": 500,
        "line_height": "18px"
      },
      "font_family": "'Plus Jakarta Sans', sans-serif",
      "button_label": {
        "size": "16px",
        "weight": 600,
        "line_height": "20px"
      },
      "metric_value": {
        "size": "20px",
        "weight": 700,
        "line_height": "26px"
      },
      "screen_title": {
        "size": "24px",
        "weight": 700,
        "line_height": "32px"
      },
      "section_title": {
        "size": "18px",
        "weight": 600,
        "line_height": "24px"
      }
    },
    "border_widths": {
      "standard": "1px"
    },
    "mobile_layout": {
      "element_gap": "12px",
      "section_gap": "32px",
      "safe_area_top": "16px",
      "screen_margin": "20px",
      "safe_area_bottom": "16px"
    }
  },
  "system_schema": "mobile_universal_core"
}
}
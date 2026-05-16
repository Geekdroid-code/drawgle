---
name: Serene Security
colors:
  surface: '#faf9fe'
  surface-dim: '#dad9df'
  surface-bright: '#faf9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#eeedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f5'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#006e28'
  on-secondary: '#ffffff'
  secondary-container: '#6ffb85'
  on-secondary-container: '#00732a'
  tertiary: '#894d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ac6300'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#72fe88'
  secondary-fixed-dim: '#53e16f'
  on-secondary-fixed: '#002107'
  on-secondary-fixed-variant: '#00531c'
  tertiary-fixed: '#ffdcbf'
  tertiary-fixed-dim: '#ffb874'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6a3b00'
  background: '#faf9fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 20px
  stack-gap: 12px
---

## Brand & Style

The design system is centered on the concept of "Effortless Security." It moves away from the aggressive, dark, and industrial aesthetics often associated with cybersecurity, instead embracing a **Corporate Modern** style infused with **Minimalist** warmth. 

The target audience consists of digital professionals and security-conscious individuals who value clarity and ease of use. The UI evokes a sense of calm and order, utilizing generous whitespace and a "soft-touch" physical metaphor. It feels less like a vault and more like a high-end personal concierge—reliable, discreet, and exceptionally organized.

## Colors

This design system utilizes a high-key light palette to maintain an open and approachable atmosphere. 

- **Foundation:** Pure white (`#FFFFFF`) is used for primary interactive cards and surfaces, set against a very light gray (`#F2F2F7`) base background to create subtle separation.
- **Accents:** We use functional color-coding for state and categorization. **Blue** represents primary actions and identity; **Green** signifies health, security, and "Very Good" statuses; **Orange** is used for warnings or business-related categorization; **Red** is reserved strictly for high-risk alerts or destructive actions.
- **Grays:** A scale of soft neutrals handles secondary text and decorative borders, ensuring that the interface never feels "heavy" or overly technical.

## Typography

The typography uses **Plus Jakarta Sans** for all levels. Its slightly rounded terminals and open apertures provide the "friendly but professional" balance required for a security app. 

Hierarchy is established primarily through weight and color rather than drastic size shifts. Display sizes are used sparingly for dashboard metrics (like security scores). For mobile accessibility, all body text remains at or above 14px. Tighten letter spacing slightly for headlines to create a more compact, modern feel.

## Layout & Spacing

This design system uses a **fluid layout** with fixed horizontal safe areas. The grid is optimized for a 4pt/8pt rhythm to ensure mathematical harmony between elements.

- **Margins:** Screens should maintain a consistent 20px horizontal margin.
- **Grouping:** Elements within a card use 12px or 16px gaps.
- **Sectioning:** Large vertical sections should be separated by 32px to provide clear visual breathing room.
- **Touch Targets:** All interactive elements (buttons, list items) must maintain a minimum height of 48px, even if the visual element appears smaller.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** and **Ambient Shadows**.

1.  **Base (Level 0):** The app background in light gray.
2.  **Surface (Level 1):** White cards with a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.04)). This makes containers feel like they are resting gently on the background.
3.  **Active (Level 2):** Primary action buttons or floating elements use a slightly more pronounced shadow with a hint of the brand color (0px 8px 24px rgba(0, 122, 255, 0.15)).

Avoid harsh borders or inner shadows. Use subtle 1px borders in a color only slightly darker than the surface if additional definition is needed on high-brightness screens.

## Shapes

The shape language is defined by significant **roundedness**. 

- **Primary Cards:** Use a 24px corner radius to create a soft, protective feel.
- **Secondary Items:** (Small buttons, input fields) use a 12px to 16px radius.
- **Icons:** Should follow a rounded-corner style, avoiding sharp points. 

This consistent roundness removes the "clinical" feel of security software and makes the interface feel tactile and modern.

## Components

- **Buttons:** Primary buttons are full-width with a 16px radius and bold typography. Secondary buttons use a tonal background (a lighter version of the accent color) rather than an outline.
- **Cards:** Cards are the primary container. They should always have a white background and 24px corner radius. Use vertical stacks for data points within cards.
- **Input Fields:** Use "Quiet" inputs with subtle bottom borders or very light-filled backgrounds. Label text should be positioned above the field in the `label-md` style.
- **Chips & Tags:** Used for vaults and labels. These should be pill-shaped with a 100px radius, using a subtle background tint of the category color.
- **Lists:** List items should be separated by a soft horizontal rule that does not span the full width of the card, or by simple vertical spacing for a cleaner look.
- **Security Score Gauge:** A custom component using a segmented progress bar or a large display number to provide immediate feedback on password health.
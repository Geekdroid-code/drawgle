/**
 * What each text role is for, by where the text sits. One definition for every prompt that names the roles
 * (the screen builder, the editor and the project memory), so that they cannot drift apart. The builder used
 * to be given the role names without this, and took the screen's own title for `screen_title` even when it
 * sat in a top bar beside a back arrow.
 */
export const buildTypographyRoleContract = () => [
  "Pick a role by where the text sits, then use its dg-type-* class:",
  "- dg-type-nav-title (typography.nav_title): the title inside a top app bar, the row that holds a back, close or menu control, on detail, settings, modal and player screens. One line, the smallest heading size. A title that sits beside a back arrow is always this role.",
  "- dg-type-screen-title (typography.screen_title): the heading that opens a root or tab screen, below the status bar and any greeting, with no back control beside it. It is never the title of a top app bar.",
  "- dg-type-hero-title (typography.hero_title): a display-size headline for onboarding, empty states or an editorial opener, only when the reference or brief shows one.",
  "- dg-type-section-title (typography.section_title): the heading of a card, a list or a group of content.",
  "- dg-type-metric-value (typography.metric_value): numbers that are the point, such as balances, prices, counters and scores.",
  "- dg-type-body (typography.body): main copy, and the title of a list row or card.",
  "- dg-type-supporting (typography.supporting): subtitles and secondary descriptions.",
  "- dg-type-caption (typography.caption): metadata, helper text, timestamps and small status text.",
  "- dg-type-button-label (typography.button_label): labels on buttons, chips, segmented controls and tabs.",
  "- The role classes set their own font family: nav-title, screen-title, hero-title and section-title use the heading family, and every other role uses the body family. Never add font-family styles or invent a third family. Never use a larger role than the reference or brief shows, and add no ad hoc text sizes or weights outside these roles unless a chart annotation truly needs one.",
].join("\n");

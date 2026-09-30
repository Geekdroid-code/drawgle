/**
 * What each text role is for, by where the text sits. One definition for every prompt that names the roles
 * (the screen builder, the editor and the project memory), so that they cannot drift apart. The builder used
 * to be given the role names without this, and took the screen's own title for `screen_title` even when it
 * sat in a top bar beside a back arrow.
 */
export const buildTypographyRoleContract = () => [
  "Pick a role by where the text sits, then use its dg-type-* class:",
  "- dg-type-nav-title (typography.nav_title): the title in a top app bar, the row with a back, close or menu control. One line. A title beside a back arrow is always this role.",
  "- dg-type-screen-title (typography.screen_title): the heading that opens a root or tab screen, with no back control beside it. Never a top-bar title.",
  "- dg-type-hero-title (typography.hero_title): a display-size headline (onboarding, empty state, editorial opener), only when the reference or brief shows one.",
  "- dg-type-section-title (typography.section_title): the heading of a card, a list or a group.",
  "- dg-type-metric-value (typography.metric_value): numbers that are the point, such as balances, prices and scores.",
  "- dg-type-body (typography.body): main copy, and the title of a list row or card. dg-type-supporting: subtitles and secondary text. dg-type-caption: metadata and small status text. dg-type-button-label: buttons, chips, segmented controls and tabs.",
  "The classes set the font family (heading roles use the heading family, the rest the body family): never add font-family styles, and never use a larger role than the reference or brief shows.",
].join("\n");

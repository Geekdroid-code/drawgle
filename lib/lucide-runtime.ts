/**
 * Screens name Lucide icons in `data-lucide`, and Lucide finds an icon by turning that name into its PascalCase key
 * ("file-text" becomes FileText). A name written without its dashes ("filetext", which older navigation plans stored
 * for a planner's "FileText") finds nothing, and the icon is left blank: the first live project's Invoices tab drew
 * nothing. This matches such a name to an icon by its letters and digits alone, before Lucide draws the page, so
 * screens and navigation saved before the fix draw too. A name that matches no icon is left as it is.
 *
 * It runs inside the screen's own page (the canvas frame and the exports), so it is kept as source text.
 */
export const LUCIDE_NAME_REPAIR_SCRIPT = `function drawgleRepairLucideNames(root) {
  var icons = window.lucide && window.lucide.icons;
  if (!icons) return 0;
  var byLetters = null;
  var repaired = 0;
  (root || document).querySelectorAll("[data-lucide]").forEach(function (node) {
    var name = node.getAttribute("data-lucide") || "";
    var key = name.replace(/^([A-Z])|[\\s\\-_]+(\\w)/g, function (match, first, next) { return next ? next.toUpperCase() : first.toLowerCase(); });
    key = key.charAt(0).toUpperCase() + key.slice(1);
    if (icons[key]) return;
    if (!byLetters) {
      byLetters = {};
      Object.keys(icons).forEach(function (iconKey) { byLetters[iconKey.toLowerCase()] = iconKey; });
    }
    var match = byLetters[name.replace(/[^a-z0-9]/gi, "").toLowerCase()];
    if (match) {
      node.setAttribute("data-lucide", match);
      repaired += 1;
    }
  });
  return repaired;
}`;

/** Repairs the page's icon names and draws its icons, when Lucide has loaded. */
export const LUCIDE_DRAW_ICONS_CALL =
  'if (window.lucide && typeof window.lucide.createIcons === "function") { drawgleRepairLucideNames(); window.lucide.createIcons(); }';

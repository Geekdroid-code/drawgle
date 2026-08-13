const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const stripStreamingFences = (text: string) => {
  const completeFence = text.match(/```(?:html)?\n([\s\S]*?)\n```/i);
  if (completeFence) return completeFence[1].trim();
  return text.replace(/^```html\n/i, "").replace(/\n```$/, "").trim();
};

/**
 * Turn an in-progress HTML stream into a deterministic preview fragment.
 *
 * Model chunks commonly end inside a tag and almost always leave ancestor
 * elements open until the final chunk. Browsers repair that malformed tree
 * differently as more text arrives, which makes whole sections jump between
 * parents. We remove only the unfinished trailing tag and close the currently
 * open elements explicitly. The source stream is untouched; this is canvas
 * presentation only.
 */
export function stabilizeStreamedHtml(source: string): string {
  const joined = stripStreamingFences(source);
  const lastOpen = joined.lastIndexOf("<");
  const lastClose = joined.lastIndexOf(">");
  const completePrefix = lastOpen > lastClose ? joined.slice(0, lastOpen) : joined;
  const openTags: string[] = [];
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w:-]*)\b[^>]*>/gi;

  for (const match of completePrefix.matchAll(tagPattern)) {
    const rawTag = match[0];
    const tagName = match[1]?.toLowerCase();
    if (!tagName || rawTag.startsWith("<!") || VOID_HTML_TAGS.has(tagName) || /\/>\s*$/.test(rawTag)) {
      continue;
    }

    if (!/^<\//.test(rawTag)) {
      openTags.push(tagName);
      continue;
    }

    const matchingIndex = openTags.lastIndexOf(tagName);
    if (matchingIndex !== -1) {
      openTags.splice(matchingIndex);
    }
  }

  if (openTags.length === 0) return completePrefix;
  return completePrefix + openTags.reverse().map((tagName) => `</${tagName}>`).join("");
}

/**
 * Rendered geometry measurement.
 *
 * Every static check in this codebase reasons about markup. None of them can
 * answer the only question that actually predicts whether a screen looks
 * broken: *did the content fit the box it was put in?*
 *
 * That question is unanswerable from HTML alone. A card declared `h-[152px]`
 * containing an `aspect-square` tile plus two lines of type is 146px of content
 * in 136px of usable height — but the tile's height comes from its computed
 * width, and the type's height comes from the resolved font. Both are known
 * only after layout. This module therefore measures the rendered document
 * instead of predicting it.
 *
 * The script below runs inside the preview iframe and returns findings that map
 * directly to what a person sees: text escaping a card, a row wider than the
 * frame, a control too small to tap.
 *
 * Deliberately framework-free and self-contained so the same string can be used
 * by the A/B harness, an offline audit, and eventually the build itself.
 */

export const MOBILE_FRAME_WIDTH_PX = 390;
export const MOBILE_FRAME_HEIGHT_PX = 844;

export type RenderedGeometryCode =
  | "content_overflows_container"
  | "horizontal_overflow"
  | "text_clipped"
  | "undersized_touch_target"
  | "empty_visual_region";

export interface RenderedGeometryFinding {
  code: RenderedGeometryCode;
  /**
   * The markup shows this was deliberate — `overflow-hidden` masking, an
   * intentional ellipsis, a clipped decorative layer. Such findings are
   * recorded, never treated as defects.
   */
  intentional?: boolean;
  /** `data-drawgle-id` when present, otherwise a short CSS-ish path. */
  target: string;
  /** Measured pixels of overflow, or the measured size for size findings. */
  amountPx: number;
  detail: string;
}

export interface RenderedGeometryReport {
  measuredAt: string;
  viewport: { width: number; height: number };
  documentScrollWidth: number;
  findings: RenderedGeometryFinding[];
}

/** Tolerance for sub-pixel layout noise. Below this nothing is visible. */
const OVERFLOW_TOLERANCE_PX = 2;

/** Minimum comfortable tap target on mobile. */
const MIN_TOUCH_TARGET_PX = 44;

/**
 * Browser-side measurement source, as a string so it can be injected into an
 * iframe, a headless page, or a generated report without a bundler.
 *
 * Evaluates to a `RenderedGeometryReport`.
 */
export const RENDERED_GEOMETRY_SCRIPT = `(() => {
  const TOLERANCE = ${OVERFLOW_TOLERANCE_PX};
  const MIN_TOUCH = ${MIN_TOUCH_TARGET_PX};
  const findings = [];

  const label = (el) => {
    if (el.dataset && el.dataset.drawgleId) return el.dataset.drawgleId;
    const cls = (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };

  const text = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();

  const root = document.querySelector('#root') || document.body;
  const all = Array.from(root.querySelectorAll('*'));

  // 1. Content taller than the box holding it. This is the card whose text
  //    escapes through its own rounded corner.
  for (const el of all) {
    const style = getComputedStyle(el);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') continue;
    if (style.display === 'inline' || style.position === 'absolute' || style.position === 'fixed') continue;
    const over = el.scrollHeight - el.clientHeight;
    if (el.clientHeight > 0 && over > TOLERANCE) {
      // overflow-hidden and line-clamp are how premium designs mask artwork,
      // crop hero media and clip decorative layers on purpose. Recorded as
      // intentional rather than dropped, so the data stays complete.
      const clamp = style.getPropertyValue('-webkit-line-clamp');
      const deliberate = style.overflowY === 'hidden' || style.overflowY === 'clip' || (clamp && clamp !== 'none');
      findings.push({
        code: 'content_overflows_container',
        target: label(el),
        amountPx: Math.round(over),
        intentional: Boolean(deliberate),
        detail: 'Content is ' + Math.round(over) + 'px taller than its container (' + el.scrollHeight + 'px in ' + el.clientHeight + 'px)'
          + (deliberate ? ', but the element clips deliberately.' : '.'),
      });
    }
  }

  // 2. Anything wider than the frame. Catches fixed widths and rails that do
  //    not scroll.
  for (const el of all) {
    const style = getComputedStyle(el);
    if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
    const over = el.scrollWidth - el.clientWidth;
    if (el.clientWidth > 0 && over > TOLERANCE) {
      const deliberate = style.overflowX === 'hidden' || style.overflowX === 'clip';
      findings.push({
        code: 'horizontal_overflow',
        target: label(el),
        amountPx: Math.round(over),
        intentional: Boolean(deliberate),
        detail: 'Content is ' + Math.round(over) + 'px wider than its container'
          + (deliberate ? ', but the element clips deliberately.' : '.'),
      });
    }
  }

  // 3. Text visually cut off, whether by truncation or by a box too small.
  for (const el of all) {
    if (el.children.length > 0) continue;
    const content = text(el);
    if (!content) continue;
    const cut = el.scrollWidth - el.clientWidth;
    if (el.clientWidth > 0 && cut > TOLERANCE) {
      // truncate / text-ellipsis / line-clamp are deliberate typographic
      // choices, not defects. Marked, not suppressed.
      const style = getComputedStyle(el);
      const clamp = style.getPropertyValue('-webkit-line-clamp');
      const deliberate = style.textOverflow === 'ellipsis' || (clamp && clamp !== 'none');
      findings.push({
        code: 'text_clipped',
        target: label(el),
        amountPx: Math.round(cut),
        intentional: Boolean(deliberate),
        detail: JSON.stringify(content.slice(0, 40)) + ' is clipped by ' + Math.round(cut) + 'px'
          + (deliberate ? ' by an intentional ellipsis.' : '.'),
      });
    }
  }

  // 4. Controls too small to tap.
  for (const el of root.querySelectorAll('button, a, [role="button"], [role="tab"], input, select')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const smallest = Math.min(rect.width, rect.height);
    if (smallest > 0 && smallest < MIN_TOUCH - TOLERANCE) {
      findings.push({
        code: 'undersized_touch_target',
        target: label(el),
        amountPx: Math.round(smallest),
        detail: 'Control measures ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px; the minimum is ' + MIN_TOUCH + 'px.',
      });
    }
  }

  // 5. Regions occupying real space with nothing rendered in them.
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.height < 120 || rect.width < 80) continue;
    if (text(el)) continue;
    if (el.querySelector('img, svg, canvas, video, [data-asset-slot], i[data-lucide]')) continue;
    const style = getComputedStyle(el);
    const painted = style.backgroundImage !== 'none'
      || (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)');
    if (!painted) continue;
    findings.push({
      code: 'empty_visual_region',
      target: label(el),
      amountPx: Math.round(rect.height),
      detail: 'A ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px painted region contains no text, media, or icon.',
    });
  }

  // Deduplicate: one finding per element per code, worst offender first.
  const seen = new Set();
  const deduped = [];
  for (const finding of findings.sort((a, b) => b.amountPx - a.amountPx)) {
    const key = finding.code + '|' + finding.target;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }

  return {
    measuredAt: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentScrollWidth: document.documentElement.scrollWidth,
    findings: deduped,
  };
})()`;

/** Severity ordering for reporting. Overflow beats polish. */
export const RENDERED_GEOMETRY_WEIGHT: Record<RenderedGeometryCode, number> = {
  content_overflows_container: 3,
  text_clipped: 3,
  horizontal_overflow: 2,
  empty_visual_region: 1,
  undersized_touch_target: 1,
};

export function summarizeRenderedGeometry(report: RenderedGeometryReport) {
  const byCode = new Map<RenderedGeometryCode, number>();
  for (const finding of report.findings) {
    byCode.set(finding.code, (byCode.get(finding.code) ?? 0) + 1);
  }
  const weighted = report.findings.reduce(
    (total, finding) => total + RENDERED_GEOMETRY_WEIGHT[finding.code],
    0,
  );
  return { total: report.findings.length, weighted, byCode };
}

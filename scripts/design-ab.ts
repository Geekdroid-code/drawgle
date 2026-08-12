/**
 * Design Brain A/B harness.
 *
 * Answers one question with evidence instead of opinion: does the design-brain
 * prompt layer make generated screens better, worse, or neither?
 *
 * Method:
 *   1. Pull a real stored screen plan and design tokens from a project, so the
 *      prompt is one the system actually produced rather than a synthetic one.
 *   2. Build the builder instruction twice — design brain on and off — with
 *      every other input byte-identical.
 *   3. Generate N screens per arm. N matters: the builder is stochastic, and a
 *      single sample per arm measures luck, not the prompt.
 *   4. Emit a self-contained report that renders every result at 390x844 and
 *      measures the rendered geometry in-page.
 *
 * Measurement is deliberately not the static critic. That critic reasons about
 * markup and is blind to whether content fit its box, which is the failure that
 * actually shows up on screen.
 *
 * NOTE (2026-08-12): the design-brain prompt layer was deleted after measuring
 * 62% worse rendered fault score. `DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED` no
 * longer exists, so BOTH ARMS NOW PRODUCE AN IDENTICAL PROMPT. The script
 * remains useful as a sample generator: it captures raw builder output and
 * renders it at 390x844 with objective measurement, which is what Phase 3
 * validation needs. Treat the two arms as 2N samples of one condition until a
 * new variable is wired in.
 *
 * Usage:
 *   pnpm run design:ab -- --project <uuid> [--screen "Name"] [--n 5]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { streamOpenRouterChatCompletion, type OpenRouterChatMessage } from "../lib/ai/openrouter-stream";
import { getOpenRouterScreenBuildReasoning, getOpenRouterStreamTimeouts } from "../lib/env/server";
import { normalizeDesignTokens } from "../lib/design-tokens";
import { buildBuilderProjectContract, formatBuilderProjectContract } from "../lib/generation/builder-product-contract";
import { buildScreenInstructionForMode } from "../lib/generation/prompts";
import { RENDERED_GEOMETRY_SCRIPT } from "../lib/generation/rendered-geometry";
import { extractFirstScreenRoot, sanitizeStaticDrawgleHtml, stripGenerationCompleteSentinel } from "../lib/generation/screen-quality";
import { buildDrawgleTokenCss, buildGoogleFontAssetLinks } from "../lib/token-runtime";
import type { DesignTokens, GenerationPromptMode, NavigationPlan, ProjectCharter, ScreenPlan } from "../lib/types";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const PROJECT_ID = arg("project");
const SCREEN_NAME = arg("screen");
const SAMPLES = Math.max(1, Number.parseInt(arg("n") ?? "5", 10) || 5);
const OUT_DIR = resolve(process.cwd(), arg("out") ?? "temp/design-ab");

if (!PROJECT_ID) {
  console.error("Usage: pnpm run design:ab -- --project <uuid> [--screen \"Name\"] [--n 5]");
  process.exit(1);
}

// `tsx --env-file-if-exists=.env.local` normally supplies these; fall back for
// direct invocation.
const loadEnvFile = (filePath: string) => {
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) return;
  for (const line of readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
};
loadEnvFile(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = arg("model")
  ?? process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_MODEL
  ?? process.env.DRAWGLE_SCREEN_BUILDER_MODEL
  ?? "openai/gpt-5.6-luna";

for (const [name, value] of Object.entries({ SUPABASE_URL, SERVICE_KEY, OPENROUTER_KEY })) {
  if (!value) {
    console.error(`Missing ${name}. Populate .env.local before running.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Fixture: a real stored plan
// ---------------------------------------------------------------------------

const rest = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
};

interface Fixture {
  screenPlan: ScreenPlan;
  designTokens: DesignTokens;
  navigationPlan: NavigationPlan | null;
  charter: ProjectCharter;
  promptMode: GenerationPromptMode;
  originalPrompt: string;
}

const loadFixture = async (): Promise<Fixture> => {
  const [project] = await rest<Array<{ prompt: string; design_tokens: DesignTokens; project_charter: ProjectCharter }>>(
    `projects?id=eq.${PROJECT_ID}&select=prompt,design_tokens,project_charter`,
  );
  if (!project) throw new Error(`Project ${PROJECT_ID} not found.`);

  const runs = await rest<Array<{ metadata: Record<string, unknown> }>>(
    `generation_runs?project_id=eq.${PROJECT_ID}&select=metadata&order=created_at.desc&limit=1`,
  );
  const metadata = runs[0]?.metadata ?? {};
  const plannedScreens = (metadata.plannedScreens ?? []) as ScreenPlan[];
  if (plannedScreens.length === 0) {
    throw new Error("No plannedScreens in the latest generation run; pick a project that completed planning.");
  }

  const screenPlan = SCREEN_NAME
    ? plannedScreens.find((screen) => screen.name.toLowerCase() === SCREEN_NAME.toLowerCase())
    : plannedScreens[0];
  if (!screenPlan) {
    throw new Error(`Screen "${SCREEN_NAME}" not found. Available: ${plannedScreens.map((s) => s.name).join(", ")}`);
  }

  return {
    screenPlan,
    designTokens: normalizeDesignTokens(project.design_tokens),
    navigationPlan: (metadata.navigationPlan as NavigationPlan | undefined) ?? null,
    charter: (metadata.charter as ProjectCharter | undefined) ?? project.project_charter,
    // Force prompt-only so neither arm depends on an attached image. The
    // question under test is the prompt layer, not reference fidelity.
    promptMode: "prompt",
    originalPrompt: project.prompt,
  };
};

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------

type ArmName = "design-brain-on" | "design-brain-off";

const buildMessages = (fixture: Fixture, arm: ArmName): OpenRouterChatMessage[] => {
  const previous = process.env.DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED;
  // The prompt builders read this at call time, so toggling around the call is
  // enough to produce both variants in one process.
  if (arm === "design-brain-off") process.env.DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED = "false";
  else delete process.env.DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED;

  try {
    const system = buildScreenInstructionForMode({
      designTokens: fixture.designTokens,
      designStyle: null,
      requiresBottomNav: Boolean(fixture.navigationPlan?.enabled),
      navigationArchitecture: null,
      navigationPlan: fixture.navigationPlan,
      assetRequirements: [],
      assetManifest: [],
      promptMode: fixture.promptMode,
      screenPlan: fixture.screenPlan,
      prompt: fixture.originalPrompt,
    });

    const contract = formatBuilderProjectContract(buildBuilderProjectContract({
      charter: fixture.charter,
      screenPlan: fixture.screenPlan,
      navigationPlan: fixture.navigationPlan,
      designTokens: fixture.designTokens,
    }));

    return [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Build the complete static HTML UI for ${fixture.screenPlan.name}.\n`
              + `Original context prompt: "${fixture.originalPrompt}"\n`
              + "Return the full screen once, with no commentary, no markdown, and no abbreviated sections.",
          },
          { type: "text", text: contract },
        ],
      },
    ];
  } finally {
    if (previous === undefined) delete process.env.DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED;
    else process.env.DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED = previous;
  }
};

const listEnv = (name: string) =>
  (process.env[name] ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);

const providerPreferences = (() => {
  const order = listEnv("DRAWGLE_OPENROUTER_PROVIDERS");
  const sort = process.env.DRAWGLE_OPENROUTER_SORT;
  const allowFallbacks = process.env.DRAWGLE_OPENROUTER_ALLOW_FALLBACKS !== "false";
  if (order.length === 0 && !sort) return { allow_fallbacks: allowFallbacks };
  return {
    ...(order.length > 0 ? { order } : {}),
    ...(sort ? { sort } : {}),
    allow_fallbacks: allowFallbacks,
  };
})();

const generateOnce = async (messages: OpenRouterChatMessage[], attempt: number) => {
  // The helper is an async generator that yields text as it streams.
  //
  // Partial output is kept when the stream times out. These builds run 2-5
  // minutes with reasoning enabled, and a nearly complete screen still measures
  // usefully — discarding it would throw away the whole sample and its cost.
  let text = "";
  try {
    for await (const chunk of streamOpenRouterChatCompletion({
      apiKey: OPENROUTER_KEY!,
      model: MODEL,
      messages,
      task: "design_ab",
      attempt,
      temperature: 0.7,
    maxTokens: Number.parseInt(process.env.DRAWGLE_OPENROUTER_MAX_TOKENS ?? "26000", 10) || 26000,
    // Match production exactly: same provider routing, same reasoning budget,
    // same timeouts. An arm that generates differently from the real builder
    // would not be measuring the real builder.
    provider: arg("free-routing") ? null : providerPreferences,
    reasoning: getOpenRouterScreenBuildReasoning(),
    timeouts: getOpenRouterStreamTimeouts(),
    })) {
      text += chunk;
    }
  } catch (error) {
    if (!text.trim()) throw error;
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`(partial after ${message}) `);
  }
  return text;
};

const cleanScreenHtml = (raw: string) => {
  const withoutFences = raw.replace(/^\s*```(?:html)?\s*/i, "").replace(/```\s*$/i, "");
  const withoutSentinel = stripGenerationCompleteSentinel(withoutFences).trim();
  const sanitized = sanitizeStaticDrawgleHtml(withoutSentinel);
  const rootCount = (sanitized.code.match(/min-h-screen/gi) ?? []).length;
  if (rootCount > 1) return extractFirstScreenRoot(sanitized.code) ?? sanitized.code;
  return sanitized.code;
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

interface Sample {
  arm: ArmName;
  index: number;
  html: string;
  chars: number;
  error?: string;
}

const buildReport = (fixture: Fixture, samples: Sample[], promptSizes: Record<ArmName, number>) => {
  const tokenCss = buildDrawgleTokenCss(fixture.designTokens);
  const fontLinks = buildGoogleFontAssetLinks(fixture.designTokens);
  const payload = samples.map((sample) => ({
    arm: sample.arm,
    index: sample.index,
    html: sample.html,
    error: sample.error ?? null,
  }));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Design Brain A/B — ${fixture.screenPlan.name}</title>
<script src="https://cdn.tailwindcss.com"></script>
${fontLinks}
<style>
  body { font: 14px/1.5 -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #f6f6f4; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; margin-bottom: 20px; }
  table { border-collapse: collapse; background: #fff; margin: 16px 0 28px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th, td { padding: 8px 14px; border-bottom: 1px solid #eee; text-align: left; font-variant-numeric: tabular-nums; }
  th { background: #fafaf8; font-weight: 600; }
  .win { color: #0a7c2f; font-weight: 600; }
  .lose { color: #b4232c; font-weight: 600; }
  .frames { display: flex; gap: 16px; flex-wrap: wrap; }
  .frame { background: #fff; padding: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .frame h3 { font-size: 12px; margin: 0 0 6px; color: #555; font-weight: 600; }
  iframe { width: 390px; height: 844px; border: 1px solid #ddd; background: #fff; }
  pre { background: #fff; padding: 12px; overflow-x: auto; font-size: 12px; max-height: 260px; }
</style>
</head>
<body>
<h1>Design Brain A/B — ${fixture.screenPlan.name}</h1>
<div class="meta">
  model <b>${MODEL}</b> · ${SAMPLES} samples per arm ·
  system prompt: on <b>${promptSizes["design-brain-on"].toLocaleString()}</b> chars,
  off <b>${promptSizes["design-brain-off"].toLocaleString()}</b> chars
  (<b>${(promptSizes["design-brain-on"] - promptSizes["design-brain-off"]).toLocaleString()}</b> difference)
</div>

<div id="summary">Rendering and measuring…</div>
<div id="detail"></div>
<h2>Rendered frames</h2>
<div class="frames" id="frames"></div>

<script id="samples" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>
<script>
const TOKEN_CSS = ${JSON.stringify(tokenCss)};
const FONT_LINKS = ${JSON.stringify(fontLinks)};
const SAMPLES = JSON.parse(document.getElementById('samples').textContent);

const frameDoc = (html) => \`<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.tailwindcss.com"><\\/script>
\${FONT_LINKS}
<style>\${TOKEN_CSS}
  html,body { margin:0; padding:0; }
  #root { width:390px; min-height:844px; overflow-x:hidden; }
</style></head><body><div id="root">\${html}</div></body></html>\`;

const measure = (win) => win.eval(${JSON.stringify(RENDERED_GEOMETRY_SCRIPT)});

const waitForStyles = (win) => new Promise((done) => {
  let tries = 0;
  const probe = () => {
    tries += 1;
    const el = win.document.querySelector('#root .flex, #root [class*="p-"], #root div');
    const ready = el && win.getComputedStyle(el).display !== 'inline';
    if (ready || tries > 60) return setTimeout(done, 350);
    setTimeout(probe, 100);
  };
  probe();
});

(async () => {
  const results = [];
  const framesEl = document.getElementById('frames');

  for (const sample of SAMPLES) {
    const wrap = document.createElement('div');
    wrap.className = 'frame';
    wrap.innerHTML = '<h3>' + sample.arm + ' #' + sample.index + '</h3>';
    const iframe = document.createElement('iframe');
    wrap.appendChild(iframe);
    framesEl.appendChild(wrap);

    if (sample.error) { results.push({ ...sample, report: null }); continue; }

    await new Promise((ready) => {
      iframe.onload = ready;
      iframe.srcdoc = frameDoc(sample.html);
    });
    await waitForStyles(iframe.contentWindow);
    let report = null;
    try { report = measure(iframe.contentWindow); } catch (e) { report = { findings: [], error: String(e) }; }
    results.push({ ...sample, report });
    wrap.querySelector('h3').textContent += ' — ' + (report.findings ? report.findings.length : '?') + ' findings';
  }

  const WEIGHT = { content_overflows_container: 3, text_clipped: 3, horizontal_overflow: 2, empty_visual_region: 1, undersized_touch_target: 1 };
  const arms = ['design-brain-on', 'design-brain-off'];
  const stats = {};
  for (const arm of arms) {
    const rows = results.filter((r) => r.arm === arm);
    const ok = rows.filter((r) => r.report && !r.error);
    const counts = (code) => ok.map((r) => r.report.findings.filter((f) => f.code === code).length);
    const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    stats[arm] = {
      samples: rows.length,
      failures: rows.filter((r) => r.error).length,
      overflow: mean(counts('content_overflows_container')),
      clipped: mean(counts('text_clipped')),
      horizontal: mean(counts('horizontal_overflow')),
      empty: mean(counts('empty_visual_region')),
      touch: mean(counts('undersized_touch_target')),
      weighted: mean(ok.map((r) => r.report.findings.reduce((t, f) => t + (WEIGHT[f.code] || 1), 0))),
      chars: mean(ok.map((r) => r.html.length)),
    };
  }

  const cell = (a, b, lowerIsBetter = true) => {
    if (Math.abs(a - b) < 0.01) return ['<td>' + a.toFixed(2) + '</td>', '<td>' + b.toFixed(2) + '</td>'];
    const aWins = lowerIsBetter ? a < b : a > b;
    return [
      '<td class="' + (aWins ? 'win' : 'lose') + '">' + a.toFixed(2) + '</td>',
      '<td class="' + (aWins ? 'lose' : 'win') + '">' + b.toFixed(2) + '</td>',
    ];
  };

  const rows = [
    ['Generation failures', stats[arms[0]].failures, stats[arms[1]].failures],
    ['Content overflow / screen', stats[arms[0]].overflow, stats[arms[1]].overflow],
    ['Clipped text / screen', stats[arms[0]].clipped, stats[arms[1]].clipped],
    ['Horizontal overflow / screen', stats[arms[0]].horizontal, stats[arms[1]].horizontal],
    ['Empty painted region / screen', stats[arms[0]].empty, stats[arms[1]].empty],
    ['Undersized controls / screen', stats[arms[0]].touch, stats[arms[1]].touch],
    ['WEIGHTED FAULT SCORE', stats[arms[0]].weighted, stats[arms[1]].weighted],
  ];

  document.getElementById('summary').innerHTML =
    '<table><tr><th>Metric (lower is better)</th><th>design brain ON</th><th>design brain OFF</th></tr>' +
    rows.map(([label, a, b]) => {
      const [ca, cb] = cell(Number(a), Number(b));
      return '<tr><td>' + label + '</td>' + ca + cb + '</tr>';
    }).join('') +
    '</table>';

  document.getElementById('detail').innerHTML = '<h2>All findings</h2><pre>' +
    results.map((r) => r.arm + ' #' + r.index + (r.error ? '  ERROR: ' + r.error :
      '\\n' + (r.report.findings.length ? r.report.findings.map((f) => '   [' + f.code + '] ' + f.target + ' — ' + f.detail).join('\\n') : '   clean'))
    ).join('\\n\\n') + '</pre>';

  window.__abStats = stats;
  window.__abDone = true;
})();
</script>
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const fixture = await loadFixture();
  console.log(`Fixture: "${fixture.screenPlan.name}" (${fixture.screenPlan.type}) from project ${PROJECT_ID}`);

  const promptSizes = {} as Record<ArmName, number>;
  console.log("NOTE: the design-brain prompt layer was removed; both arms are now identical.
");
  const arms: ArmName[] = ["design-brain-on", "design-brain-off"];
  const messagesByArm = {} as Record<ArmName, OpenRouterChatMessage[]>;
  for (const arm of arms) {
    messagesByArm[arm] = buildMessages(fixture, arm);
    promptSizes[arm] = String(messagesByArm[arm][0].content).length;
    console.log(`  ${arm}: system prompt ${promptSizes[arm].toLocaleString()} chars`);
  }
  console.log(`  difference: ${(promptSizes["design-brain-on"] - promptSizes["design-brain-off"]).toLocaleString()} chars\n`);

  const samples: Sample[] = [];
  for (const arm of arms) {
    for (let index = 1; index <= SAMPLES; index += 1) {
      process.stdout.write(`  ${arm} #${index}… `);
      try {
        const raw = await generateOnce(messagesByArm[arm], index);
        const html = cleanScreenHtml(raw);
        samples.push({ arm, index, html, chars: html.length });
        console.log(`${html.length.toLocaleString()} chars`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        samples.push({ arm, index, html: "", chars: 0, error: message });
        console.log(`FAILED — ${message}`);
      }
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const sample of samples) {
    if (sample.html) writeFileSync(resolve(OUT_DIR, `${sample.arm}-${sample.index}.html`), sample.html);
  }
  const reportPath = resolve(OUT_DIR, "report.html");
  writeFileSync(reportPath, buildReport(fixture, samples, promptSizes));
  writeFileSync(resolve(OUT_DIR, "prompt-on.txt"), String(messagesByArm["design-brain-on"][0].content));
  writeFileSync(resolve(OUT_DIR, "prompt-off.txt"), String(messagesByArm["design-brain-off"][0].content));

  console.log(`\nReport: ${reportPath}`);
  console.log("Open it in a browser; it renders every sample at 390x844 and measures in-page.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

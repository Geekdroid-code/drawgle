/**
 * Mutation impact measurement.
 *
 * Phase 1's premise is that the post-generation mutation layer made screens
 * worse. That is testable *without generating anything*: take raw builder
 * output, run it through the old pipeline and the new one, render both at the
 * real mobile viewport, and measure.
 *
 * Because the input HTML is byte-identical in both arms, every difference in
 * the rendered result is attributable to the mutation layer alone. There is no
 * model stochasticity to average out, so n=1 is already meaningful — unlike the
 * generation A/B, which needs several samples per arm.
 *
 * This answers "did removing mutation help?".
 * It does NOT answer "did the prompt changes help?" — that needs generation,
 * via `pnpm run design:ab`.
 *
 * Usage:
 *   pnpm run design:mutation-impact -- --project <uuid> [--dir temp/design-ab]
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeDesignTokens } from "../lib/design-tokens";
import { RENDERED_GEOMETRY_SCRIPT } from "../lib/generation/rendered-geometry";
import { normalizeGeneratedUiContracts } from "../lib/generation/ui-contract-normalizer";
import { buildDrawgleTokenCss, buildGoogleFontAssetLinks, tokenizeStaticDrawgleHtml } from "../lib/token-runtime";
import type { DesignTokens } from "../lib/types";

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const PROJECT_ID = arg("project");
const DIR = resolve(process.cwd(), arg("dir") ?? "temp/design-ab");
const OUT = resolve(DIR, "mutation-impact.html");

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

const loadTokens = async (): Promise<DesignTokens> => {
  if (!PROJECT_ID) throw new Error("Pass --project <uuid> so the real project tokens are used.");
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}&select=design_tokens`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const [project] = await response.json() as Array<{ design_tokens: DesignTokens }>;
  return normalizeDesignTokens(project.design_tokens);
};

/** The pipeline as it behaved before Phase 1: every repair on, then tokenize. */
const oldPipeline = (raw: string, tokens: DesignTokens) => {
  const normalized = normalizeGeneratedUiContracts({ code: raw, designTokens: tokens, repairEnabled: true });
  return {
    code: tokenizeStaticDrawgleHtml(normalized.code, tokens).code,
    repairs: normalized.report.repairs.length,
  };
};

/** The pipeline after Phase 1: inspect, never redesign. */
const newPipeline = (raw: string, tokens: DesignTokens) => {
  const normalized = normalizeGeneratedUiContracts({ code: raw, designTokens: tokens, repairEnabled: false });
  return { code: normalized.code, repairs: normalized.report.repairs.length };
};

const main = async () => {
  const tokens = await loadTokens();
  const files = readdirSync(DIR).filter((file) => file.endsWith(".html") && !file.includes("report") && !file.includes("mutation-impact"));
  if (files.length === 0) throw new Error(`No raw builder HTML in ${DIR}. Run design:ab first to capture some.`);

  const samples = files.map((file) => {
    const raw = readFileSync(resolve(DIR, file), "utf8");
    const before = oldPipeline(raw, tokens);
    const after = newPipeline(raw, tokens);
    console.log(`\n${file}`);
    console.log(`  raw                 ${raw.length} chars`);
    console.log(`  old pipeline        ${before.code.length} chars, ${before.repairs} repairs applied`);
    console.log(`  new pipeline        ${after.code.length} chars, ${after.repairs} repairs applied`);
    console.log(`  new === raw         ${after.code === raw}`);
    return { file, raw, before: before.code, after: after.code, repairs: before.repairs };
  });

  const tokenCss = buildDrawgleTokenCss(tokens);
  const fontLinks = buildGoogleFontAssetLinks(tokens);
  const payload = samples.flatMap((sample) => [
    { id: `${sample.file} · OLD pipeline (${sample.repairs} repairs)`, arm: "old", html: sample.before },
    { id: `${sample.file} · NEW pipeline (untouched)`, arm: "new", html: sample.after },
  ]);

  writeFileSync(OUT, `<!doctype html>
<html><head><meta charset="utf-8"><title>Mutation impact</title>
<script src="https://cdn.tailwindcss.com"></script>${fontLinks}
<style>
 body{font:14px/1.5 -apple-system,"Segoe UI",sans-serif;margin:0;padding:24px;background:#f6f6f4}
 table{border-collapse:collapse;background:#fff;margin:16px 0 28px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 th,td{padding:8px 14px;border-bottom:1px solid #eee;text-align:left;font-variant-numeric:tabular-nums}
 th{background:#fafaf8}
 .win{color:#0a7c2f;font-weight:600}.lose{color:#b4232c;font-weight:600}
 .frames{display:flex;gap:16px;flex-wrap:wrap}
 .frame{background:#fff;padding:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 .frame h3{font-size:12px;margin:0 0 6px;color:#555}
 iframe{width:390px;height:844px;border:1px solid #ddd;background:#fff}
 pre{background:#fff;padding:12px;overflow-x:auto;font-size:12px}
</style></head><body>
<h1>Mutation impact — identical input, two pipelines</h1>
<p>Input HTML is byte-identical in both arms, so every difference below is caused by the mutation layer alone.</p>
<div id="summary">Rendering and measuring…</div>
<div id="detail"></div>
<h2>Rendered frames</h2><div class="frames" id="frames"></div>
<script id="samples" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>
<script>
const TOKEN_CSS=${JSON.stringify(tokenCss)},FONT_LINKS=${JSON.stringify(fontLinks)};
const SAMPLES=JSON.parse(document.getElementById('samples').textContent);
const doc=h=>\`<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"><\\/script>\${FONT_LINKS}<style>\${TOKEN_CSS} html,body{margin:0;padding:0} #root{width:390px;min-height:844px;overflow-x:hidden}</style></head><body><div id="root">\${h}</div></body></html>\`;
const waitStyles=w=>new Promise(done=>{let n=0;const p=()=>{n++;const el=w.document.querySelector('#root div');const ok=el&&w.getComputedStyle(el).display!=='inline';if(ok||n>60)return setTimeout(done,350);setTimeout(p,100)};p()});
(async()=>{
 const out=[],fr=document.getElementById('frames');
 for(const s of SAMPLES){
  const wrap=document.createElement('div');wrap.className='frame';wrap.innerHTML='<h3>'+s.id+'</h3>';
  const f=document.createElement('iframe');wrap.appendChild(f);fr.appendChild(wrap);
  await new Promise(r=>{f.onload=r;f.srcdoc=doc(s.html)});
  await waitStyles(f.contentWindow);
  let rep=null;try{rep=f.contentWindow.eval(${JSON.stringify(RENDERED_GEOMETRY_SCRIPT)})}catch(e){rep={findings:[],error:String(e)}}
  out.push({...s,report:rep});
  wrap.querySelector('h3').textContent+=' — '+(rep.findings?rep.findings.length:'?')+' findings';
 }
 const W={content_overflows_container:3,text_clipped:3,horizontal_overflow:2,empty_visual_region:1,undersized_touch_target:1};
 const arm=a=>out.filter(o=>o.arm===a);
 const mean=xs=>xs.length?xs.reduce((p,c)=>p+c,0)/xs.length:0;
 const stat=a=>({
  overflow:mean(arm(a).map(o=>o.report.findings.filter(f=>f.code==='content_overflows_container').length)),
  clipped:mean(arm(a).map(o=>o.report.findings.filter(f=>f.code==='text_clipped').length)),
  horizontal:mean(arm(a).map(o=>o.report.findings.filter(f=>f.code==='horizontal_overflow').length)),
  weighted:mean(arm(a).map(o=>o.report.findings.reduce((t,f)=>t+(W[f.code]||1),0))),
 });
 const o=stat('old'),n=stat('new');
 const row=(l,a,b)=>{const aw=a<b,eq=Math.abs(a-b)<.01;return '<tr><td>'+l+'</td><td class="'+(eq?'':aw?'win':'lose')+'">'+a.toFixed(2)+'</td><td class="'+(eq?'':aw?'lose':'win')+'">'+b.toFixed(2)+'</td></tr>'};
 document.getElementById('summary').innerHTML='<table><tr><th>Metric (lower is better)</th><th>OLD pipeline</th><th>NEW pipeline</th></tr>'
  +row('Content overflow / screen',o.overflow,n.overflow)+row('Clipped text / screen',o.clipped,n.clipped)
  +row('Horizontal overflow / screen',o.horizontal,n.horizontal)+row('WEIGHTED FAULT SCORE',o.weighted,n.weighted)+'</table>';
 document.getElementById('detail').innerHTML='<h2>All findings</h2><pre>'+out.map(r=>r.id+'\\n'+(r.report.findings.length?r.report.findings.map(f=>'   ['+f.code+'] '+f.target+' — '+f.detail).join('\\n'):'   clean')).join('\\n\\n')+'</pre>';
 window.__done=true;window.__stats={old:o,new:n};
})();
</script></body></html>`);

  console.log(`\nReport: ${OUT}`);
};

main().catch((error) => { console.error(error); process.exit(1); });

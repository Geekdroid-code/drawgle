# Design eval harness

The harness turns a project id into two things you can judge: a **contact sheet** (the reference on the left, then every screen in sort order) and a **check table** of cheap automatic checks on the rendered screens. It exists so that a change to the generation pipeline is judged by looking, before and after, and not only in production.

It is part of `docs/premium-design-quality-plan-2026-09-29.md` (Step 0). The saved baseline is in `docs/design-eval/baseline/`, and the what-if after Step 2 is in `docs/design-eval/after-step-2/`.

## Run it

```bash
pnpm design:eval --project 0ce99a06 --label baseline --case pets-family
```

- `--project` takes a full id or a unique prefix of at least 6 hex characters.
- Output goes to `scripts/design-eval/out/<label>/<case or project>/` (git-ignored): `contact-sheet.png`, `checks.md`, `checks.json`, `bundle.json`, the reference image and one 2x PNG per screen.
- Credentials come only from the process environment, through the app's env helpers (`lib/env/server.ts`); the script is started with `--env-file-if-exists=.env.local`. Nothing reads or prints env files, and the harness only issues `select` queries.
- Rendering uses the same document the canvas and the exports use (`buildStandaloneHtmlExport` with `resolveScreenNavigationCode` and the token CSS), in Playwright at 390×844 @2x. It needs the network for Tailwind's CDN, the icon script and Google Fonts.

Useful options:

| Option | Meaning |
| --- | --- |
| `--set <projects.json>` | Snapshot a whole eval set. The file maps `{ "<case id>": "<project id>" }`; entries that still read `"<...>"` are skipped. |
| `--bundle <dir>` | Replay a saved bundle without the database. |
| `--publish <dir>` | Copy `contact-sheet.png` and `checks.md` there (into `<dir>/<case id>` with `--set`). Commit only these two small files; keep the rest local. |
| `--elevation <class>` | `flat-tone`, `hairline`, `soft-shadow`, `strong-shadow` or `unknown`. Default: the class stored in the reference DNA. |
| `--expect-background <hex>`, `--expect-card <hex>` | Reference colours for the card and page match. Default: measured from the reference image with `lib/generation/reference-palette.ts`, using the screen boxes of the stored analysis. |
| `--retoken` | What-if: render the existing screens under tokens calibrated the way generation now calibrates them (radius cap, flat elevation, measured page and card, the user's named colours respected). Nothing is saved. It shows what changes through the tokens without a model run; see `after-step-2/`. |
| `--radius-class <class>` | `square`, `soft`, `rounded` or `very-rounded`, for `--retoken`. Default: the class stored in the reference DNA. |
| `--reference <file>` | Use this image as the reference. |

## A/B of the screen build's model and thinking level

`pnpm design:ab` rebuilds screens of a saved bundle with one setting changed, and records what each build cost, so the model and the thinking level can be chosen on evidence (Step 9 of the plan). **It makes one live model call per screen on the account whose credentials are in your environment**, so it is yours to run, and without `--yes` it only prints what it would build and roughly what that would cost (about $0.013 a build on Flash, $0.05 on Pro) and calls nothing.

```bash
pnpm design:eval --project 0ce99a06 --label baseline --case pets-family     # once, to save the bundle
pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label flash-low --yes
pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label flash-high --thinking high --yes
pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label pro-low --model <the provider's current Pro id> --yes
pnpm design:ab --report scripts/design-eval/out/ab/flash-low scripts/design-eval/out/ab/flash-high scripts/design-eval/out/ab/pro-low
```

One run is one arm: the model policy reads `DRAWGLE_GEMINI_FULL_BUILD_MODEL` and `DRAWGLE_GEMINI_SCREEN_BUILD_THINKING` when it is first imported, and `--model` and `--thinking` set them for the run. Each run builds the first three parent screens (`--screens "Today,3"` or `--limit` to choose), one after another so each build's time is its own, and writes to `scripts/design-eval/out/ab/<label>/`: `builds.md` and `builds.json` (time, tokens in, out and thinking, code size and cost of every build), and the usual `contact-sheet.png` and `checks.md` of the rebuilt screens, so the arms can be looked at side by side and checked.

- **Cost** is the tokens the provider reports times a price table in `scripts/design-eval/cost.ts` (Flash $0.50 in and $3 out per million tokens, Pro $2 and $12, thinking billed as output: the plan's $0.013 and $0.05 for 9k in and 3k out). Prices change: check the provider's list, or pass `--price "<in>,<out>"`. A model the table does not know gets tokens and no cost.
- **The input** is the stored screen's brief with the project's tokens, reference, family contract, style components and navigation. It leaves out the project memory and the asset manifest. Every arm gets the same input, which is what a comparison needs.
- A failed build is recorded as failed, with no error details, and the run goes on.
- **The Gemini comparison needs a Gemini screen builder.** Where `DRAWGLE_SCREEN_BUILDER_PROVIDER` names OpenRouter (as it does in the founder's environment, with `moonshotai/kimi-k2.5` unless the environment says otherwise), the tool refuses, because a Gemini model and thinking level are not what builds the screens. `--as-configured` builds with the configured route as it is and shows its model in the plan. It is for a **before and after of a change to a prompt** on the same saved project: `pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label new-prompts --as-configured --price "<in>,<out>" --yes`, then look at its contact sheet next to the baseline's. The table has no price for an OpenRouter model, so the plan says so; pass `--price` from the provider's list, or read the cost off the provider's activity page.

## The checks

Each screen gets a row. `!` marks a failing value and `-` means the check does not apply.

| Column | What it counts |
| --- | --- |
| `r>24` | Elements with a corner radius over 24px that are not pills or circles. The founder's rule: up to 24px works best if a default is needed. Navigation is excluded. |
| `shadow` | Cards with a cast box-shadow. Only counted when the reference is flat (`flat-tone` or `hairline`). Inset rings and 1px hairlines are not cast shadows. |
| `card/page ΔE` | ΔE (CIEDE2000) between the dominant card fill and the page. With measured colours it also shows the distance of each to the reference, in brackets (card/page), and fails over 4. |
| `local-nav` | A `<nav>` or a bottom bar of icon controls drawn inside a screen while the project's shared navigation is disabled. |
| `no-nav` | A root screen without the shared navigation when the approved flow describes persistent navigation. |
| `asset ph` | Bitmap placeholders left in the screen (`data-asset-placeholder`). |
| `brief px/hex/%` | Raw px values, hex colours and opacity percentages inside the stored brief (`screens.prompt`). Briefs should describe intent and leave values to the tokens. |

## The eval set

`scripts/design-eval/cases.json` defines six prompt-only projects (this pet family app, personal finance, a fitness coach, recipes, a travel journal, team tasks) and two uploaded style references. The harness does not create projects: it needs the real pipeline, so create them through the local stack (`pnpm dev` plus `npx trigger.dev dev`), record the project ids in a projects file, and snapshot them with `--set`.

After each step of the plan, run the harness on the pet project and at least two other cases and put the contact sheets in the commit message or the PR.

# Design eval harness

The harness turns a project id into two things you can judge: a **contact sheet** (the reference on the left, then every screen in sort order) and a **check table** of cheap automatic checks on the rendered screens. It exists so that a change to the generation pipeline is judged by looking, before and after, and not only in production.

It is part of `docs/premium-design-quality-plan-2026-09-29.md` (Step 0). The saved baseline is in `docs/design-eval/baseline/`.

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
| `--expect-background <hex>`, `--expect-card <hex>` | Measured reference colours. Enables the card and page match. |
| `--reference <file>` | Use this image as the reference. |

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

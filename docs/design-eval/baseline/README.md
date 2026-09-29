# Baseline (2026-09-29, before any change of the premium design plan)

Captured with the harness from Step 0 of `docs/premium-design-quality-plan-2026-09-29.md`, on `main` at `57588c6`.

## Pet family app (`pets-family`, project `0ce99a06`)

```bash
pnpm design:eval --project 0ce99a06 --label baseline --case pets-family \
  --elevation flat-tone --expect-background '#ECE9D6' --expect-card '#F7F5E9' \
  --publish docs/design-eval/baseline/pets-family
```

- Contact sheet: [`pets-family/contact-sheet.png`](pets-family/contact-sheet.png) — the curated reference `mindfulness-meditation-beige-light` on the left, then the five screens in sort order.
- Check table and details: [`pets-family/checks.md`](pets-family/checks.md).
- `--elevation flat-tone` and the two expected colours are the plan's own measurements of this reference (section 2.1). Once Step 2 stores the elevation class and the measured palette in the reference DNA, the harness reads them itself.

| Screen | r>24 | shadow | card/page ΔE (card/page vs reference) | local nav | no nav | asset placeholders | brief px/hex/% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Daily Care Dashboard | 4 | 5 | 3.5 (5.9 / 6.3) | 0 | missing | 3 | 3/1/1 |
| Pet Library | 4 | 0 | 3.5 (5.9 / 6.3) | 1 | missing | 4 | 3/1/0 |
| Pet Detail Profile | 6 | 1 | 3.5 (5.9 / 6.3) | 0 | – | 1 | 3/0/0 |
| Pet Registration Form | 5 | 5 | 3.5 (5.9 / 6.3) | 0 | – | 0 | 2/0/0 |
| Routine & Appointment Editor | 9 | 0 | 3.5 (5.9 / 6.3) | 0 | – | 0 | 1/0/0 |

0 of 5 screens pass every applicable check. This is the founder's verdict in numbers: 32px cards everywhere, cast shadows on a flat reference, white cards and a cream page that sit 6 ΔE away from the reference's own tones, a screen-local tab bar on Pet Library, shared navigation missing from the two root screens although the approved flow describes a persistent bar, bitmap placeholders where the sample pets should be, and raw px, hex and opacity values in every brief.

## The rest of the eval set

The other seven cases in `scripts/design-eval/cases.json` (five more prompt-only projects and two uploaded style references) need projects that only the real pipeline can create, so they are not captured here. Create them with the local stack (`pnpm dev` plus `npx trigger.dev dev`), fill their ids into [`projects.json`](projects.json), and run:

```bash
pnpm design:eval --set docs/design-eval/baseline/projects.json --label baseline \
  --publish docs/design-eval/baseline
```

`--publish` copies each case's contact sheet and check table into `docs/design-eval/baseline/<case id>/`, next to the one above. Commit only `contact-sheet.png` and `checks.md`; everything else stays local.

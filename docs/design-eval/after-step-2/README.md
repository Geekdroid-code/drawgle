# After Step 2: measured colours and calibrated geometry

This is a **what-if**, not a regenerated project. A live model run is not possible without the founder's provider keys, so the pet project's five existing screens were re-rendered under the tokens that generation now produces. The what-if takes the stored tokens and applies `calibrateGeneratedTokens` with the palette measured from the reference pixels:

```bash
pnpm design:eval --project 0ce99a06 --label step2-retoken --case pets-family --retoken \
  --elevation flat-tone --radius-class very-rounded
```

- `--elevation flat-tone` and `--radius-class very-rounded` are the classifications the new reference analysis will report for this reference (its stored analysis predates the two fields). They stand in for that model output.
- The page and card colours are measured from `mindfulness-meditation-beige-light`, and the user's own colour requests are respected exactly as generation respects them.

Compare with [`../baseline/pets-family`](../baseline/pets-family/checks.md):

| Screen | r>24 before → after | card shadows before → after | card/page vs reference before → after |
| --- | --- | --- | --- |
| Daily Care Dashboard | 4 → 0 | 5 → 1 | ΔE 5.9 / 6.3 → 0 / 0 |
| Pet Library | 4 → 0 | 0 → 0 | ΔE 5.9 / 6.3 → 0 / 0 |
| Pet Detail Profile | 6 → 1 | 1 → 1 | ΔE 5.9 / 6.3 → 0 / 0 |
| Pet Registration Form | 5 → 0 | 5 → 0 | ΔE 5.9 / 6.3 → 0 / 0 |
| Routine & Appointment Editor | 9 → 0 | 0 → 0 | ΔE 5.9 / 6.3 → 0 / 0 |

What this step fixes is everything that flows through the tokens: the 32px cards, the blurred surface shadow and the white-on-cream ladder. What remains was written into the screens by the builder from the prose it was given: the `rounded-t-[32px]` detail sheet, a few explicit shadows, the local tab bar on Pet Library, the pills and the placeholders. Steps 3 to 5 remove the sources of those.

The what-if uses the ΔE 12 action snap from the plan. The pet project's generated peach action colour sits ΔE 13.4 from the measured apricot, so it is kept, and the user's named accent (Soft Sage) is respected in any case.

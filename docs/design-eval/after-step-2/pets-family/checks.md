# pets-family · An app for families with multiple pets (0ce99a06) · step2-retoken · what-if: re-tokened

```text
screen                        r>24  shadow  card/page ΔE  local-nav  no-nav    asset ph  brief px/hex/%
----------------------------  ----  ------  ------------  ---------  --------  --------  --------------
Daily Care Dashboard          0     1!      3.5 (0/0)     0          missing!  3!        3/1/1!
Pet Library                   0     0       3.5 (0/0)     1!         missing!  4!        3/1/0!
Pet Detail Profile            1!    1!      3.5 (0/0)     0          -         1!        3/0/0!
Pet Registration Form         0     0       3.5 (0/0)     0          -         0         2/0/0!
Routine & Appointment Editor  0     0       3.5 (0/0)     0          -         0         1/0/0!

0 of 5 screens pass every applicable check.
  Daily Care Dashboard: shadow, no-shared-nav, placeholders, brief-values
  Pet Library: local-nav, no-shared-nav, placeholders, brief-values
  Pet Detail Profile: radius, shadow, placeholders, brief-values
  Pet Registration Form: brief-values
  Routine & Appointment Editor: brief-values
```

## Legend

```text
r>24   elements with a corner radius over 24px that are not pills or circles
shadow  cast box-shadows on cards; only counted when the reference is flat (- otherwise)
card/page  ΔE between the card fill and the page (and to the measured reference when known; ! when over 4)
local-nav  a <nav> or tab bar drawn inside a screen while shared navigation is disabled
no-nav  a root screen without the shared navigation the approved flow describes
asset ph  bitmap placeholders left in the screen
brief px/hex/%  raw px, hex and opacity values inside the stored brief
```

### Daily Care Dashboard

- shadow: button.pointer-events-auto.h-[var(--dg-sizing-standard-button-height)].px-8.flex 204×56 rgba(45, 41, 38, 0.08) 0px 8px 32px 0px
- brief: “Each card uses a 32px radius and”
- brief: “d is separated by 24px macro-spaci”
- brief: “UST PRESERVE: The 32px corner radi”
- brief: “te cards sit on a #F9F6F0 cream base”

### Pet Library

- local navigation: nav.fixed.bottom-0.left-0.w-full (nav element)
- brief: “of 'soft-cards' (32px radius). Ea”
- brief: “lock. Cards use a 16px gutter. A f”
- brief: “g. MUST PRESERVE: 32px corner radi”
- brief: “cream background (#F9F6F0); Staggered”

### Pet Detail Profile

- radius: main.flex-grow.bg-[var(--dg-color-background-primary)].rounded-t-[32px].-mt-8 390×1246 r=32
- shadow: main.flex-grow.bg-[var(--dg-color-background-primary)].rounded-t-[32px].-mt-8 390×1246 rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0
- brief: “are separated by 24px gaps. KEY C”
- brief: “rds with internal 20px padding to”
- brief: “-based bio chips; 32px radius on t”

### Pet Registration Form

- brief: “'soft-cards' with 16px internal pa”
- brief: “r (dashed border, 32px radius); Te”

### Routine & Appointment Editor

- brief: “ored squares with 24px radii. The”

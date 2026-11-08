# Working in this repo

Read `docs/PLAN.md` and `docs/DECISIONS.md` first. Stay inside the current phase; the plan says what's out of scope.

## Rules

- **`src/sim` is deterministic and will run on the server to verify scores.**
  - Use integers only and the generator in `rng.ts`.
  - No `Math.random`, `Date`, or trig in the sim; keep the fixed ticks.
  - Any change that affects scoring bumps `SIM_VERSION` and ships at a week boundary.
  - Run `npm test` before committing.
- **Keep internal business information out of this repo**: finances, management or staffing notes. The repo may be shared.
- **Don't invent venue facts** (menu items, prices, hours, phone numbers, prizes, history, performer bios). Use clearly marked placeholders and ask.
- **Brand and voice** are in `docs/BRAND.md`, including the avoid-list. Use the real logo artwork; never retype the wordmark in a font.
- **Phone-first.**
  - Check portrait and landscape.
  - Touch targets ≥ 44 px; respect safe areas.
  - `CHROME_PATH=… npm run smoke` plays a real touch run, verifies it, and saves screenshots to `test-output/`.
- **Time** is America/Chicago (`src/period.ts`). Competition weeks are [Monday 00:00, next Monday 00:00).
- **Personal data:** collect nothing beyond three-letter initials unless `DECISIONS.md` records a decision to.

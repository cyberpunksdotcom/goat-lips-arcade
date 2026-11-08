# Goat Lips Arcade

Phone-first browser games for **Goat Lips Chew & Brewhouse**, just off Davis Hwy in Pensacola. Planned home: **play.goatlips.com**.

**Now playing (prototype): _Slide 'Em_.** Slide food and drinks down four bars, from the lunch rush to last call.

**Status:** Phase 0 is complete. The game is a playable greybox with placeholder art. There's no leaderboard, sharing or prize yet. See [`docs/PLAN.md`](docs/PLAN.md).

## Quick start

```bash
npm install
npm run dev            # local server, also reachable from your phone on the same Wi-Fi
npm test               # game rules, replay verification, Central-time weeks, difficulty ordering
npm run tune           # difficulty report from automated players
npm run build          # production build → dist/ (what Vercel serves)
npm run build:single   # one self-contained HTML file → dist-single/ (quick phone tests)
CHROME_PATH=/path/to/chrome npm run smoke   # real-browser touch run + replay check; screenshots in test-output/
```

## What's where

| Path | What |
| --- | --- |
| `src/sim/` | Deterministic game rules, shared with the server in Phase 2. Keep it pure. |
| `src/period.ts` | Central-time week and month periods |
| `src/game/` | Rendering, input, sound, screens |
| `src/assets/` | Art. Files marked `.placeholder` are stand-ins cut from the slides. |
| `test/` | Unit tests, bot players, browser smoke test |
| `docs/` | Plan, decisions, brand notes, game design, prize-rules draft, reference slides |

## Deploying (Phase 1)

1. Create a Vercel project from this repo. The framework is detected as Vite; `vercel.json` sets the build.
2. Add the domain `play.goatlips.com` to the project.
3. At whoever manages goatlips.com DNS, add the CNAME record Vercel shows. The main site is untouched.

Note: Vercel's free Hobby plan is for non-commercial personal use, so this project belongs on a Pro team.

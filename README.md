# Goat Lips Arcade

Phone-first browser games for **Goat Lips Chew & Brewhouse**, just off Davis Hwy in Pensacola. Planned home: **play.goatlips.com**.

**Now playing (prototype): _Slide 'Em_.** Slide food and drinks down four bars, from the lunch rush to last call.

**Status:** beta. Real logo and mascot, tap-for-basket / hold-for-beer controls, Head Goat Notes title screen. No leaderboard or prize system yet. See [`docs/PLAN.md`](docs/PLAN.md).

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
| `src/assets/` | Art: logo, goat waiter, Head Goat Notes template |
| `scripts/` | `make-og.mjs` renders the link-preview image to `public/og.jpg` |
| `test/` | Unit tests, bot players, browser smoke test |
| `docs/` | Plan, decisions, brand notes, game design, prize-rules draft, reference slides |

## Deploying (Phase 1)

1. Create a Vercel project from this repo. The framework is detected as Vite; `vercel.json` sets the build.
2. Share the beta from the project's vercel.app address. It's hidden from search engines by a meta tag and the `X-Robots-Tag` header in `vercel.json`.
3. At launch, add `play.goatlips.com` to the project, add the CNAME record Vercel shows at the goatlips.com DNS host, and remove the noindex tag and header.

Note: Vercel's free Hobby plan is for non-commercial personal use, so this project belongs on a Pro team.

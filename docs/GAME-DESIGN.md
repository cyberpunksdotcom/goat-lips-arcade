# Slide 'Em: game design

## The pitch

You're the Goat Lips goat waiter. Patrons walk down four bars toward you, each wanting a sandwich basket or a beer. Tap to toss a basket, hold to pour a beer, and grab the empty mugs they slide back. The shift moves from the lunch rush to last call and keeps getting busier. Three lips (lives).

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Step to a bar | Tap that bar | ← → (or ↑ ↓), 1–4 |
| Toss a sandwich basket | Tap the bar the goat is already at | Tap Space |
| Pour a beer | Hold any bar (about 0.4 s fills a mug, which slides when full; keep holding for more) | Hold Space |
| Pause | Pause button, or switch apps | P / Esc |

Each lane is a full-height (or full-width) tap target. The game works in portrait and landscape and respects the notch and home bar.

## Rules

- **Orders:** each patron's bubble shows what they want: a red ring is a sandwich basket (tap), a gold ring is a beer (hold).
- **Serve:** an order sliding down a bar reaches the first patron in line.
  - The right order scores 100 (basket) or 150 (beer) × your streak multiplier.
  - The wrong order is sent back: no points and the streak resets, but no lip is lost. The patron keeps coming.
  - The multiplier goes up by one every 8 serves in a row, to a maximum of ×5.
- **Food stays, drinks come back:** after a short drink, a patron slides the empty mug back. Food baskets never come back.
- **Grab empties:** a returning mug teeters at your end for about 1¼ seconds. Step into that bar to grab it for +50.
- **You lose a lip when:**
  - a patron reaches you unserved ("Somebody waited too long."),
  - an order slides out the door with nobody to catch it ("Slid it to nobody."), or
  - an empty falls off the end ("Dropped an empty.").
- **After a lost lip:** the room clears, there's a short breather, then play resumes. The streak resets.
- **Game over:** at zero lips, or at "closing time" after 15 minutes of play.

## Phases and difficulty

| Phase | Starts at | Feel |
| --- | --- | --- |
| Lunch Rush | 0:00 | Mostly food (fewer empties), slow walkers |
| Afternoon Jazz | 0:40 | More drinks, amber light |
| Open Mic | 1:20 | Busier |
| Band Night | 2:00 | Stage lighting, quick walkers |
| Last Call | 2:40 | It only gets busier |

Arrivals and walking speed ramp smoothly over the first four minutes. After that they keep creeping up until even a perfect player is overwhelmed. Arrivals eventually outpace how fast anyone can pour, so every shift ends.

## Tuning

All the numbers are in `src/sim/constants.ts`. Run `npm run tune` for a difficulty report from automated players:

| Player (bot) | Median survival (Nov 8 tuning) |
| --- | --- |
| Idle (does nothing) | ~30 s |
| Distracted (slow, 15% mistakes) | ~1½ min |
| Casual (steady, 8% mistakes) | ~3 min |
| Sharp (fast, 3% mistakes) | ~4 min |

The bots read every lane at once, which people can't, so real players will land well below these numbers. **Retune after watching real people play.** Expect typical first games to last 1–2½ minutes.

## Determinism and fair play

- `src/sim` must give identical results in every browser and on the server:
  - integers only
  - the seeded random generator in `rng.ts`
  - no `Math.random`, `Date`, or `Math.sin` and the like
  - a fixed 60 ticks per second
- **A run is recorded as** `{ v, period, inputs: [tick, code, …], endTick, score }`. Re-playing it must produce the same score (`verifyRun`). The browser smoke test checks this with a real touch-driven run in Chrome.
- **Any change that affects scoring bumps `SIM_VERSION`** and should ship only at a week boundary, so one week's scores are never compared across rule changes.
- **The week seed** comes from the period id (`2026-11-09` = the week starting Monday, Nov 9).

## Input codes (replay format)

| Code | Meaning |
| --- | --- |
| 0–3 | Press on lane n. If the goat is elsewhere it steps there; if it's already there, this starts a tap or a hold |
| 4–7 | Step to lane n (keyboard) |
| 8 | Release. Within 12 ticks of a press where the goat already stood, this tosses a basket |
| 9 | Press where the goat stands (Space) |

`SIM_VERSION` is 2 since these controls (Nov 8, 2026).

## Ideas parked for later

- Tips left on the bar
- Bonus patrons (a band member who orders a round)
- Daily practice shifts
- Original music from a house musician

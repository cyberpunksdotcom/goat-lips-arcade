# Goat Lips Arcade: plan

_Last updated Nov 8, 2026. Owner: Brad Barnes. Status: Phase 1 underway. A beta with real art and tap/hold controls is ready to share from a vercel.app address._

## What we're building

A free, phone-first web game at **play.goatlips.com**. It's hosted on Vercel; goatlips.com stays where it is.

The first game is **Slide 'Em** (working title). The Goat Lips goat waiter slides food and drinks down four bars from the lunch rush to last call. The best score each week wins a small prize, **GOAT of the Week**, which is claimed in person at the bar.

## Why it's worth doing

| Goal | How the game serves it |
| --- | --- |
| Reach people who don't already follow Goat Lips | Every game ends with a share card sized for Stories and feeds |
| Get people in the door | The prize is claimed at the bar, not mailed |
| Give guests something to do at the table | QR table tents: "Think you're this week's GOAT?" |
| Steady social content without design work | The game makes the Monday "GOAT of the Week" winner graphic |

**What we'll measure (starting in Phase 1):**

- Games played per week
- Shares
- QR scans (tagged links)
- Prize claims

Review after about 8 live weeks.

## Guardrails (don't overdo it)

**In scope:**

- One game
- Share cards
- A weekly leaderboard and prize
- A small staff page for winners

**Not now:**

- Accounts and logins
- Collecting emails or phone numbers
- Payments or online ordering
- Menu and schedule data
- Push notifications
- A native app
- More than one game at a time

## Phases

### Phase 0: Foundation ✅ (Nov 8, 2026)

- Private repo, this plan, brand notes, decision log and a prize-rules draft.
- Deterministic game core. Everyone plays the same shift each week, and a recorded run re-plays to the exact same score.
- Tests, including the Central-time week boundary across daylight saving.
- A playable greybox. The art is placeholder, cut from the presentation slides.

### Phase 1: Playable and shareable (no backend yet)

Goal: staff and a handful of regulars play it on their own phones and want to share it.

1. Playtest on real phones (iPhone Safari and Android Chrome, portrait and landscape). Tune difficulty from what people actually do.
2. Art pass with the real mascot and logo files. Draw patron goats in the same hand-drawn style. Add sound.
3. Build the share card: a 1080×1350 image with the score, the week, the goat, play.goatlips.com and "Just off Davis Hwy". It goes to the phone's share sheet and falls back to a download. Add a static link-preview image.
4. Deploy on Vercel as a shareable beta on the vercel.app address, hidden from search engines. Point play.goatlips.com at it only at launch (one DNS record).
5. Add a short privacy note and simple analytics.

**Exit:** five people outside the project play on their own phones without help, nothing is broken, and Brad signs off on the art and copy.

### Phase 2: GOAT of the Week

Goal: a fair weekly competition that staff can run in five minutes a week.

1. Set up a database (Postgres from Neon through the Vercel Marketplace; the free tier is enough).
2. Score submission: the server re-plays the recorded run with the same game code and only records the score it computes. Add rate limits and one submission per run.
3. Leaderboard ("The GOAT Board") showing the top 10 this week and last week's winner. Players enter three-letter arcade initials only.
4. Private claim code for the player, saved on their phone. A staff page behind a passcode checks a code, marks the prize redeemed and can hide offensive initials.
5. Winner graphic for the Monday post, built from the share-card template.
6. Official rules page, once the draft in `PRIZE-RULES-DRAFT.md` is approved.

**Exit:** one internal test week (staff only) runs end to end, including a real claim at the bar. After that, the public launch with table tents and a post.

### Phase 3: Only if Phase 2 earns it

Pick from these when there's a reason to:

- Leaderboard view for the venue TVs
- Challenge links ("beat my 48,210")
- Link previews that show the score
- A replay viewer so staff can watch a winning run
- A "tonight at Goat Lips" line on the game-over screen
- A monthly champion
- The next game (Brew Tosser)

## How it works

```
Phone browser ─► play.goatlips.com (Vercel, static files)
   Slide 'Em: TypeScript + Canvas, ~10 KB of code gzipped
   records every tap with its tick number
        │ Phase 2
        ▼
   POST /api/runs ─► re-plays the run with the same src/sim code ─► Postgres (Neon)
   GET  /api/board ◄─────────────────────────────────────────────────┘
   /staff (passcode) ─► check claim codes, mark redeemed, hide entries
```

- **Deterministic simulation (`src/sim`)**: integer math, a seeded random generator and a fixed 60 ticks per second. The same code runs on the phone and on the server, so a score can't be typed in. It has to be played. The replay test proves a real browser run reproduces exactly.
- **One shift per week**: the week id picks the seed, so everyone faces the same rush that week. Scores are comparable and practice pays off.
- **Venue time**: a week runs from Monday 12:00 AM up to the next Monday 12:00 AM, Central time, including daylight saving. That leaves no "11:59 PM" gap. Monthly periods are supported if we switch.
- **Small and boring on purpose**: no game engine and no front-end framework. The whole first load is about 150 KB, which matters on venue Wi-Fi.

## Hosting and costs

- **play.goatlips.com**: add one CNAME record wherever goatlips.com's DNS is managed. Vercel shows the exact value when the domain is added. The main site isn't touched.
- **Vercel**: Brad's paid team (Meridian Studioworks). The free Hobby plan wouldn't allow a commercial project; a paid plan does.
- **Database**: Neon's free plan, billed through Vercel if it's ever upgraded.
- **GitHub**: private repo, free.
- **Expected total**: $0–20/month.

## Data and privacy

- **What we keep:** three-letter initials, the score, the run's recorded taps, timestamps, and a salted hash of the network address for rate limiting.
- **What we don't collect:** names, email, phone numbers or accounts.
- **Claim codes** are stored hashed.
- **Retention:** run recordings are deleted after 90 days, except winning runs.
- **Kid-friendly:** we collect no personal information and offer no alcohol prizes.

## Score integrity (proportionate to a burger)

These measures keep casual cheating out without pretending to be bank security:

- Replay verification
- Rate limits
- Staff can review a winning run before handing over a prize
- The rules let management disqualify a score

## Risks and how we handle them

| Risk | Mitigation |
| --- | --- |
| Cheating | Replay verification, rate limits, staff discretion written into the rules |
| Offensive initials | Blocklist plus a staff "hide" button |
| Staff workload | A claim takes about a minute; the winner graphic makes itself |
| Weak Wi-Fi, slow phones | Tiny download, fixed-tick game loop, submissions retry |
| iPhone quirks (audio, notch, home bar) | Sound starts on tap and is off by default; safe-area insets; test on devices |
| Cartoon goat + beer + kids | Patrons order food and drinks, prizes are non-alcoholic, and the copy never pushes drinking |
| Who owns the accounts | Repo is under cyberpunksdotcom, hosting under Meridian Studioworks. Decide whether Goat Lips should own them; transfers are easy |

Open questions live in [`DECISIONS.md`](DECISIONS.md).

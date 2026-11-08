# Decisions

_Defaults chosen Nov 8, 2026 so work can move. Any of them can change; note the change and the date here._

## Decided (by default)

| # | Decision | Why |
| --- | --- | --- |
| D1 | First game is **Slide 'Em**, a Tapper-style bar game with an original name, art, sounds and rules | It uses the goat waiter, beer and food, and it's a natural one-thumb game. Tapper was the remembered inspiration; we copy none of its assets. |
| D2 | Home is **play.goatlips.com** on Vercel; goatlips.com stays as-is | Short enough for a QR code and has room for future games |
| D3 | Stack: Vite + TypeScript + Canvas, Vercel Functions, Neon Postgres | Small, cheap, easy for Brad and AI tools to maintain; no game engine |
| D4 | Competition week = **[Mon 00:00, next Mon 00:00) Central time** | No "11:59 PM" gaps or overlaps; daylight saving is handled |
| D5 | Everyone plays **the same shift each week** (week-seeded) | Fair comparisons, and practice pays off |
| D6 | Scores are **verified by re-playing the run** on the server | A score can't be typed in |
| D7 | **Initials only** (three letters); no email or phone | Little to protect, kid-safe, arcade-authentic |
| D8 | Prize is **claimed in person** with a private code saved on the player's phone | Drives a visit; no contact info needed |
| D9 | Free play and share cards ship **before** the prize system | The fun is proven before the operations are built |
| D10 | Repo is private under **cyberpunksdotcom**; internal notes (finances, management) never go in the repo | The repo may be shared with collaborators later |
| D11 | Placeholder art is cut from the presentation slides until the original files arrive | Unblocks the prototype |

## Open: needs Brad or the venue

| # | Question | Recommendation |
| --- | --- | --- |
| Q1 | What's the prize? Weekly, monthly, or both? | Weekly, small, **non-alcoholic** (a food basket, a dessert, or merch). Add a monthly champion later if it catches on. |
| Q2 | Who can win? Staff and their families? Repeat winners? | No staff or immediate family. Max one prize per person per calendar month; if the top scorer already won that month, the next score down wins. |
| Q3 | How are ties broken? | The earlier submission wins. |
| Q4 | Claim window, and who can mark a prize redeemed? | 14 days after the week ends. Any manager or bartender with the staff passcode. |
| Q5 | Who approves the official rules? | Owner or GM sign-off before public launch. |
| Q6 | Is the Meridian Studioworks Vercel team on **Pro**? | Required for a commercial project ($20/month per member). |
| Q7 | Who manages goatlips.com DNS? | Needed to add the play.goatlips.com record. |
| Q8 | Can we get the original mascot and logo files? | "Right-Facing Goat Waiter Mascot.png" plus a transparent logo (PNG or SVG). |
| Q9 | Final game name | "Slide 'Em" is a working title. Alternatives: "Order Up!", "Goat Rush", "Lunch to Last Call". |
| Q10 | Should Goat Lips own the repo and hosting long-term? | Fine to start under Brad's accounts; transfer later if the venue wants it. |
| Q11 | Should the "wasted order" rule be softer during the first 40 seconds? | Decide after watching first-time players. |

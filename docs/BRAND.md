# Brand notes for the arcade

Built from the Goat Lips presentation lookbook and slides (`docs/reference/`). Where the lookbook doesn't say something, the choices below are implementation choices and are marked as such.

## Name

- **Goat Lips** in short. **Goat Lips Chew & Brewhouse** in full.
- Location line: **Just off Davis Hwy, Pensacola**.
- Never retype the wordmark in a font. Always use the logo artwork.

## Palette (labeled in the lookbook)

| Name | Hex | Use in the game |
| --- | --- | --- |
| Goat Red | `#D11B1B` | Primary buttons, lips (lives), brush underline |
| Beer Gold | `#F4B223` | Score, mugs, pour meter, highlights |
| Amber | `#C67A11` | Brass rail, warm lighting |
| Cream | `#F5EDD9` | Parchment cards, foam, light text on dark |
| Charcoal | `#2E2E2E` | Outlines, chalkboard |

The November schedule screens use a cream / teal / navy / red look. That stays with schedule graphics. The arcade follows the lookbook palette.

## Textures and motifs

- **Textures:** dark weathered wood (the bars and the floor), cream parchment with torn edges (menus and cards), black chalkboard (banners, and later the GOAT Board).
- **Motifs:** a hand-brushed headline with a red stroke over a gold stroke underneath, chalk side notes, an amber pendant lamp, string lights, hearts.
- **Icons:** beer mug, fork and knife, music note, heart.
- Keep it rustic and a little scrappy, like the real room. No glossy nightclub, no oversized concert stage.

## Type (implementation choices)

- **Headlines and score:** Permanent Marker, self-hosted, free license. It's close to the slide headlines.
- **Everything else:** the phone's system font, so it stays readable at small sizes and costs nothing to load.

## Head Goat Notes

- The in-house notice format: a cream card on black, the "Head Goat Notes:" heading, the message, and a sign-off from **Larry Cowan** with his painted portrait. (The handoff spelled it "Coan"; the artwork says Cowan.)
- `src/assets/head-goat-notes.webp` is the original artwork with the holiday message cleared. The game sets its own text over it in Arvo, a free slab serif close to the original.
- Anything signed with Larry's name should get his OK.
- **Uses:** shift instructions on the title screen now; the weekly winner announcement later.

## The mascot

- **Hero:** the gray goat waiter with a red collar, gold bell, a mug in one hand and a burger tray overhead. There's also a sunglasses variant.
- **Patrons:** simple goat faces for now. The Phase 1 art pass draws them in the same hand-drawn style.
- **In the game:** `src/assets/goat-waiter.webp`, cut from Brad's logo + mascot image (no sunglasses). The logo is `logo-stacked.webp`, used as supplied.

## Voice for game copy

**Warm, dry, specific, and readable by someone who has never been in.** Examples in use:

- Game over: "Out of lips!" / "The rush won this round."
- Losing a lip: "Slid it to nobody." / "Somebody waited too long."
- "Three lips. Don't lose 'em."

**Avoid:** "settle in", "lean in", "today leans", "the weekend starts tonight", "kind of band", "backyard bar", "booze", and generic "good food / good vibes / great music" taglines.

**Names that carry the brand:**

| Name | What it is |
| --- | --- |
| The GOAT Board | Leaderboard |
| GOAT of the Week | Weekly winner (GOAT = greatest of all time) |
| Lips | Lives |
| Lunch Rush → Afternoon Jazz → Open Mic → Band Night → Last Call | The phases, like the room's real day |

**Social posts:** use #goatlips 🐐💋 plus 3–5 relevant tags, e.g. #pensacolaevents #pensacola.

## Notes from the slides

- The slides rotate about eight taglines ("Good beer. Good people. Great times.", "It just tastes better here.", "Same great vibe, different audience.", and more). Several follow the "good X, good Y, great Z" pattern that was cut before as generic. **The game doesn't use them.** Worth picking one or two official lines for future work.
- **Typo:** the story/image slide's side note reads "REAT PEOPLE".
- **Placeholders:** the "By the Numbers" figures (12K+, 30+, 5★) are unverified and never appear in the game.

## Assets still needed

1. Optional: a layered or vector original of the goat waiter, plus any other poses.
2. Optional: photos of the real bar and deck, to guide background art.
3. Optional: a recording from a house musician (with permission) for game music.

# /brag plan: OCCUIN

**What it is:** OCCUIN is a leather goods shop where you design your own bag in live 3D. You pick the shape, leather, stitching and initials, see the price as you go, and it's handmade to order in Pakistan.

**Who it's for:** People who want a leather bag that's theirs, not off the rack.

**What sets it apart:** It has a real 3D customiser with a live price, not a "contact us for custom orders" form.

**Hook:** One bag swaps its leather on every beat (noir, cognac, bordeaux, navy, tan), then swaps its whole shape. These are the store's own photoreal renders from `public/images/hero/`.

**Tone:** `polished` but alive. It's a luxury brand, so the style is restrained, with Bodoni type, the site's deep-green gradient and cream text. The motion stays crisp and on the beat.

**Visual identity (from the code):**
- Background: radial `#3f6155 → #20403a → #0c1c18` (the hero gradient)
- Text: cream `#f4efe6`; ink `#14231f`
- Fonts: Bodoni Moda for display and italic, Geist for UI copy
- Logo: `public/logo-cream.svg`

**Copy used (all from the project):** "Make it yours.", "Change its size, leather, stitching and hardware in 3D", "The price updates as you go.", "Cut, stitched and finished by hand in Pakistan", "made to order for you in 25 to 30 days", "Handmade leather bags, made to order", occuin.com (the `SITE_URL` in the code).

**Real UI shown:** The `/studio` customiser on Selle 22, run on a local build with the seed data. Croc-embossed calf takes the price from $220 to $235. Bordeaux recolours the bag. Medium takes it to $315. Script initials "OC". These are the store's seed prices, and no personal data is shown.

## Music
96 BPM, so one beat is 0.625s and one bar is 2.5s. It's 8 bars, 20.0s in total, and every cut lands on a bar line. The track is warm and minimal: soft kick, felt-piano chords in D major (D, Bm, G, A), a round bass, and shaker 16ths. Sound effects are pitched to the key: soft clicks for the UI taps, a low swell into the logo.

## Storyboard

| # | Time | Bars | Scene |
|---|---|---|---|
| 1 | 0.0–5.0 | 1–2 | **Hook.** The Selle 22 render on a glass plinth glow changes leather on each beat (noir → cognac → bordeaux → navy). On bar 2 it changes shape on each beat (tote → top handle → weekender → saddle). "Make it *yours.*" lands at 0.3s and holds. A small caption changes with each swap ("SELLE 22 · COGNAC"). |
| 2 | 5.0–12.5 | 3–5 | **Show the thing.** The real studio in a floating window on green. The headline is "Change its size, leather, stitching and hardware in 3D." A cursor clicks Croc-embossed and the price goes $220 → $235. It clicks Bordeaux and the bag recolours. At bar 5 the headline changes to "The price updates as you go." The cursor clicks Medium ($315), then Script initials. The camera pushes towards the bag and the price. |
| 3 | 12.5–17.5 | 6–7 | **Craft.** The full-frame macro leather grain from the hero, with a slow light sweep. "Cut, stitched and finished by hand in Pakistan." Then "Made to order for you in 25 to 30 days." |
| 4 | 17.5–20.0 | 8 | **Outro.** The logo mark and OCCUIN wordmark, "Make it yours.", a "Design yours" pill, and occuin.com. |

**Punchline:** You don't pick a bag here. You make one.

**Share caption:** see `share-copy.txt`.

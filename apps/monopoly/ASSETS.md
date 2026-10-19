# Pocket Borough assets

## Arcade redesign

- `public/assets/borough-atlas.png`: original transparent 4 × 4 sprite atlas generated using the built-in `image_gen` tool on 2026-10-19. Contains 12 property buildings plus a bank, mystery gift, tax office, and amusement park.
- The original generated PNG is preserved in the project. `src/art.ts` maps board spaces to atlas cells; CSS displays them on board tiles, portfolio cards, property details, and the central skyline.
- Palette: saturated violet, orange, gold, cyan, and pink. UI, tokens, dice, animated coins, line icons, and favicon are original CSS/SVG.
- Typefaces: operating system Arial/Helvetica; no remote fonts.
- Sound: sine wave tones synthesized by Web Audio; no recordings.
- All assets load locally; no external runtime image services or third-party art packs.

## Final generation prompt

```text
Use case: stylized-concept.
Asset type: one production-ready 4 by 4 game sprite atlas, square canvas, transparent background.
Create a perfectly aligned 4-column by 4-row grid containing EXACTLY 16 separate chunky 3D isometric toy buildings / objects for a vibrant competitive property trading board game. Each item occupies one identical square cell, centered in that cell, fully contained with 12% transparent padding on all edges, equal visual weight. No objects may cross a cell boundary. No labels, words, numbers, logos, grid lines, or backdrop.
Style: premium playful arcade board game, glossy clay/plastic miniature dioramas, crisp readable silhouettes, exaggerated architectural shapes, bold saturated colors, rich directional light, small soft contact shadows. Electric violet, vivid orange, hot pink, cobalt blue, golden yellow. NOT muted, pastel, green or cozy watercolor.
Exact cell order left to right, top to bottom:
Row 1: orange townhouse with red roof; orange bakery with giant croissant sign; purple art studio with giant paintbrush sign; violet cinema with star marquee.
Row 2: bright yellow apartment building with rooftop terrace; golden villa with palm tree; cyan waterfront hotel with pool; cobalt marina tower with tiny yacht.
Row 3: red market building with striped awning; orange shopping mall with shopping bag sign; hot pink luxury hotel with crown on roof; magenta skyscraper with gold spire.
Row 4: golden bank with vault and coins (start space); violet mystery gift box with floating gold question mark (event space); orange tax office with coin stack and receipt (tax space); blue and pink amusement park with miniature ferris wheel (bonus space).
Camera: consistent three-quarter isometric front view. All 16 subjects large, visually distinct, isolated on genuine transparent alpha. 2048 square preferred. Entire image is a reusable sprite atlas, not a screenshot or game UI.
```

# Pocket Borough

Big deals. Bigger rivals. An original, Monopoly inspired property trading game for one player and two computer rivals, with vivid arcade colors, illustrated 3D buildings on every board space, and short, finite matches.

## Play locally

From the `games/` repository root:

```sh
npm install
npm run dev --workspace=pocket-borough
```

Open **http://127.0.0.1:5175/**. The game runs entirely in the browser. No account, server, or API key is required. It saves automatically in this browser using local storage. Completed matches appear in the local leaderboard, split into separate 12 and 20 round boards and sorted by final net worth; tied wins are shown separately. Reloading resumes the current turn, including computer turns.

## How to play

- Start with $1,200 against Cleo and Otto. Choose 12 or 20 rounds.
- Click **Roll the dice**, or press Space when no button or dialog is focused.
- Buy unowned properties when you land on them. Pay rent when landing on a rival's property.
- Own both properties in a color pair to double rent and unlock three upgrade levels. Tap a space or portfolio card to inspect it.
- Upgrade on your turn for half the original property price. Rent is `base rent × color set multiplier × (1 + upgrade level)`.
- Tap a rival's property to buy it at their asking price. Completed sets command a premium.
- Sell a property to the city for 75% of its original price plus upgrade costs. A sale removes all upgrades.
- Each lap pays $200. City Post events can earn or cost money; taxes cost $80; community bonuses pay $80.
- If a bill exceeds cash, the cheapest assets are sold automatically. A player who still cannot pay is bankrupt.
- Highest cash + full property and upgrade value wins after the final round. The match also ends if the human player is bankrupt or only one player remains. Equal wealth can share the win.

These are streamlined original rules: no jail, auctions, mortgages, extra turns on doubles, or online multiplayer. Sound can be enabled on desktop. Layout adapts to touch screens; phone hardware testing remains outstanding.

## Validate and build

```sh
npm run test --workspace=pocket-borough
npm run build --workspace=pocket-borough
npm run preview --workspace=pocket-borough
```

Tests cover property purchases, color sets, upgrades, trades, sales, bankruptcy, save validation, and 100 seeded complete matches. Production output is **`apps/monopoly/dist/`**; preview runs at **http://127.0.0.1:4175/**.

## AI Made Games publishing

The build is a static web game with relative asset paths, suitable for a hosted subdirectory or iframe. All assets and game code are included; no external fonts, artwork, or runtime services are loaded.

Publish this game's **`dist/` contents**, including `index.html`, `favicon.svg`, and `assets/`. The repository root's default build still targets Cloud Garden. For AI Made Games' GitHub source build route, use a dedicated repository with this game's package/config/source at its root and a generated `package-lock.json`, or prepare a repository containing this prebuilt static output. Do not submit this monorepo with its current default build expecting Pocket Borough.

[AI Made Games](https://www.ai-made.games/) currently documents static web support, root `package.json` + lockfile + build script for source builds, and output under `dist`. No publication has been performed.

See [ASSETS.md](ASSETS.md) for artwork and audio provenance.

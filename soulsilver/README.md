# Pokémon SoulSilver — Phone Recreation

A from-scratch, phone-first recreation of the **gameplay** of *Pokémon
HeartGold & SoulSilver* (Johto, Generation IV). Built as a single self-contained
HTML5 canvas game — no build step, no dependencies, no assets to download. Open
it on a phone browser and play with the on-screen D-pad + A/B buttons.

> This is a fan re-implementation of the *game mechanics* for learning/portfolio
> purposes. It ships **no** Nintendo/Game Freak assets — sprites are simple
> shapes and emoji stand-ins. Pokémon and the games are © Nintendo / Game Freak.

## Play

Open **`index.html`** in any modern browser (works great over `file://`, or host
the `soulsilver/` folder on any static server / GitHub Pages).

- **Move:** on-screen D-pad, or Arrow keys / WASD
- **Confirm / interact / advance text:** **A** button, or `Z` / `Enter` / `Space`
- **Back / open menu:** **B** button, or `X` / `Backspace`; **MENU** button opens
  the field menu (Pokémon, Bag, Save, Close)

## What's implemented

The early game, faithfully reproduced:

1. **New Bark Town** — your house and Prof. Elm's Lab.
2. **Elm's Lab** — choose your starter: **Chikorita 🌿 / Cyndaquil 🔥 / Totodile 🐊**.
3. **Route 29** — tall-grass random encounters (Pidgey, Rattata, Sentret,
   Hoothoot, Caterpie, Weedle) at their real levels.
4. **Cherrygrove City** — a Pokémon Center counter that fully heals your team.

Battle & progression systems (all Generation-IV accurate — see *Sources*):

- Turn-based **FIGHT / BAG / POKÉMON / RUN** loop with move selection and PP.
- **Gen-IV damage formula** with STAB, the full **17-type** type chart,
  critical hits, and the 0.85–1.00 random spread.
- **Physical/Special split**, stat stages (Growl, Leer, Tail Whip, …) and simple
  status (burn/poison chip damage).
- **Catching** via the Gen-III/IV capture algorithm with 1–4 shake checks.
- **EXP & leveling** with per-species growth rates, stat recalculation, and
  learning moves at the right levels. Party of up to 6 + PC Box overflow.
- **Save/Load** to `localStorage`; white-out returns you to New Bark Town.

## Architecture (and the road to 3-D)

The game is deliberately split so the **model** (grid world, Pokémon, battle
state) is completely independent of the **renderer**. To move to 3-D later you
replace one file — `render.js` — with a WebGL/Three.js renderer that consumes the
same model. Nothing in the game logic assumes a 2-D screen beyond calling those
draw helpers.

| File | Responsibility |
|------|----------------|
| `js/data.js`    | Pure data: Pokédex, moves, type chart, tile **maps** & encounter tables |
| `js/pokemon.js` | The model: stats, damage, catch, EXP/level-up maths (no rendering) |
| `js/render.js`  | **The only file that touches the 2-D canvas** — swap this for 3-D |
| `js/world.js`   | Overworld scene: grid movement, collision, warps, encounters |
| `js/battle.js`  | Battle scene: the turn engine + battle UI |
| `js/main.js`    | Controller: input, scene dispatch, dialog/menus, save/load, loop |

The world is a **tile grid** with entities carrying `(x, y)` tile coordinates and
a pixel offset for smooth stepping — exactly the structure a 3-D tile renderer
wants (each tile becomes a cell/height in a mesh; entities become models).

### Adding content

- **A new Pokémon:** add an entry to `SS.DEX` (base stats, types, catch rate,
  learnset) in `data.js`, plus any new moves to `SS.MOVES`.
- **A new area:** add a map to `SS.MAPS` (a grid of tile chars + `warps`), and an
  `SS.ENCOUNTERS` table if it has tall grass. Tile legend is documented at the
  top of the maps section in `data.js`.

## Tests / tools

Run from the `soulsilver/` folder:

```bash
node tools/validate.js   # prints every map with rulers; flags bad warps/entries
node tools/test.js       # headless logic tests: type chart, damage, catch, EXP, a scripted battle
node tools/playtest.js   # drives the real game in headless Chromium, screenshots each scene
                         #   (set CHROME=/path/to/chrome and PW=/path/to/playwright-core)
```

## Sources consulted

- Bulbapedia — [Damage](https://bulbapedia.bulbagarden.net/wiki/Damage) (Gen-IV
  formula), type chart, base stats & catch rates
- Smogon — [The Complete Damage Formula for Diamond & Pearl](https://www.smogon.com/dp/articles/damage_formula)
- StrategyWiki — [HeartGold & SoulSilver Walkthrough](https://strategywiki.org/wiki/Pok%C3%A9mon_HeartGold_and_SoulSilver/Walkthrough)
  (New Bark Town → Route 29 → Cherrygrove, wild encounter lists)
- Serebii — [Damage Calculation](https://www.serebii.net/games/damage.shtml)

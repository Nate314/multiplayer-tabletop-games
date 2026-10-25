# Server SVG and Sound Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every game piece and icon that is not a clickable board, and every sound, is generated and served by the server, browsable at hidden `/dev/svgs` and `/dev/sounds` pages.

**Architecture:** A server asset registry (`server/assets/`) maps names to SVG string generators and sound data; Express routes serve them with immutable caching. Generators live next to the data they draw from: platform pieces in `shared/svg/`, game pieces in `games/<id>/svg.ts` (non-client, so the server may import them). The client shows them through one `<ServerSvg>` component that fetches markup once per URL and inlines it, so page CSS variables, theme and color-blind symbols still apply.

**Tech Stack:** Express 5, string-built SVG (Node runs server TS without JSX), React 19 client.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 1). Read the index plan `2026-10-25-assets-rules-loading-polish.md` for Global Constraints, ports (PORT 3101, E2E_PORT_BASE 6110) and delivery.

## Review Focus (this changeset)

- A piece shown before its SVG has loaded: it renders a box of its final size (no layout jump) and fills in; a game's pieces are preloaded when its screen mounts (Task 3, Task 7).
- A failed SVG fetch shows the piece's accessible text fallback, never a crash (Task 3).
- Per-game recolors (`--dice-*`, `--playing-card-*`, `--piece-tray-*`, Azul and Catan theme variables) and dark mode still change the redrawn pieces (Task 7, Task 8, browser check).
- Click, drag (`data-drag`), animation (`data-anim-key`) and e2e selectors still find the piece (Task 7, Task 8, full e2e).
- Unknown asset name or bad parameter returns 404 or 400, never 500 (Task 1).

---

### Task 1: SVG helper, asset registry and routes

**Files:**
- Create: `shared/svg/svg.ts` (helper), `server/assets/registry.ts`, `server/assets/routes.ts`
- Modify: `server/server.ts` (mount routes before `serveClient`)
- Test: `server/assets/routes.test.ts`, `shared/svg/svg.test.ts`

**Interfaces:**
- Produces:
  - `el(tag: string, attrs: Record<string, string | number | undefined>, ...children: string[]): string` and `escapeText(text: string): string` in `shared/svg/svg.ts`; attribute values and text are escaped; `undefined` attributes are omitted.
  - `type SvgAsset = { name: string; params: string[]; samples: string[][]; render: (params: string[]) => string | null }` in `server/assets/registry.ts`. `params` are parameter names for the gallery; `render` returns a full `<svg ...>` document or `null` for invalid parameters.
  - `SVG_ASSETS: SvgAsset[]` and `findSvg(name: string): SvgAsset | undefined`.
  - Routes in `mountAssetRoutes(app: Express, assets?: SvgAsset[]): void`: `GET /api/svg` (JSON listing `{ name, params, samples }[]`), `GET /api/svg/:name` and `GET /api/svg/:name/*params` (`image/svg+xml`, `Cache-Control: public, max-age=31536000, immutable`), 404 unknown name, 400 when `render` returns null.

- [ ] **Step 1: Write failing tests**: `el('rect', { x: 1, fill: 'a"b' })` equals `<rect x="1" fill="a&quot;b"/>`; `escapeText('<b>&')` equals `&lt;b&gt;&amp;`. Route tests start the app on an ephemeral port with a test asset registered (`name: 'test-dot', params: ['color']`): `/api/svg/test-dot/red` is 200, `image/svg+xml`, immutable cache header, body starts with `<svg`; `/api/svg/nope` is 404; `/api/svg/test-dot/` + a param `render` rejects is 400; `/api/svg` lists `test-dot` with its samples.
- [ ] **Step 2:** `npm test` shows them failing.
- [ ] **Step 3:** Implement `mountAssetRoutes(app: Express, assets: SvgAsset[] = SVG_ASSETS)`, so tests pass their own list; `findSvg` is a lookup by name.
- [ ] **Step 4:** `npm test` passes.
- [ ] **Step 5:** Commit `Serve generated SVGs from /api/svg`.

### Task 2: Sounds as server data

**Files:**
- Create: `shared/sounds.ts` (the data and its type), `server/assets/sounds.ts` (routes)
- Modify: `src/sound/synth.ts` (play from loaded data), `server/assets/routes.ts`
- Test: `server/assets/routes.test.ts`, `src/sound/synth` logic test if a pure part is extracted

**Interfaces:**
- Produces: `type SoundNote = { at: number; length: number; hz: number; type: 'sine' | 'triangle' | 'square' | 'sawtooth' }`; `type SoundDef = { name: SoundName; label: string; notes: SoundNote[]; noise?: { bursts: number; spacingSec: number; lengthSec: number } }`; `SOUNDS: SoundDef[]` with the exact current values from `src/sound/synth.ts` (turn, move, gameOver, timer as notes; dice as noise: 6 bursts, 0.044 s apart, 0.03 s long). Move `SoundName` into `shared/sounds.ts` and re-export it from `src/services/settings.ts`.
- Routes: `GET /api/sound` returns `SOUNDS`; `GET /api/sound/:name` returns one or 404.
- Client: `loadSounds(): Promise<void>` called once from `main.tsx`; `play(name)` uses the loaded data and is silent (no throw) until loaded or after a failed load.

- [ ] **Step 1: Failing tests**: `/api/sound` returns 5 sounds whose `turn` notes equal `[{at:0,length:0.25,hz:660,type:'sine'},{at:0.15,length:0.35,hz:880,type:'sine'}]`; `/api/sound/dice` has `noise.bursts === 6`; `/api/sound/nope` is 404.
- [ ] **Step 2:** Run, see failures.
- [ ] **Step 3:** Implement; remove the old `NOTES` table and the hard-coded rattle constants from `synth.ts`.
- [ ] **Step 4:** `npm test` passes, including `src/sound/*.test.ts`.
- [ ] **Step 5:** Commit `Serve the sounds from /api/sound`.

### Task 3: `<ServerSvg>` and the client cache

**Files:**
- Create: `src/assets/svgCache.ts`, `src/assets/ServerSvg.tsx`
- Test: `src/assets/svgCache.test.ts`

**Interfaces:**
- Produces:
  - `svgUrl(name: string, ...params: (string | number)[]): string` (each param `encodeURIComponent`ed).
  - `loadSvg(url: string): Promise<string>` (one fetch per URL, shared promise, failures not cached so a retry can succeed), `cachedSvg(url: string): string | undefined` (synchronous), `preloadSvgs(urls: string[]): Promise<void>` (never rejects).
  - `<ServerSvg url={string} className?={string} title?={string} inSvg?={boolean} />`: renders a `<span className="server-svg ...">` (or `<g>` when `inSvg`) whose inner HTML is the cached markup; before it loads, renders the same element empty with the final size set by CSS (the asset's `width`/`height` come from the caller's class); on failure renders `title` as visually hidden text. Markup comes only from our own `/api/svg` and is inlined with `dangerouslySetInnerHTML` (comment why it is safe).
- [ ] **Step 1: Failing tests** with a stubbed `fetch`: two `loadSvg` calls for one URL fetch once; `cachedSvg` is undefined before and the markup after; a rejected fetch rejects `loadSvg`, and a later call fetches again; `preloadSvgs` resolves when one URL fails; `svgUrl('pawn', 'a b', 2)` is `/api/svg/pawn/a%20b/2`.
- [ ] **Step 2:** Run, see failures. **Step 3:** Implement. **Step 4:** Pass. **Step 5:** Commit `Show server SVGs inline through ServerSvg`.

### Task 4: Hidden gallery pages

**Files:**
- Create: `src/dev/SvgGallery.tsx`, `src/dev/SoundGallery.tsx`, `src/dev/dev.scss`
- Modify: `src/App.tsx` (or `src/main.tsx`, whichever keeps App simplest): pathname `/dev/svgs` and `/dev/sounds` render the pages; nothing links to them.
- Test: `e2e/devPages.spec.ts`

**Interfaces:** Consumes `GET /api/svg`, `GET /api/sound`, `ServerSvg`, `play`.

- [ ] **Step 1: Failing e2e**: `/dev/svgs` shows one card per listed asset per sample, each with its URL as text and a rendered `svg` element; `/dev/sounds` shows a Play button per sound (5), and clicking one does not throw (no page error).
- [ ] **Step 2:** Run, see failure. **Step 3:** Implement: a responsive grid, each card the asset name, the URL, and the SVG at a fixed box; a light/dark toggle on the SVG page so themed pieces can be compared. **Step 4:** Pass. **Step 5:** Commit `Add hidden SVG and sound gallery pages`.

### Task 5: Move the existing SVG drawings to the server

**Files:**
- Create: `shared/svg/symbols.ts` (ColorSymbol shapes), `shared/svg/icons.ts` (share, github), `games/carcassonne/svg.ts` (meeple, tile art incl. the TurnPanel drawing)
- Modify: `src/components/ColorSymbol.tsx`, `GitHubLink.tsx`, `ShareButton.tsx`, `games/carcassonne/client/Meeple.tsx`, `TileArt.tsx`, `TurnPanel.tsx`, `server/assets/registry.ts`
- Test: one `*.test.ts` per new generator file

**Interfaces:**
- Produces assets: `color-symbol/<symbol>`, `icon/share`, `icon/github`, `carcassonne-meeple/<seat>`, `carcassonne-tile/<tileType>/<quarterTurns>` (quarterTurns 0 to 3). Exact names may differ if the existing code suggests better ones; keep one name per drawing.
- Client components keep their props and wrapper elements (and every `className`, `data-*` and aria attribute) and render `<ServerSvg>` inside.
- [ ] **Step 1: Failing tests**: each generator returns a string starting with `<svg` and containing the same shapes as the old component for one sample (for TileArt: a city tile contains the city path and its `rotate(90 50 50)` transform at quarterTurns 1); invalid params (unknown tile type, quarterTurns 4) return null.
- [ ] **Step 2:** Run. **Step 3:** Port the drawing code from JSX to `el()` calls; delete the JSX drawing code. **Step 4:** `npm test`, `E2E_PORT_BASE=6110 npx playwright test e2e/carcassonne.spec.ts e2e/sharing.spec.ts e2e/settings.spec.ts` pass. **Step 5:** Commit `Draw symbols, icons and Carcassonne pieces on the server`.

### Task 6: Board outlines from the server

**Files:**
- Modify: `games/risk/client/layout.ts` and `WorldMap.tsx`, `games/tickettoride/client/geometry.ts` and `MapBoard.tsx`; create `games/risk/svg.ts`, `games/tickettoride/svg.ts`; register in `server/assets/registry.ts`
- Test: generator tests

**Interfaces:** Assets `risk-land` and `tickettoride-land`: a full `<svg>` with the board's own viewBox holding only the non-clickable land and sea shapes, with the existing class names (`sea`, `land`, `canada`, `usa`) so game SCSS still colors them. The board renders `<ServerSvg url=... inSvg />` as its first child; territories, routes and cities stay client-drawn and clickable. Outline data (`CONTINENT_SHAPES`, `LAND_OUTLINE`, `CANADA_OUTLINE`) moves out of the client files into the non-client `svg.ts` files.

- [ ] Steps: failing generator test (contains one `polygon class="land"` per continent for Risk); implement; `npx playwright test e2e/risk.spec.ts e2e/tickettoride.spec.ts`; browser check that land is colored in both themes; commit `Serve the Risk and Ticket to Ride land outlines`.

### Task 7: Redraw the shared pieces (dice, playing cards)

**Files:**
- Create: `shared/svg/dice.ts`, `shared/svg/playingCards.ts`
- Modify: `src/components/Dice.tsx`, `PlayingCard.tsx`, `src/App.scss` (their styles), `server/assets/registry.ts`
- Test: generator tests; existing e2e

**Interfaces:**
- Assets: `die/<1-6>`; `playing-card/<rank>/<suit>`, `playing-card/joker/<n>`, `playing-card/back`.
- Colors inside the SVG use the existing variables with today's defaults as fallbacks, for example `fill="var(--dice-face, <current default>)"`, `var(--dice-pip, ...)`, `var(--playing-card-face, ...)`, `--playing-card-back`, `--playing-card-stripe`, `--playing-card-red`, `--playing-card-black`. Selected and highlight states stay as classes on the client wrapper.
- `Dice` and `PlayingCard` keep their props, sizes (three card sizes), button behavior, `drawn` class, and wrapper attributes; each renders `<ServerSvg>` inside. Each game screen that uses them calls `preloadSvgs` for its full set on mount (a helper `preloadDice()` / `preloadDeck()` exported from the component files).
- [ ] Steps: failing generator tests (die 5 has 5 pips; a red suit card uses `--playing-card-red`; unknown rank returns null); implement; browser check every game that retheme these (Azul has none; check Hearts, Euchre, Yahtzee, Farkle, and any game whose SCSS sets those variables) in both themes; full e2e; commit `Draw dice and playing cards on the server`.

### Task 8: Redraw each game's own pieces

**Files:** for each game below, create `games/<id>/svg.ts`, register its assets, and change the client piece component to render `<ServerSvg>`; one commit per game or small group.

First inventory (grep each `games/*/client/*.tsx` for components that draw a piece with spans, divs, Unicode or CSS shapes). At least: Quoridor pawn and wall (`Pawn.tsx`, `WallPiece.tsx`, the tray wall icon), Azul tiles (`Tile.tsx`), chess pieces (`PieceGlyph.tsx`, drawn as SVG shapes instead of Unicode), checkers pieces, Connect Four discs, backgammon checkers, Mancala stones, Parchisi pawns, dominoes (`Tile.tsx`), Rummikub tiles, UNO, Phase 10, Skip-Bo and Rack-O cards, Splendor gems and cards, Scrabble tiles, Monopoly tokens, Catan's resource art inside the board (as `inSvg` children that let clicks through to the board). List the final inventory in the PR, and any piece deliberately left as is with the reason.

**Interfaces:** for each piece: wrapper element, `className`, `data-anim-key`, `data-drag` spread, aria label and click handler stay on the client component; colors inside the SVG use that game's existing CSS variables or classes.

- [ ] Steps per game: failing generator test (valid sample renders, invalid param returns null); implement; that game's e2e spec passes; browser check of that game in both themes and the color-blind symbols setting on; commit `Draw <game> pieces on the server`.
- [ ] Final: full e2e (`E2E_PORT_BASE=6110 npx playwright test --workers=3`), `/dev/svgs` shows every asset, update `docs/architecture.md` (an Assets section: registry, routes, where generators live, ServerSvg, gallery pages), open the PR titled "Serve every SVG and sound from the server".

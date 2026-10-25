# Server assets, rules dialog, per-game loading, and polish: design

Date: 2026-10-25

## Intent

The client bundle has grown large, the art and sounds are scattered through game code, and a few screens feel clunky. This changeset makes the download smaller, gathers every SVG and sound in one place on the server, and cleans up several rough edges the user hit while playing.

Delivery: eight changesets, each built in its own git worktree in parallel, each with its own branch and PR against master. When all eight are green, they are merged into one combined branch and PR for the whole changeset, and the eight temporary PRs are closed (not merged). The combined PR body follows the format of PR #28.

## Goals, non-goals, anti-goals

Goals:
- A player who opens one game downloads only that game's code and styles.
- Every SVG that is not a clickable board, and every sound, is served by the server from one place, and can be browsed on hidden gallery pages.
- The other items below, exactly as described.

Non-goals:
- Server rendering of clickable boards (Catan board, Risk map, Ticket to Ride map, Carcassonne board, Quoridor board, and similar). These stay drawn in the browser so their parts can be clicked and dragged.
- Recorded audio. Sounds stay synthesized.
- New npm dependencies (the user's rule). A markdown renderer, if needed, is written in-house.

Anti-goals (a failure even if it technically works):
- Light and dark theme, per-game recoloring (CSS variables like `--playing-card-face`), or the color-blind symbols breaking on any piece because it moved to the server.
- A hidden filter quietly emptying the game list with no visible sign that a filter is on.
- Losing the bigger player counts the house rule override allows today.
- Any game becoming unplayable while its chunk is loading or after a failed load.

## Constraints

- Follow docs/architecture.md: server, shared and non-client game files never import from `src/` or `games/<id>/client/`; game SCSS is nested under `[data-game="<id>"]`.
- Update docs/architecture.md, the affected game READMEs, and FAQ text wherever behavior changes.
- `npm run lint`, `npm test`, `npm run build` pass, plus the relevant e2e specs (full suite for changesets that touch every game). Every UI change is checked in Chrome, in light and dark, at desktop width and at 390 px and 320 px (with iframes, since the Chrome window cannot be resized on this machine).
- No em-dashes in any prose, commits or PR bodies.

## The eight changesets

### 1. Server-side SVG and sound assets, with gallery pages (branch `server-assets`)

Decided with the user:
- Every SVG that is not a clickable board moves to the server. Fixed ones are served at `/api/svg/<name>`, and generated ones at `/api/svg/<name>/<parameters...>`, for example `/api/svg/meeple/red`, `/api/svg/carcassonne-tile/<tile type>/<rotation>`, `/api/svg/pawn/<seat or color>`. The server code that generates them is the single home for that drawing code.
- Clickable boards stay in the browser. The large fixed shapes they use (for example the Risk continent outlines and the Ticket to Ride land outlines) move to the server and are fetched when that game opens; the board's click and drag handling stays in the game's client code.
- Sounds move to the server as note-list data at `/api/sound/<name>` (and a listing route), still played by the existing synth in `src/sound/synth.ts`. The dice rattle is noise, not notes, so its description needs a data shape too.
- Hidden pages that are not linked from anywhere: `/dev/svgs` shows every SVG the server offers side by side, each generated SVG with a few sample parameter sets and its URL, and `/dev/sounds` lists every sound with a play button.

Builder's notes:
- The server needs a registry of assets (name, parameter description, sample parameters, generator) that both the routes and the gallery listing read, so adding an asset is one entry.
- Unknown names or invalid parameters return 404 or 400, never a crash. Responses carry long cache headers (the content of a URL never changes), and the SVG content type.
- Theming: an SVG shown through a plain `<img>` cannot see the page's CSS, so `currentColor`, theme colors, CSS variables and color-blind symbols would stop working. My call (not discussed with the user): the client shows server SVGs through one small component that fetches the markup once per URL, caches it, and puts it inline, so page CSS still applies. The builder may choose another approach only if it keeps the anti-goal above.
- Before moving anything, inventory every SVG and glyph-like drawing (grep for `<svg`, `<path`, `<polygon`, and piece components such as Meeple, TileArt, Pawn, WallPiece, ColorSymbol, Azul tiles, dice). Small drawings inside clickable boards (Catan's resource art, for example) can become server SVGs placed inside the board, as long as clicks still reach the board.
- Pieces drawn with plain HTML, CSS and text today are redrawn as server SVGs too (decided with the user). That covers at least the Quoridor pawn and wall, Azul tiles, the shared dice (`Dice.tsx`) and playing cards (`PlayingCard.tsx`), the chess glyphs, and every other game piece the inventory turns up (dominoes, UNO and other card faces, tokens). The rule: if it is a game piece or icon and not a clickable board, it is a server SVG.
- Recoloring must survive the redraw: the SVGs paint with the existing CSS variables (`--dice-*`, `--playing-card-*`, `--piece-tray-*` and the per-game ones), which works because they are inlined. Animation keys (`data-anim-key`), drag sources, click targets, accessible names and e2e selectors stay on the client wrapper, so animations, drag and drop and tests keep working. Pieces must never flash blank: preload or cache what a game uses when its screen opens.
- Because this touches every game, it runs the full e2e suite.
- Sound playback must not get a delay on first use: load the sound data once at startup and fall back to silence, never an error, if it fails.

### 2. Rules dialog (branch `rules-dialog`)

Decided with the user:
- Wherever there is an FAQ button now (the game header and the join dialog), a single Rules button replaces it.
- Rules opens a dialog showing the game's `games/<id>/README.md`, rendered as formatted text with headings, lists, emphasis, code and tables.
- A button inside the dialog switches to the FAQ, and another switches back.
- The README comes from the server when the dialog opens (for example `GET /api/rules/<game id>`, 404 for unknown ids), so it adds nothing to the bundle. The Dockerfile already copies `games/`.

Builder's notes:
- An in-house markdown renderer that outputs React elements (never inserting unescaped HTML), covering what the READMEs actually use, with unit tests. Links to other repo files must not be broken links; pointing them at the GitHub repo is fine.
- The phone header must still fit one row down to 320 px.
- e2e tests that click FAQ are updated.

### 3. Per-game code loading (branch `lazy-game-chunks`)

Decided with the user:
- The landing page loads only names, icons, descriptions and filter data. A game's screen, history board, move descriptions, animations, FAQ and styles download when its join dialog opens (and when the history dialog or a saved game needs them).
- A short "Loading..." shows on a slow network, and an error with Retry if the download fails.
- The PR states the main bundle size before and after, measured with `npx vite build`.

Builder's notes:
- One clean API for consumers (for example `loadClientGame(id)` with caching, and a hook), replacing direct use of `CLIENT_GAMES` in GameList, GameView, JoinDialog, HistoryDialog, OpenSavedGame, App and tests.
- Check whether `games/registry.ts` pulls rules code into the client bundle, and split metadata from rules if it does.
- Shared components (PlayingCard, Dice, drag code) stay in the main bundle and are not duplicated per chunk. The service worker in `public/` still works.

### 4. Home screen filters behind a Filter button (branch `filter-button`)

Decided with the user:
- The search box stays visible. A Filter button next to it opens a panel holding sort, category chips, Players and Clear filters.
- The button shows the number of active filters, for example "Filter (2)".
- Clicking outside the panel or pressing Escape closes it. Filters stay remembered as now.

### 5. House rule player count without the checkbox (branch `player-count-rule`)

Decided with the user:
- The "I know what I'm doing" checkbox is removed.
- For a game with a stretched range, the host sees the "Most players" number field directly, defaulting to the normal maximum and adjustable up to the stretched limit (and down to the stretched minimum where defined, such as Catan with two). A count outside the normal range is still a house rule: it is shown as "(house rule)" and everyone must agree, as now.

- A table below the normal minimum starts automatically (decided with the user): when fewer than the normal minimum but at least the stretched minimum are seated (Catan with 2), the game can start, and the seat count is listed as a house rule ("2 players (house rule)") that everyone agrees to like any other. "Most players" is not lowered for this, so a third person can still join until play starts.

Builder's notes:
- Rooms saved with the old `override` field must still load.
- Remove the separate `override` flag from the model only if that stays simple; the behavior above is what matters. Update every FAQ, README, test and doc that mentions the checkbox (grep "I know what I'm doing").

### 6. Quoridor action controls (branch `quoridor-controls`)

Decided with the user:
- The "Your action" panel with Move, Horizontal Wall and Vertical Wall goes away, and so does the Rotate button.
- The walls box becomes the one place to choose: it holds a Move button next to the wall piece and the walls-left count. Tapping the wall picks it up horizontal, and tapping again rotates it (this already works through `nextWallAction`). The R key still rotates, and dragging still works.
- Move is highlighted while moving and the wall is highlighted while held.

### 7. Themed form controls everywhere (branch `themed-controls`)

Decided with the user: every checkbox, dropdown and number box in the app looks themed, in light and dark.

My call: style native `input[type=checkbox]`, `select` and `input[type=number]` globally by default, replacing the opt-in `.themed-select` and `.themed-checkbox` classes, so new screens are covered automatically. Known unstyled controls today: dropdowns in Rook, Spades, Phase 10, Ticket to Ride, Risk, The Crew, War, Catan and Monopoly; Monopoly property checkboxes; number boxes in Hold'em, Monopoly and the house rules panel; the house rules checkboxes and dropdowns. Disabled controls (a guest's read-only house rules) should look intentional, not faint. Games that retheme controls (Azul, Catan, Monopoly) keep their look. Check each screen in Chrome.

### 8. Azul drag and drop (branch `azul-drag`)

Decided with the user:
- Grab a tile in a factory or the center and all tiles of that color come with it, exactly as clicking selects them now.
- Drop on a pattern line or the floor line. While dragging, the lines that accept that color are highlighted.
- Uses the shared drag code in `src/drag/` (as the other drag games do), so touch works the same. Clicking still works.

## Combining

Expected overlaps to resolve in the combined branch:
- Changeset 3 restructures how game clients are registered; changesets 1, 2 and 8 touch game clients and the FAQ, so they rebase onto its shape.
- Changesets 4, 5 and 7 all touch `src/App.scss`, `GameFilters.tsx` and `HouseRulesPanel.tsx`.
- Changeset 1 redraws pieces that changesets 6 (Quoridor wall and pawn) and 8 (Azul tiles) also touch; the drag and control work wraps whatever piece component exists after the merge.
- Changesets 1 and 3 both touch `App.tsx` routing (the gallery pages, and per-game loading).

After merging, the full check runs again on the combined branch: lint, unit tests, build, the full e2e suite, and a Chrome pass over each feature, with the bundle size numbers restated.

## Left to the builder

Exact file layout, component names, the asset registry's shape, the sound data shape, the markdown subset, the loading indicator's look, and the filter panel's look, all within the existing visual style.

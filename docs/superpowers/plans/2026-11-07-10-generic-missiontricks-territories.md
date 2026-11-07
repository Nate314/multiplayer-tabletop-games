# Generic Names: Mission Tricks and Territories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Crew becomes Mission Tricks (`missiontricks`) with a newly written 50-mission campaign, and Risk becomes Territories (`territories`) with an original world map, both with unchanged rules, and old links, stats and saves handled through `games/legacyIds.ts`.

**Architecture:** Each game is renamed with `git mv` and its new id at every registration point, and gets one `LEGACY_IDS` entry. Mission Tricks keeps the mission mechanics table (`MISSIONS`) mission for mission, so saved games and rules tests stay valid, and adds an original title and story to each mission, shown on the table. Territories replaces the map data in `map.ts` (territories, continents, borders, positions) with a fictional world of the same structure; its land drawing already follows the territory positions. Because a Risk state names territories by id, `risk` gets `keepsSaves: false`.

**Tech Stack:** TypeScript 5.9, React 19, Vite, SCSS, `node --test`, Playwright (Chromium), Node 22.18+ through nvm. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Generic names (wave 2)" (all of it) and "Rules for every agent". Chunk 10, branch `generic-missiontricks-territories`, from `party-games-and-polish` after wave 1 and chunk 9's legacy id PR are merged into it. Plan 9 (`docs/superpowers/plans/2026-11-07-09-generic-streetdeeds-railroutes.md`, Tasks 2 to 5) defines the legacy id plumbing used here.

## Global Constraints

- New names and ids, exactly: **Mission Tricks** (`missiontricks`), **Territories** (`territories`). "Each new id is the name in lower case with no spaces or punctuation."
- `git mv games/<old> games/<new>` so history follows, and `e2e/<old>.spec.ts` renamed to `e2e/<new>.spec.ts` the same way.
- "Rules, house rules and options are unchanged, so existing rules tests pass after only the renames."
- "A single `games/legacyIds.ts` maps each old id to its new id." "Each use has a test. The old ids appear nowhere else in the code." This chunk only adds entries to `LEGACY_IDS`; it does not change the plumbing.
- "The game's README may say once, in its opening, that it plays like the commercial game ("plays like Monopoly"), which is descriptive use; nothing else shows the old name. "Differences from Wikipedia" stays and keeps pointing at the Wikipedia article for the rules." Put the Wikipedia link in that one opening line, so the old name appears in one line only, and have "Differences from Wikipedia" refer to "the Wikipedia article linked above".
- "Any drawn art, piece or card design that imitates the commercial game's look is redrawn in the project's own style."
- Mission Tricks: "a newly written mission campaign with the same number of missions and the same mechanics (task counts, task tokens, communication limits, special rules), with original mission titles, story text and task setups. No sentence from the published logbook."
- Territories: "an original map with the same structure (the same number of territories and continents, the same continent bonuses and a comparable adjacency pattern), with original territory and continent names and borders (my call: a fictional world)."
- "All four: rules tests are updated where they name spaces, cities, missions or territories; the hidden-information and manager tests still pass."
- Wave 2 does **not** edit the top-level `README.md` game list or count, the counts in `e2e/landing.spec.ts`, or `docs/architecture.md`.
- Outside the two game folders, touch only: `games/legacyIds.ts` (entries) and `games/legacyIds.test.ts`, `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, the every-game test lists (`shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`), `e2e/handOnly.spec.ts`, and comments naming the old games in `shared/svg/disc.ts` and `shared/svg/cardArt.ts`. Anything else: stop and report.
- Wave 1 and chunk 9 have edited the registry files and `e2e/fixtures.ts`. Find lines by symbol (`GAMES`, `GAME_INFOS`, `CLIENT_GAMES`, `GAME_ICONS`, `SVG_ASSETS`, `LEGACY_IDS`), never by line number.
- Registry order is "alphabetical by name": move each renamed entry to its new name's place in `GAMES` and `GAME_INFOS`, the same place in both (`games/infos.test.ts` checks it).
- No em-dashes (the character U+2014) in code, comments, READMEs, FAQs, commit messages or the PR body.
- Ports for this chunk: server `PORT=3310`, Playwright `E2E_PORT_BASE=9000`. Never 6000 (Chrome refuses it).
- Node through nvm. If `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to `PATH` (Git Bash: `export PATH="/c/Users/Natha/AppData/Local/nvm/v22.22.3:$PATH"`).
- Every commit message ends with a blank line and then exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- Every PR body ends with exactly:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

## Plan decisions (not pinned by the spec; reported to the coordinator)

- **Mission mechanics stay mission for mission.** The spec asks for "the same mechanics (task counts, task tokens, communication limits, special rules)" and also "original ... task setups". This plan reads "task setups" as the story's framing of each mission's tasks (what the crew is doing and why), written fresh, and keeps each mission's numbers and rule as they are. That keeps saved games, the README's per-mission notes and the rules tests valid. If the owner wants a different mission table, that is a change to this plan.
- **Setting.** The space theme, rockets as trumps, the commander and the distress signal are generic and stay. The campaign is new (my call: the crew of a deep-space courier ship on a fifty-stop delivery route). "Planet Nine" and any published mission title or line never appear. The words "logbook" and "crew" stay as plain words.
- **Territories saves.** A Risk state keys armies and owners by territory id, which the new map changes, so `risk: { id: 'territories', keepsSaves: false }`: links, stats and the remembered game move to Territories, while a Risk game saved before the rename is refused (pause or game file) or dropped at server start, with the messages plan 9 defines.

## Review Focus

1. A Mission Tricks game saved as The Crew mid-mission (mission 23 with swapped tokens, mission 50 relay) loads and plays on: `MISSIONS` keeps every mechanic per mission. Characterization test in Task 3.
2. Territories: a continent with one way in (the old Australia) or two (the old South America) changes how the game plays; the new map keeps each continent's border crossings and entry territories. Test in Task 5.
3. Territory labels and army counts overlap at phone width on the new positions. Checked in Task 6 at 390 px and 320 px.
4. A territory card names its territory by index: the 44 cards still show 14 of each symbol and 2 wilds, and each card names a real new territory. Test in Task 5.
5. A long mission title or story at 320 px wraps without pushing the trick off screen. Checked in Task 6, with a length cap tested in Task 3.

---

### Task 1: Worktree, branch and ports

**Files:** none in the repo.

- [ ] **Step 1: Create the worktree.**

```bash
cd C:/Users/Natha/Documents/code/multiplayer-tabletop-games
git fetch origin
git worktree add ../mtg-generic-missiontricks-territories -b generic-missiontricks-territories origin/party-games-and-polish
cd ../mtg-generic-missiontricks-territories
npm ci
```

Expected: `games/legacyIds.ts` exists (chunk 9's legacy PR is merged) and wave 1's games are present. If either is missing, stop and report.

- [ ] **Step 2: Check the ports are free.** `netstat -ano | grep -E ':(3310|900[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3310 or 9000, and say so in the PR.

- [ ] **Step 3: Baseline.** `npm test`, `npm run typecheck`, `npm run lint` pass. If not, stop and report.

---

### Task 2: Rename The Crew to Mission Tricks (ids, folders, registration)

**Files:**
- Move: `games/thecrew` to `games/missiontricks`; `e2e/thecrew.spec.ts` to `e2e/missiontricks.spec.ts`; `games/missiontricks/client/thecrew.scss` to `missiontricks.scss`
- Modify: `games/missiontricks/info.ts`, `index.ts`, `client/index.ts`, `client/missiontricks.scss`, every file using the old id or identifiers built from it; `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `shared/categories.test.ts`, `games/standings.test.ts` (`FALLBACK_GAMES`), `games/secretState.test.ts` (the list and the `'thecrew hides the face-down tasks ...'` test's lookup and name), `games/privateSeatView.test.ts`, `e2e/handOnly.spec.ts`, `games/legacyIds.ts`, `shared/svg/cardArt.ts` (comment)
- Test: `games/legacyIds.test.ts`, `e2e/missiontricks.spec.ts`

**Interfaces:**
- Produces: `missiontricksInfo` (`id: 'missiontricks'`, `name: 'Mission Tricks'`), `missiontricks` (the `GameDefinition`), `missiontricksClient`, scope `[data-game="missiontricks"]`. `LEGACY_IDS` gains `thecrew: { id: 'missiontricks', keepsSaves: true }`.

- [ ] **Step 1: Write the failing test.** `games/legacyIds.test.ts`, `thecrew is now Mission Tricks and its saves still fit`: `currentId('thecrew') === 'missiontricks'`, `keepsSaves('thecrew') === true`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts`. Expected: FAIL.
- [ ] **Step 3: Move and rename.** The three `git mv`s above; replace the id and every identifier built from it (`thecrewInfo`, `thecrew`, `thecrewClient`, `thecrew.scss`, `[data-game="thecrew"]`, `../games/thecrew/` imports in e2e, `seat('thecrew', ...)`, the `thecrew:` keys in `e2e/handOnly.spec.ts` and `games/privateSeatView.test.ts`). Set `name: 'Mission Tricks'`. Move the `GAMES` and `GAME_INFOS` entries to the "Mission Tricks" alphabetical place. Update `shared/categories.test.ts` (`card`), `games/standings.test.ts`, `games/secretState.test.ts`. Add the `LEGACY_IDS` entry. Fix the `shared/svg/cardArt.ts` comment.
- [ ] **Step 4: Add the old-link e2e test** at the end of `e2e/missiontricks.spec.ts`, `an old thecrew join link opens Mission Tricks`: open `/join/thecrew/<fresh game ID>`, expect the join dialog to name "Mission Tricks" and, after joining, `data-game="missiontricks"`. Follow `e2e/sharing.spec.ts` (and the matching tests chunk 9 added to `e2e/streetdeeds.spec.ts`).
- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run lint`. Expected: PASS.
- [ ] **Step 6: Run** `E2E_PORT_BASE=9000 npx playwright test --workers=2 e2e/missiontricks.spec.ts e2e/handOnly.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit**: "Mission Tricks: rename The Crew game, its id and folder".

---

### Task 3: Mission Tricks campaign, wording and art

**Files:**
- Modify: `games/missiontricks/types.ts` (`Mission`), `missions.ts`, `client/Table.tsx`, `client/missiontricks.scss`, `client/faq.ts`, `client/MissionSummary.tsx` (comment), `rules.ts` (header comment only), `README.md`, `info.ts` (`description`), `shared/svg/gameIcons.ts` (`missiontricks` icon)
- Test: create `games/missiontricks/missions.test.ts`; `rules.test.ts` and `e2e/missiontricks.spec.ts` only where they name the old game or its book

**Interfaces:**
- Produces: `Mission` gains `title: string` and `story: string`. `MISSIONS` entries keep `number`, `tasks`, `tokens`, `deadSpot`, `commsFrom` and `rule` exactly; the `m(...)` helper takes the title and story as two more arguments (or an object, the builder's choice). `Table.tsx` shows, after `<span className="mission-number">Mission {mission}</span>`, a `<span className="mission-title">{title}</span>` and a `<p className="mission-story">{story}</p>`, so text matches on "Mission N" stay as they are.

- [ ] **Step 1: Write the characterization test before any change.** In `missions.test.ts`, `every mission keeps its mechanics`: define `const mechanics = (m: Mission) => JSON.stringify([m.number, m.tasks, m.tokens, m.deadSpot ?? null, m.commsFrom ?? null, m.rule ?? null])`, generate the 50 strings once with a scratch `node` script running that expression over the current `MISSIONS`, paste them as `MECHANICS`, and assert `MISSIONS.map(mechanics)` deep-equals `MECHANICS` (picking fields keeps lint's unused-variable rule quiet and ignores the new ones). Run `node --test games/missiontricks/missions.test.ts`: PASS now, and it must pass after Step 3.

- [ ] **Step 2: Write the failing campaign tests** in `missions.test.ts`:
  - `fifty missions, each with its own title and story`: `MISSIONS.length === 50`; 50 distinct non-empty titles of at most 40 characters; every story is 1 to 3 sentences and at most 240 characters.
  - `no published title or phrase`: no title or story contains "Planet Nine", "Planet X", "Quest" or "The Crew" (case-insensitive).
  Run: FAIL (no titles).

- [ ] **Step 3: Write the campaign.** In `missions.ts`, give each of the 50 missions an original title and a short story for the courier-ship campaign (one continuous voyage, missions 1 to 50 in order), each story framing that mission's tasks and special rule in the story's terms ("the task setup"). Write every line fresh: do not read or paraphrase the published logbook. Replace the header comment: the mechanics follow the published game's 50 missions, and the titles and stories are this project's own. Show the title and story in `Table.tsx` as in Interfaces, styled in `missiontricks.scss` (story in the muted text color, wrapping).

- [ ] **Step 4: Run** `node --test games/missiontricks/missions.test.ts games/missiontricks/rules.test.ts`. Expected: PASS.

- [ ] **Step 5: Wording.** `README.md`: title "Mission Tricks"; one opening line "Plays like [The Crew](https://en.wikipedia.org/wiki/The_Crew_(card_game)), with its own fifty-mission campaign." (the only line with the old name); "Rules" and "The missions" table name no published book ("the published game's 50 missions" where a source is needed), and the table gains a Title column; "Differences from Wikipedia" opens with "These follow the rules in the Wikipedia article linked above and, where it is brief, the publisher's rulebook." and its bullets keep their mission numbers. `client/faq.ts` ("The Crew is cooperative" becomes "Mission Tricks is cooperative"), `info.ts` `description` (new wording, same meaning). Update `rules.test.ts` and the e2e spec only where they name the old game.

- [ ] **Step 6: Art check.** Look at `client/Card.tsx`, `client/Table.tsx` and the SCSS for anything drawn after the commercial cards (the rocket card's look, the task card layout, the radio token). The rocket uses the shared `rocket` icon and card art bands, which are this project's own: keep them unless a side-by-side look at the published cards shows a copy, then redraw. Give `missiontricks` in `shared/svg/gameIcons.ts` its own drawing (my call: a line-icon playing card with a check mark), replacing `rocketIcon` there (the `rocket` icon itself stays in `shared/svg/icons.ts` for the cards).

- [ ] **Step 7: Run** `npm test`, `npm run typecheck`, `npm run lint`, `E2E_PORT_BASE=9000 npx playwright test --workers=2 e2e/missiontricks.spec.ts e2e/handOnly.spec.ts`. Expected: PASS.

- [ ] **Step 8: Commit**: "Mission Tricks: an original fifty-mission campaign, its wording and icon".

---

### Task 4: Rename Risk to Territories (ids, folders, registration)

**Files:**
- Move: `games/risk` to `games/territories`; `e2e/risk.spec.ts` to `e2e/territories.spec.ts`; `games/territories/client/risk.scss` to `territories.scss`
- Modify: `games/territories/info.ts`, `index.ts`, `svg.ts`, `client/index.ts`, `client/WorldMap.tsx` (asset name), `client/territories.scss`, every file using the old id or identifiers built from it; `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, `shared/categories.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`, `e2e/handOnly.spec.ts`, `games/legacyIds.ts`, `shared/svg/disc.ts` (comment)
- Test: `games/legacyIds.test.ts`, `e2e/territories.spec.ts`

**Interfaces:**
- Produces: `territoriesInfo` (`id: 'territories'`, `name: 'Territories'`), `territories`, `territoriesClient`, `TERRITORIES_ASSETS` with the asset `territories-land`, scope `[data-game="territories"]`. `map.ts` already exports a `TERRITORIES` array: the definition is named `territories`, so the two do not clash (check imports in `index.ts`). `LEGACY_IDS` gains `risk: { id: 'territories', keepsSaves: false }`.

- [ ] **Step 1: Write the failing test.** `games/legacyIds.test.ts`, `risk is now Territories and its saves are refused`: `currentId('risk') === 'territories'`, `keepsSaves('risk') === false`.
- [ ] **Step 2: Run** `node --test games/legacyIds.test.ts`. Expected: FAIL.
- [ ] **Step 3: Move and rename** as in Task 2 Step 3, with the names above (`riskInfo`, `risk`, `riskClient`, `RISK_ASSETS`, `risk-land`, `risk.scss`, `[data-game="risk"]`, `seat('risk', ...)`, the `risk:` keys); set `name: 'Territories'`; move the `GAMES` and `GAME_INFOS` entries to the "Territories" alphabetical place; update `shared/categories.test.ts` (`strategy`), `games/secretState.test.ts`; add the `LEGACY_IDS` entry; fix the `shared/svg/disc.ts` comment ("Risk's tray army").
- [ ] **Step 4: Add the old-link e2e test** at the end of `e2e/territories.spec.ts`, `an old risk join link opens Territories`, as in Task 2 Step 4.
- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run lint`. Expected: PASS.
- [ ] **Step 6: Run** `E2E_PORT_BASE=9000 npx playwright test --workers=2 e2e/territories.spec.ts e2e/handOnly.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit**: "Territories: rename the Risk game, its id and folder".

---

### Task 5: Territories original world, wording and art

**Files:**
- Modify: `games/territories/types.ts` (`ContinentId`), `map.ts`, `svg.ts` (comment), `client/layout.ts` (`CONTINENT_LABELS`, `SHORT`, `continentShort`), `client/WorldMap.tsx` (aria label if it names the world), `client/territories.scss` (continent classes and colors), `client/faq.ts`, `README.md`, `info.ts` (`description`), `shared/svg/gameIcons.ts` (`territories` icon)
- Test: `games/territories/map.test.ts`, `svg.test.ts`, `rules.test.ts`, `manager.test.ts`, `testing.ts`, `client/describeMove.test.ts`, `e2e/territories.spec.ts`

**Interfaces:**
- Consumes: Task 4 names. Keeps every export of `map.ts` (`MAP_WIDTH`, `MAP_HEIGHT`, `CONTINENTS`, `TERRITORIES`, `BORDERS`, `NEIGHBORS`, `ALL_CARDS`, `adjacent`, `territoriesOf`, `cardSymbol`, `cardName`, `cardTerritory`, `territoryName`) with the same shapes. `ContinentId` becomes the six new continent ids, in the same order as now (the first has 9 territories and bonus 5, and so on).

- [ ] **Step 1: Write the failing map tests** in `map.test.ts`, keeping the current tests for ids, names, bounds, 83 symmetric borders, connection and the 44 cards, and replacing the continent and "borders players know" tests with:
  - `continents keep the published sizes and bonuses, in order`: `CONTINENTS.map(c => [territoriesOf(c.id).length, c.bonus])` deep-equals `[[9, 5], [4, 2], [7, 5], [6, 3], [12, 7], [4, 2]]`.
  - `each continent is as easy to hold as before`: for each continent in order, the number of borders crossing its edge is `[3, 2, 8, 6, 8, 1]` and the number of its territories on such a border is `[3, 2, 4, 3, 5, 1]`; 23 borders are marked `sea`; every territory has 2 to 6 neighbors. (These are the current map's numbers.)
  - `a fictional world`: no territory or continent name or id is one of the current 42 territory and 6 continent names or ids (copy them into the test as `OLD_NAMES`).
  - `every card names a territory`: for cards 0 to 41, `territoryName(cardTerritory(card))` is that territory's name.
  Run `node --test games/territories/map.test.ts`: FAIL (old names).

- [ ] **Step 2: Draw the world.** In `map.ts`: invent six continents and 42 territories (my call: name the world in the header comment and README), place them on the 1000 by 620 drawing, then write a new `BORDERS` list from that drawing (neighbors on the drawing, sea links across water; not the published border list relabeled) that meets the tests. Replace the header comment (no "classic Risk world"). Update `ContinentId` in `types.ts`, `CONTINENT_LABELS`, `SHORT` and `continentShort` in `client/layout.ts`, and the `.continent-<id>` classes and colors in `territories.scss` for light and dark. `svg.ts` draws each continent's land from its territory positions, so it needs no new outline; check that the hulls do not overlap each other on the new positions.

- [ ] **Step 3: Run** `node --test games/territories/map.test.ts games/territories/svg.test.ts`. Expected: PASS.

- [ ] **Step 4: Update tests that name territories.** In `testing.ts`, `rules.test.ts`, `manager.test.ts`, `client/describeMove.test.ts` and `e2e/territories.spec.ts`, replace each old territory id with a new one that plays the same part (same continent position in the order, same neighbor relation the test relies on: adjacent, not adjacent, a continent's only entrance, and so on). Keep a scratch mapping table while doing it; do not commit it. Keep every assertion; change only ids, names and numbers that follow from the new borders.

- [ ] **Step 5: Wording and art.** `README.md`: title "Territories"; one opening line "Plays like [Risk](https://en.wikipedia.org/wiki/Risk_(game)), on its own world map." (the only line with the old name); rules name the new continents and their bonuses; "Differences from Wikipedia" opens with "These follow the rules in the Wikipedia article linked above and, where it is silent, the publisher's rules." and gains a bullet "**Map.** An original world with the published map's structure: six continents of 9, 4, 7, 6, 12 and 4 territories with bonuses 5, 2, 5, 3, 7 and 2, and 83 borders." `client/faq.ts` and `info.ts` `description` ("all 42 territories of the world" becomes "all 42 territories"). Check the army pieces, card faces and battle dice for the commercial look; the line-icon infantry, cavalry and artillery symbols and the shared disc army are this project's own. Give `territories` in `gameIcons.ts` its own drawing (my call: a line-icon flag on a hill), not the current globe.

- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, `npm run lint`, `E2E_PORT_BASE=9000 npx playwright test --workers=2 e2e/territories.spec.ts e2e/handOnly.spec.ts`. Expected: PASS.

- [ ] **Step 7: Commit**: "Territories: an original world map, its wording and icon".

---

### Task 6: Browser check

**Files:** none (fixes go back to the task that owns the file, with their own commit).

- [ ] **Step 1: Start the site with the test hooks.** `npm run build` then `E2E=1 PORT=3310 DATABASE_PATH=<scratchpad>/check.sqlite node server/server.ts`; open `http://localhost:3310` in Chrome (load the Chrome tools in one ToolSearch call, per the claude-in-chrome skill).
- [ ] **Step 2: Mission Tricks.** Landing card shows the new name, icon and description. Three tabs (Alice, Bob, Cara): play mission 1 to success, then fail one; check the title and story on the table, the mission rules list, the result dialog, History and a downloaded game file. Force the game end with the end vote.
- [ ] **Step 3: Territories.** Three tabs: place the starting armies (or set a later state through `POST /api/e2e/state/territories/<id>`), attack, conquer, fortify, trade a set; force the end by giving one seat every territory but one and taking it. Check the map, continent labels and bonuses, card names, History and a downloaded game file.
- [ ] **Step 4: Old ids.** `http://localhost:3310/join/thecrew/check1` and `/join/risk/check2` each open the join dialog of the renamed game.
- [ ] **Step 5: Widths.** Laptop size and phone width through same-origin iframes of 390 px and 320 px (memory note: the Chrome tool cannot resize the window; set `data-theme` on each iframe's `documentElement` for dark mode). Both games, light and dark: no overlap, blank rows or misplaced controls; the longest mission story wraps; territory labels and army counts do not collide.

---

### Task 7: Final checks and PR

**Files:** none new.

- [ ] **Step 1: Unit, type and lint.** `npm test`, `npm run typecheck`, `npm run lint`. Expected: all pass.
- [ ] **Step 2: The chunk's e2e specs.** `E2E_PORT_BASE=9000 npx playwright test --workers=2 e2e/missiontricks.spec.ts e2e/territories.spec.ts e2e/handOnly.spec.ts`. Expected: all pass.
- [ ] **Step 3: Old names in player-visible text.**

```bash
git grep -n -I -E "The Crew|thecrew|THECREW|Planet Nine|\bRisk\b|\brisk\b|RISK_|Kamchatka|Irkutsk|Yakutsk" -- games src server e2e shared ':!games/legacyIds.ts' ':!games/legacyIds.test.ts' ':!games/territories/map.test.ts'
```

Expected: only the opening line of `games/missiontricks/README.md` and of `games/territories/README.md`, plus uses of the plain English word "risk" outside these two games (for example Road to Retirement's risk spaces), which are listed in the PR body. Anything else is fixed in its task.
- [ ] **Step 4: Em-dash check.** `git diff origin/party-games-and-polish -U0 | LC_ALL=C.UTF-8 grep -nP '^\+.*\x{2014}'` prints nothing.
- [ ] **Step 5: Push and open the PR.**

```bash
git push -u origin generic-missiontricks-territories
gh pr create --base party-games-and-polish --title "Mission Tricks and Territories: generic names, ids and original content" --body-file <file>
```

The body lists both renames with their legacy entries, the plan decisions above (mechanics kept mission for mission, the courier-ship campaign, Risk saves refused), the art changes, the browser check results, the grep result, and that the top-level README, landing counts and `docs/architecture.md` are left for the coordinator. It ends with the PR footer from Global Constraints.

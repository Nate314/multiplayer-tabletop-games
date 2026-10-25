# Per-Game Code Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The landing page downloads only game metadata; each game's client code and styles download when that game is opened.

**Architecture:** Split the browser's view of games into eager metadata (`GameInfo` without rules code, plus icon) and a lazily imported client module per game. A small loader caches one promise per game id; a hook exposes `{ status, client, retry }` to the join dialog, game view, history dialog and saved-game viewer.

**Tech Stack:** Vite 6 dynamic `import()`, React 19.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 3). Read the index plan for Global Constraints, ports (PORT 3103, E2E_PORT_BASE 6150) and delivery.

## Review Focus (this changeset)

- A chunk fails to load (offline, or a deploy replaced the hashed file): "Could not load <Game>" with Retry, and Retry after the network returns works (Task 2).
- A refresh or `/join/<game>/<id>` link lands straight in a game: the chunk loads before the screen renders, with "Loading..." meanwhile (Task 3).
- History opened in a game, and a saved game file opened from the landing page for a game not yet loaded (Task 3).
- The PWA service worker does not serve a stale `index.html` pointing at deleted chunks (check `public/sw.js`, Task 4).
- Shared code (PlayingCard, Dice, drag, PieceTray) appears in one chunk only (Task 4).

---

### Task 1: Separate metadata from rules for the client

**Files:** Inspect `games/<id>/index.ts` and `games/registry.ts`. Create `games/<id>/info.ts` for each game exporting `<id>Info: GameInfo` (moving `info` out of `index.ts`, which then imports it), and `games/infos.ts` exporting `GAME_INFOS: GameInfo[]` in the registry's order. Modify `src/App.tsx` and any client file importing `games/registry.ts` to use `GAME_INFOS`. House rules declarations (`CHESS_RULES` etc.) are data the client shows; if they live in `rules.ts`, move them to a small non-client file the info imports, so `info.ts` pulls in no rules logic.
- Test: `shared/categories.test.ts` style unit test `games/infos.test.ts`: `GAME_INFOS.map(i => i.id)` equals `GAMES.map(g => g.info.id)` and each info is the same object as the registry's.
- [ ] Steps: failing test; implement; `npm test`; `npx vite build` and confirm with the build output (or `grep` in `dist/assets`) that `applyMove` code from a rules file is no longer in the main chunk; commit `Give the client game metadata without rules code`.

### Task 2: Client game loader

**Files:** Create `src/games/loadClientGame.ts`, `src/games/useClientGame.ts`; modify `src/clientGames.ts`; test `src/games/loadClientGame.test.ts`

**Interfaces:**
- `src/clientGames.ts` keeps the `ClientGame`, `FaqItem`, `GameScreenProps` types and drops `CLIENT_GAMES`. New eager map `GAME_ICONS: Record<string, string>` (the icon moves out of each `client/index.ts` into this map or into the game's `info.ts`, whichever is simpler; the landing cards need it eagerly).
- `CLIENT_LOADERS: Record<string, () => Promise<ClientGame>>` with one `() => import('../../games/<id>/client/index.ts').then(m => m.<id>Client)` per game.
- `loadClientGame(id: string, loaders = CLIENT_LOADERS): Promise<ClientGame>`: one shared promise per id; a rejected load is forgotten so the next call retries; unknown id rejects with `Error('Unknown game "<id>"')`.
- `useClientGame(id: string | null): { status: 'idle' | 'loading' | 'ready' | 'error'; client: ClientGame | null; retry: () => void }`.
- `<ClientGameGate id name children={(client) => ReactNode} />` renders "Loading <name>..." (only after 200 ms, to avoid a flash), "Could not load <name>" with a Retry button, or children.
- [ ] **Step 1: Failing tests** with fake loaders: two calls share one loader call; a rejecting loader rejects, then a second call calls the loader again and resolves; unknown id rejects with the message above.
- [ ] Steps 2 to 5: run, implement, pass, commit `Load each game's client on demand`.

### Task 3: Use the loader everywhere

**Files:** Modify `src/App.tsx` (drop `PLAYABLE_GAMES` startup check; replace with a unit test that every `GAME_INFOS` id has a loader and an icon), `GameList.tsx`, `JoinDialog.tsx` (start loading when the dialog opens; the FAQ button waits on it), `GameView.tsx`, `HistoryButton.tsx`/`HistoryDialog.tsx`, `OpenSavedGame.tsx`, `PlayableGame` users; update any unit tests importing `CLIENT_GAMES`.
- Test: `e2e/lazyLoading.spec.ts`: record requested URLs; open the landing page and a chess game; no requested JS or CSS file name contains `catan`; then open a Catan join dialog and a request for a catan chunk appears. Use `page.route` to fail a game's chunk once: "Could not load" and Retry, then Retry succeeds and the join dialog works.
- [ ] Steps: failing e2e; implement; e2e passes; commit `Open games through the on-demand loader`.

### Task 4: Measure, PWA, docs, full suite

- [ ] Record main bundle size (JS and CSS, raw and gzip from `npx vite build`) on master and on this branch, and the largest game chunk.
- [ ] Check `public/sw.js` caching for hashed chunks and `index.html` (network first for navigation); fix if a stale shell could request deleted chunks.
- [ ] Confirm shared components are not duplicated: inspect `dist/assets` names or use `build.rollupOptions.output.manualChunks` only if Vite duplicates them.
- [ ] Update `docs/architecture.md` (Client registry, Contracts: `ClientGame`, loader, metadata files).
- [ ] Full e2e (`E2E_PORT_BASE=6150 npx playwright test --workers=3`), browser check with network requests showing only the chess chunk for a chess game, and History in two games. Commit, open the PR titled "Load each game's code on demand" with the size table.

# Charades and Fictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two traditional party games: Charades (act out a prompt on the group's own cameras while everyone else guesses in the chat) and Fictionary (write fake definitions of a rare real word, then vote for the real one).

**Architecture:** First, Pictionary's turn machine (choosing, guessing, reveal), its chat-as-guessing and its scoring move out of `games/pictionary/` into one module both games import, `shared/guessing/`, with Pictionary's behavior unchanged and its existing tests as the proof. Charades is then that module with its own prompts, house rules and words in the texts, and no canvas. Fictionary is a round game with no turns: writing and voting are game actions on a server clock, and the reveal uses `shared/rounds.ts` for Continue. All match guesses with `shared/guess.ts`, keep their content lists server-side, and hide every secret in `toPublicState`, `privateSeatView` and `secretState`.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Goals", "Rules for every agent", "Shared ground", "Charades" and "Fictionary". Model game: `games/pictionary/` (read all of it before Task 2). House style: `docs/superpowers/plans/2026-10-31-18-codebreaker.md`. Coordinator decision (2026-11-07): extract the shared logic rather than copy it (DRY); this chunk may touch `games/pictionary/` and the new shared module for that.

**Branch:** `game-charades-fictionary` in its own worktree, from `party-games-and-polish`. Site `PORT=3403`, e2e `E2E_PORT_BASE=8300` (never 6000, Chrome refuses it). PR into `party-games-and-polish`.

## Global Constraints

- Shared code location (owner's decision): the guessing rules live in `shared/guessing/` and the shared guessing components in `src/components/guessing/`, so nothing under `games/` looks like a game that is not one. `shared/guessing/` imports no React and nothing from `games/` or `src/`; `src/components/guessing/` imports nothing from `games/`.

- Charades: id `charades`, category `'party'`, 2 to 10 players. Fictionary: id `fictionary`, category `'party'`, 3 to 8 players.
- Charades: "Scoring, phases, chat audience and house rules (time per turn, number of choices, turns per player) copy Pictionary's, and the game sets `ownTurnLimit`." Guesses use the shared guess matching with close-guess hints as in Pictionary. Guessers see the masked prompt (word lengths, as Pictionary's mask does); the actor's screen shows the prompt large.
- Charades prompt list: "at least 300 actable prompts (actions, animals, jobs, sports, everyday phrases), kept server-side as Pictionary's words are."
- Pictionary is unchanged by the extraction: every `*.test.ts` under `games/pictionary/`, and `e2e/pictionary.spec.ts`, is byte for byte unchanged and passes. Its player-visible texts, CSS class names and element ids stay as they are.
- `shared/guessing/` imports nothing from `games/pictionary/` or `games/charades/` (wave 2 renames the Pictionary folder; the shared module must not care).
- Fictionary scoring: "2 points for voting for the real definition; 1 point to an author for each vote their fake gets. If a player's submission matches the real definition closely enough (the shared guess matching on normalized text), they get 3 points and their entry is not shown as a separate choice." Votes are "never their own".
- Fictionary house rules: "number of words (5, 8 or 10; standard 8) and writing time (60, 90, 120 or 180 s; standard 120). Writing and voting end early once everyone has submitted." No dealer: the game holds the real definition.
- Fictionary word list: "at least 200 real, rare words with short accurate definitions. Each definition is checked against a dictionary while it is written; a wrong definition is a bug." Definitions are written in this project's own words, never copied from a dictionary.
- Hidden: "the Charades prompt, Fictionary's real definition and the authors of each definition" never reach a browser that should not see them, including History (`viewer: null`), game files, `lastMove`, `gameStatus`, a table screen and spectators where stated.
- Undo: Charades turn moves (choose, scoring guess, timeouts) are undoable by vote, as Pictionary's. Fictionary has no turn moves; writing, voting and Continue are game actions and it sets `allowsUndoVote: () => false` (see Task 10).
- Rules from Wikipedia's [Charades](https://en.wikipedia.org/wiki/Charades) and [Fictionary](https://en.wikipedia.org/wiki/Fictionary) articles; each README lists every difference under "Differences from Wikipedia" in the format of `games/rook/README.md`. Where the spec disagrees with Wikipedia, the spec wins.
- The commercial names "Balderdash" and "Pictionary" never appear in any file of `games/charades/`, `games/fictionary/` or `shared/guessing/` or the two new e2e specs (tests in Tasks 2, 3 and 8 enforce it). No text, name or prompt is copied from a commercial game.
- Files outside the game folders: the refactor of `games/pictionary/` and the new `shared/guessing/` and `src/components/guessing/` (Task 2); otherwise one-line entries only, in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `shared/categories.test.ts` (the `party` list and the grouped count, 42 today), `games/secretState.test.ts` (`WITH_SECRET`), `games/privateSeatView.test.ts` (`CASES`), plus `e2e/charades.spec.ts` and `e2e/fictionary.spec.ts`. Do NOT edit the root `README.md` game list or count, `e2e/landing.spec.ts` or `docs/architecture.md`; the coordinator does. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`; if a platform or fixture change seems needed, stop and report it.
- New specs reach header controls (History, Share, Rules, Hide, Pause, Settings, Theme) only through `headerButton(page, name)` from `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, READMEs, FAQs or commit messages.
- Every commit message ends with these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

## Review Focus

1. A Fictionary player types the real definition with different capitals and punctuation ("A small boat, rowed with one oar.") or one typo: they score 3, their entry is not a choice, and they cannot vote (they know the answer). Two players typing the same fake see one choice, credited to both (Task 8 and Task 10).
2. A Fictionary writing phase ends with nobody having written a fake: voting is skipped and the reveal follows, rather than a vote with one choice handing out free points (Task 10).
3. A History step, a downloaded game file, a table screen or the raw WebSocket frames during Fictionary voting show who wrote which choice or which one is real: the null view carries only choice texts (Task 11, e2e Task 13).
4. A Fictionary dismissal leaves 2 players: the game ends at once with the scores as they stand, instead of a vote between the real definition and one fake (Task 10).
5. The extraction changes a Pictionary text, class name or timing that no unit test reads (the drawer's placeholder `You are drawing`, the `Only players who guessed can see this` tag, `.pictionary-chat`): `e2e/pictionary.spec.ts` must pass unchanged (Task 2). And the Charades actor's prompt typed in the chat reaches only players who already guessed (Task 4, e2e Task 7).

---

### Task 1: Worktree, branch and ports

**Files:** none in the repo.

- [ ] **Step 1: Create the worktree** from the main checkout:
  ```bash
  git fetch origin
  git worktree add ../multiplayer-tabletop-games-charades-fictionary -b game-charades-fictionary origin/party-games-and-polish
  cd ../multiplayer-tabletop-games-charades-fictionary
  npm ci
  ```
  If `node` is missing from PATH (the nvm symlink `C:\nvm4w\nodejs` has gone missing before), prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH.
- [ ] **Step 2: Confirm the ports are free:** `netstat -ano | grep -E ':(3403|830[0-9])\s'` prints nothing. If one is taken, pick another pair (never 6000) and use it everywhere this plan says 3403 or 8300.
- [ ] **Step 3: Confirm the base is green:** `npm test && npm run typecheck`, then `npx vite build && E2E_SKIP_BUILD=1 E2E_PORT_BASE=8300 npx playwright test --workers=2 e2e/pictionary.spec.ts`. Expected: PASS. This Pictionary run is the baseline Task 2 must match.

### Task 2: Extract the guessing game from Pictionary

**Files:**
- Create: `shared/guessing/types.ts`, `shared/guessing/clock.ts`, `shared/guessing/turns.ts`, `src/components/guessing/Chat.tsx`, `src/components/guessing/Blanks.tsx`, `src/components/guessing/Scores.tsx`, `src/components/guessing/GameStatus.tsx`
- Modify: `games/pictionary/types.ts`, `games/pictionary/clock.ts`, `games/pictionary/rules.ts`, `games/pictionary/client/GameScreen.tsx`, `games/pictionary/client/HistoryBoard.tsx`
- Delete: `games/pictionary/client/Chat.tsx`, `Blanks.tsx`, `Scores.tsx`, `GameStatus.tsx` (their callers import the shared ones)
- Test: new `shared/guessing/turns.test.ts`; the proof is the unchanged `games/pictionary/*.test.ts`, `games/pictionary/client/*.test.ts`, `games/privateSeatView.test.ts`, `games/secretState.test.ts` and `e2e/pictionary.spec.ts`

**Interfaces:**
- Produces (`shared/guessing/types.ts`). The field names stay Pictionary's, so Pictionary's tests and saved games read the same; in Charades `drawer` is the actor, `word` the prompt and phase `'drawing'` is acting.
  ```ts
  type Phase = 'choosing' | 'drawing' | 'reveal';
  type ChatLine = { id: number; kind: 'chat' | 'guessed' | 'close' | 'system'; seat: Seat | null; text: string; audience: 'all' | 'guessed' | Seat };
  type GuessLastMove =
    | { type: 'choose'; playerNumber: Seat } | { type: 'guess'; playerNumber: Seat; points: number }
    | { type: 'reveal'; word: string; reason: 'allGuessed' | 'timeUp' | 'drawerLeft' }
    | { type: 'nextTurn'; playerNumber: Seat } | { type: 'autoChoose'; playerNumber: Seat };
  type GuessState = BaseGameState & {
    phase: Phase; deck: string[]; wordChoices: string[]; word: string | null; drawer: Seat | null;
    phaseStartedAt: number | null; guessed: Seat[]; scores: Record<Seat, number>; draws: Record<Seat, number>;
    chat: ChatLine[]; nextChatId: number; lastMove: GuessLastMove | null;
  };
  type GuessPublic<S extends GuessState> = Omit<S, 'deck' | 'wordChoices' | 'word' | 'chat'> & BasePublicState & {
    mask: string; word: string | null; wordChoices: string[]; chat: ChatLine[];
  };
  ```
  `games/pictionary/types.ts` keeps exporting `Phase`, `ChatLine`, `LastMove`, `GameState` (`GuessState` plus `strokes` and `nextStrokeId`), `PublicGameState` (`GuessPublic<GameState>`), `Stroke`, `Tool`, `Result`, `Seat`, `UndoVote`.
- Produces (`shared/guessing/clock.ts`): `CHOOSE_MS = 20_000`, `REVEAL_MS = 5_000`, `phaseMs(state, turnSeconds: ChoiceRule<number>)`, `phaseDeadline(state, turnSeconds)`. `games/pictionary/clock.ts` re-exports `CHOOSE_MS` and `REVEAL_MS`, binds `phaseMs` and `phaseDeadline` to its `TURN_SECONDS`, and keeps its canvas constants.
- Produces (`shared/guessing/turns.ts`): `DRAWER_POINTS = 25`, `guesserPoints(msLeft, turnMs)`, and
  ```ts
  type GuessConfig<S extends GuessState> = {
    words: readonly string[];
    turnSeconds: ChoiceRule<number>; choices: ChoiceRule<number>; turnsPerPlayer: ChoiceRule<number>;
    noun: string;  // 'word' or 'prompt', in every text
    verb: string;  // 'drawing' or 'acting', in the status
    freshTurn(state: S): Partial<S>; // the game's own fields cleared when guessing starts (Pictionary: strokes)
  };
  function guessGame<S extends GuessState>(config: GuessConfig<S>): {
    guessFields(): Omit<GuessState, keyof BaseGameState>;
    resetLobby(state: S, random: Random): S;
    applyMove(state: S, seat: Seat, move: unknown, random: Random, now: number): Result<S>;
    chatAction(state: S, seat: Seat, action: unknown, now: number): Result<S>;
    recordsAction(state: S, seat: Seat, action: unknown): boolean;
    deadline(state: S): number | null;
    onDeadline(state: S, now: number, random: Random): S;
    resumeClock(state: S, now: number): S;
    onPlayerLeft(state: S, seat: Seat, random: Random): S;
    toPublicState(state: S, undoAvailable: boolean, viewer: Seat | null): Omit<GuessPublic<S>, 'moveCount'>;
    privateSeatView(state: S, seat: Seat): Pick<GuessPublic<S>, 'word' | 'wordChoices' | 'chat'>;
    spectatorState(state: S, undoAvailable: boolean, tableScreen: boolean): Omit<GuessPublic<S>, 'moveCount'>;
    finalStandings(state: S): Standing[];
  };
  ```
  Every text that names the word uses `noun` (`<name> guessed the ${noun}!`, `The ${noun} was <word>`, `<name> is choosing a ${noun}`, `You can choose a ${noun} only at the start of your turn`, `Invalid ${noun} choice`, `<name> ran out of time, so a ${noun} was chosen for them`), and the guessing status is `<name> is ${verb}`, so `noun: 'word', verb: 'drawing'` gives Pictionary's exact strings.
- `games/pictionary/rules.ts` becomes `const game = guessGame<GameState>({ words: WORDS, turnSeconds: TURN_SECONDS, choices: WORD_CHOICES, turnsPerPlayer: DRAWS_PER_PLAYER, noun: 'word', verb: 'drawing', freshTurn: () => ({ strokes: [] }) })`. It re-exports every name its tests and `index.ts` import (`DRAWER_POINTS`, `guesserPoints`, `resetLobby`, `applyMove`, `recordsAction`, `deadline`, `onDeadline`, `resumeClock`, `onPlayerLeft`, `toPublicState`, `privateSeatView`, `spectatorState`, `finalStandings`) and keeps only its own `createGameState` (`{ ...baseGameState(id), ...game.guessFields(), strokes: [], nextStrokeId: 1 }`) and `applyAction` (stroke actions as today, then `game.chatAction`).
- Shared client components (props carry what differs; everything else is Pictionary's markup as it is):
  - `Chat({ gameState, playerNumber, inputId, className, busyPlaceholder })` and `ChatLines({ gameState, listRef? })`; Pictionary passes `pictionary-chat-input`, `pictionary-chat`, `You are drawing`.
  - `Blanks({ mask, word, className })`; Pictionary passes `pictionary-blanks`.
  - `Scores({ gameState, playerNumber, busyNote })`; Pictionary passes `drawing`.
  - `GameStatus({ gameState, playerNumber, error, deadline, texts })` with `texts: { choose: string; choosing(name: string): string; busy(word: string): string; busyOther(name: string): string; was(word: string): string }`; Pictionary passes its current strings (`Choose a word to draw`, `<name> is choosing a word`, `Draw <word>`, `<name> is drawing`, `The word was <word>`) and `deadline = phaseDeadline(gameState)`.

- [ ] **Step 1: Write the new test** `shared/guessing/turns.test.ts`, for what only the config decides (a game built with `guessGame` over `['juggling flamingos', 'knitting a scarf', 'walking on stilts']`, `noun: 'prompt'`, `verb: 'acting'`, Pictionary's rule objects passed in as test fixtures):
  - `'texts use the noun and verb'`: choosing status `Alice is choosing a prompt`; after `choose`, `Alice is acting`; a correct guess's line `Bob guessed the prompt!`; the reveal `The prompt was juggling flamingos`; a bad index `{ error: 'Invalid prompt choice' }`.
  - `'freshTurn runs when guessing starts'`: with `freshTurn: () => ({ marker: 0 })` on a state holding `marker: 5`, `choose` gives `marker === 0`.
  - `'the module imports no game folder and names no commercial game'`: no file in `shared/guessing/` matches `/(pictionary|charades)\//` in an import or `/pictionary|balderdash/i` anywhere.
- [ ] **Step 2: Run** `node --test shared/guessing/turns.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Move the code.** Cut the turn, chat, scoring, view and standings code from `games/pictionary/rules.ts` into `shared/guessing/turns.ts` behind `guessGame`, replacing the hard-coded rules, word list and texts with the config; move the four client components the same way. No behavior change: same statuses, audiences, deadline arithmetic and field order.
- [ ] **Step 4: Run** `node --test shared/guessing/*.test.ts games/pictionary/*.test.ts games/pictionary/client/*.test.ts games/*.test.ts src/games/*.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Run** `npx vite build && E2E_SKIP_BUILD=1 E2E_PORT_BASE=8300 npx playwright test --workers=2 e2e/pictionary.spec.ts`. Expected: PASS, as in Task 1 Step 3.
- [ ] **Step 6: Confirm the proof is untouched:** `git diff --stat -- 'games/pictionary/*.test.ts' 'games/pictionary/client/*.test.ts' e2e/pictionary.spec.ts` prints nothing.
- [ ] **Step 7: Commit** `Pictionary: move the guessing turn into shared/guessing`.

### Task 3: Charades options, info, types and prompts

**Files:**
- Create: `games/charades/options.ts`, `games/charades/info.ts`, `games/charades/types.ts`, `games/charades/prompts.ts`
- Test: `games/charades/prompts.test.ts`

**Interfaces:**
- Produces (`options.ts`), the shape of `games/pictionary/options.ts`:
  - `TURN_SECONDS: ChoiceRule<30 | 60 | 90 | 120 | 180>`: id `turnSeconds`, label `Time per turn`, standard 90, labels `30 seconds`, `1 minute`, `90 seconds`, `2 minutes`, `3 minutes`.
  - `PROMPT_CHOICES: ChoiceRule<3 | 4 | 5>`: id `promptChoices`, label `Prompt choices`, standard 3, labels `3 prompts`, `4 prompts`, `5 prompts`.
  - `TURNS_PER_PLAYER: ChoiceRule<1 | 2 | 3 | 4 | 5>`: id `turnsPerPlayer`, label `Turns per player`, standard 3, labels `1 turn` to `5 turns`.
  - `CHARADES_RULES: HouseRule[] = [TURN_SECONDS, PROMPT_CHOICES, TURNS_PER_PLAYER]`
- Produces (`info.ts`): `charadesInfo: GameInfo` with `id: 'charades'`, `category: 'party'`, `name: 'Charades'`, description `Act out a prompt on camera while everyone else races to guess it in the chat`, `minPlayers: 2`, `maxPlayers: 10`, `houseRules: CHARADES_RULES`, `ownTurnLimit: true`, `passAndPlay: false`.
- Produces (`types.ts`): `type GameState = GuessState`, `type PublicGameState = GuessPublic<GameState>`, re-exporting `ChatLine`, `Phase`, `GuessLastMove as LastMove` and `Seat`. No fields of its own.
- Produces (`prompts.ts`): `PROMPTS: readonly string[]`, imported only by `rules.ts`.

- [ ] **Step 1: Write the failing tests** in `prompts.test.ts`:
  - `'every prompt is lowercase letters, single spaces or hyphens'`: each matches `/^[a-z]+([ -][a-z]+)*$/` (so `maskOf` gives word lengths only).
  - `'the list has at least 300 prompts and no two match each other'`: `PROMPTS.length >= 300`; `new Set(PROMPTS.map(normalize)).size === PROMPTS.length` (`normalize` from `shared/guess.ts`, so "ice-cream" and "ice cream" count as one).
  - `'no client file imports rules.ts or prompts.ts'`: as `games/pictionary/words.test.ts`, with `/from '\.\.\/(rules|prompts)\.ts'/`.
  - `'no file of the game names a commercial game'`: walk `games/charades/` and read `e2e/charades.spec.ts` when it exists; none matches `/pictionary|balderdash/i`.
- [ ] **Step 2: Run** `node --test games/charades/*.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Write the four files.** The prompts are written fresh: at least 300 actable prompts grouped by comment (actions, animals, jobs, sports, everyday phrases), each something a person can act out silently on a webcam from the waist up. Add the distinctive test prompts `juggling flamingos`, `knitting a scarf` and `walking on stilts` at the end, under a comment saying the tests patch them in.
- [ ] **Step 4: Run** `node --test games/charades/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Charades: options, types and prompts`.

### Task 4: Charades rules, registration and manager test

**Files:**
- Create: `games/charades/clock.ts`, `games/charades/rules.ts`, `games/charades/index.ts`
- Test: `games/charades/rules.test.ts`, `games/charades/manager.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `shared/categories.test.ts` (`'charades'` in `party`; the grouped count goes up by 1), `games/secretState.test.ts` (`'charades'` in `WITH_SECRET`), `games/privateSeatView.test.ts` (a `charades` entry in `CASES`: the `pictionary` entry's two states with Charades prompts)

**Interfaces:**
- Consumes: Task 2 (`guessGame`, `phaseDeadline`), Task 3.
- Produces (`clock.ts`): `phaseDeadline(state)` bound to Charades' `TURN_SECONDS`, for the client.
- Produces (`rules.ts`): `const game = guessGame<GameState>({ words: PROMPTS, turnSeconds: TURN_SECONDS, choices: PROMPT_CHOICES, turnsPerPlayer: TURNS_PER_PLAYER, noun: 'prompt', verb: 'acting', freshTurn: () => ({}) })`; `createGameState(id)` is `{ ...baseGameState(id), ...game.guessFields() }`; `applyAction` refuses any type but `chat` with `Invalid action`, then calls `game.chatAction`. Every other hook is the module's.
- Produces (`index.ts`): `charades: GameDefinition<GameState, PublicGameState>` wiring the same hooks as `games/pictionary/index.ts`, `spectatorsSeeEverySeat: true`, `secretState: state => seatFields(state, ['deck'])`.

The shared behavior is proven by Pictionary's tests; these cover what Charades' config decides and what a regular player would notice.

- [ ] **Step 1: Write the failing tests** (Alice, Bob and Cara, with `wordChoices: ['juggling flamingos', 'knitting a scarf', 'walking on stilts']`):
  - `'the actor is offered promptChoices prompts'`: with `promptChoices: 5`, 5 distinct prompts from `PROMPTS`.
  - `'a multi-word prompt is guessed by its words in order, with any spacing or hyphens'`: acting `juggling flamingos`, Bob's `is it Juggling-Flamingos?` scores; Cara's `flamingos juggling` does not.
  - `'the actor cannot score by typing the prompt'`: the actor's `juggling flamingos` is a `chat` line with audience `'guessed'` and `guessed` stays `[]`.
  - `'each player acts turnsPerPlayer times, then the highest score wins'`: with `turnsPerPlayer: 1`, actors 1, 2, 3, then over with the status `<names> won with <n> points`.
  - `'a guesser and History never see the prompt before the reveal; a spectator does, a table screen does not'`: views for seat 2, `null` and `spectatorView` with `tableScreen: true` hold no `juggling`; `spectatorView` with `tableScreen: false` holds it.
  - `manager.test.ts`: `'the turn times out on the server clock'` (89_999 ms: still acting; 1 ms more: reveal) and `'no history step carries the prompt during acting'` (`stepsOf(manager, 'charades')`).
- [ ] **Step 2: Run** `node --test games/charades/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the three files and the one-line registrations.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (no loader or icon yet; Task 5 adds them).
- [ ] **Step 5: Commit** `Charades: rules and registration`.

### Task 5: Charades client

**Files:**
- Create in `games/charades/client/`: `GameScreen.tsx`, `PromptCard.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `charades.scss`
- Modify: `src/clientGames.ts` (one loader line), `shared/svg/gameIcons.ts` (one `charades` line: a figure with raised arms, drawn with `lineIcon` like its neighbors)
- Test: `games/charades/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState` (Task 3), `phaseDeadline` from `../clock.ts`, `Chat`, `ChatLines`, `Blanks`, `Scores`, `GameStatus` from `src/components/guessing/` (Task 2), `GameScreenProps`, `ClientGame`, `gameService.makeMove`, `requestUndo`, `voteUndo`, `UndoVote`.
- Produces: `charadesClient: ClientGame` with `id`, `Screen`, `HistoryBoard`, `describeMove`, `faq`.

Decisions:
- The shared components get `inputId` `charades-chat-input`, `className` `charades-chat` and `charades-blanks`, `busyPlaceholder` `You are acting`, `busyNote` `acting`, and the texts `Choose a prompt to act`, `<name> is choosing a prompt`, `Act out <prompt>`, `<name> is acting`, `The prompt was <prompt>`. The prompt choice group is `aria-label="Choose a prompt"`.
- `PromptCard`: shown only to the actor while acting, the prompt in large type (at least 2.5rem at laptop width, wrapping by word at phone width), `role="status"`, `aria-label="Your prompt"`. Guessers see `Blanks` where the card would be.
- `describeMove` texts: `Alice chose a prompt`; `Alice ran out of time, so a prompt was picked`; `Bob guessed the prompt (+85)`; `Everyone guessed it: juggling flamingos`; `Time ran out: the prompt was juggling flamingos`; `Alice left: the prompt was juggling flamingos`; `Cara's turn to act`; `''` before the first move.
- Layout: the prompt or blanks above, scores and chat beside them at laptop width, stacked below 640 px; the chat input stays reachable at 320 px. Scoped under `[data-game="charades"]` with light and dark tokens, as `pictionary.scss`.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts` asserting each text above exactly.
- [ ] **Step 2: Run** `node --test games/charades/client/describeMove.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client, the loader line and the icon line.
- [ ] **Step 4: Run** `node --test games/charades/**/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Charades: screen, history and FAQ`.

### Task 6: Charades README

**Files:**
- Create: `games/charades/README.md`

README decisions (sections Rules, Controls, Differences from Wikipedia, in `games/pictionary/README.md`'s Rules and Controls style and `games/rook/README.md`'s Differences format). Read the Charades article first and list what it actually says; the differences expected:
- No teams: every other player guesses for themselves, and faster guesses score more (the parlor game plays two teams against the clock).
- The actor picks from offered prompts the game wrote; in the parlor game the other team writes them.
- Guesses are typed in the chat and checked by the game; the parlor game shouts them.
- The masked prompt shows word lengths, replacing the finger signals for number of words and syllables.
- Cameras are the group's own call; the site has no video.
- Scoring (10 + 90 x the share of time left, 25 to the actor per correct guesser) and a fixed number of turns per player.

- [ ] **Step 1: Write the README**, ending Rules with the undo and leaving lines and the accepted risk that Undo after game over is possible as in every game.
- [ ] **Step 2: Commit** `Charades: README`.

### Task 7: Charades end-to-end tests

**Files:**
- Create: `e2e/charades.spec.ts`

**Interfaces:**
- Consumes: the labels of Task 5 and the README of Task 6; `seat`, `table.patch`, `table.state`, `inHouseRules`, `undo`, `dismiss`, `leave`, `openFaq`, `headerButton`, `tableScreen`, `watch` from `e2e/fixtures.ts`.

- [ ] **Step 1: Write `e2e/charades.spec.ts`**, one test per rule, control and difference in the README, as `e2e/pictionary.spec.ts` does, patching `wordChoices` with the three distinctive prompts. At least: the actor picks one of the offered prompts and guessers see none; Prompt choices 5 offers 5; the actor's page shows the prompt card and guessers see blanks with spaces and hyphens; a correct guess shows `Bob guessed the prompt!` and scores; a near guess shows `So close!` only to its sender; guessed-only chat; the actor's chat box is disabled while acting; time running out reveals (patch `phaseStartedAt: Date.now() - 89_500`); everyone guessing ends the turn early; the choosing deadline picks a prompt; the game ends after the turns per player with the highest score winning; Undo after a guess, approved; dismissing the actor reveals the prompt; a spectator sees the prompt and a table screen only the blanks; History (opened with `headerButton(page, 'History')`) during acting holds no prompt text; the raw WebSocket frames a guesser receives during acting never contain the prompt (`page.on('websocket', ws => ws.on('framereceived', ...))`); FAQ opens.
- [ ] **Step 2: Run** `npx vite build` then `E2E_SKIP_BUILD=1 E2E_PORT_BASE=8300 npx playwright test --workers=2 e2e/charades.spec.ts e2e/pictionary.spec.ts`. Expected: PASS.
- [ ] **Step 3: Commit** `Charades: end-to-end tests`.

### Task 8: Fictionary options, info, types and definition matching

**Files:**
- Create: `games/fictionary/options.ts`, `games/fictionary/info.ts`, `games/fictionary/types.ts`, `games/fictionary/clock.ts`, `games/fictionary/matching.ts`
- Test: `games/fictionary/matching.test.ts`, `games/fictionary/options.test.ts`

**Interfaces:**
- Produces (`options.ts`):
  - `WORD_COUNT: ChoiceRule<5 | 8 | 10>`: id `wordCount`, label `Number of words`, standard 8, labels `5 words`, `8 words`, `10 words`.
  - `WRITING_SECONDS: ChoiceRule<60 | 90 | 120 | 180>`: id `writingSeconds`, label `Writing time`, standard 120, labels `1 minute`, `90 seconds`, `2 minutes`, `3 minutes`.
  - `FICTIONARY_RULES: HouseRule[] = [WORD_COUNT, WRITING_SECONDS]`
- Produces (`info.ts`): `fictionaryInfo: GameInfo` with `id: 'fictionary'`, `category: 'party'`, `name: 'Fictionary'`, description `Invent a believable definition for a rare word, then spot the real one`, `minPlayers: 3`, `maxPlayers: 8`, `houseRules: FICTIONARY_RULES`, `ownTurnLimit: true`, `passAndPlay: false`.
- Produces (`clock.ts`): `VOTING_MS = 60_000`; `phaseMs(state)` (writing: `houseRule(state, WRITING_SECONDS) * 1000`; voting: `VOTING_MS`); `phaseDeadline(state)`: null in the lobby (`phaseStartedAt === null`), in `reveal`, and after the game.
- Produces (`types.ts`):
  ```ts
  type Entry = { word: string; definition: string };
  type Phase = 'writing' | 'voting' | 'reveal';
  type Choice = { text: string; authors: Seat[]; real: boolean }; // authors empty for the real one
  type Reveal = { acknowledged: Seat[] };                          // Acknowledgeable
  type LastMove =
    | { type: 'write'; playerNumber: Seat }
    | { type: 'closeWriting'; reason: 'allWritten' | 'timeUp' }
    | { type: 'vote'; playerNumber: Seat }
    | { type: 'reveal'; word: string; definition: string }
    | { type: 'nextWord'; round: number };
  type GameState = BaseGameState & {
    phase: Phase; deck: Entry[]; round: number;         // 1-based
    word: string; definition: string;                   // the current entry; the definition is the secret
    phaseStartedAt: number | null;
    submissions: Partial<Record<Seat, string>>;          // private until the reveal
    matched: Seat[];                                     // wrote the real definition; public from voting on
    choices: Choice[];                                   // shuffled when writing closes
    votes: Partial<Record<Seat, number>>;                // choice index; private until the reveal
    roundPoints: Partial<Record<Seat, number>>;          // this word's points, set at the reveal
    scores: Record<Seat, number>;
    reveal: Reveal | null;
    lastMove: LastMove | null;
  };
  type ShownChoice = { text: string; authors?: Seat[]; real?: boolean }; // authors and real only from the reveal
  type PublicGameState = Omit<GameState, 'deck' | 'definition' | 'submissions' | 'choices' | 'votes'> & BasePublicState & {
    definition: string | null;   // from the reveal on
    written: Seat[];             // who has a submission (writing)
    submission: string | null;   // the viewer's own
    choices: ShownChoice[];
    ownChoice: number | null;    // the viewer's own fake, which they may not vote for
    voted: Seat[];
    myVote: number | null;
    votes: Partial<Record<Seat, number>>; // every vote from the reveal on, else {}
  };
  ```
- Produces (`matching.ts`):
  - `matchesDefinition(submission: string, definition: string): boolean`: replace every character of `definition` that is not a letter, space, apostrophe or hyphen with a space, then `isCorrect(submission, target) || isClose(submission, target)` from `shared/guess.ts`.
  - `sameText(a: string, b: string): boolean`: `normalize` of each with every non-letter removed, equal and non-empty.

- [ ] **Step 1: Write the failing tests.** `matching.test.ts`, `'matchesDefinition accepts the real definition however it is typed'`, as a table of `[submission, definition, expected]`:
  - `a small boat rowed with one oar` / `a small boat rowed with one oar`: true
  - `A Small Boat, rowed with one oar.` / `a small boat rowed with one oar`: true
  - `a smal boat rowed with one oar` / same: true (one letter)
  - `small boat rowed with one oar` / same: true (the dropped `a` is one letter)
  - `it is a small boat rowed with one oar I think` / same: true (contains it)
  - `a rowing boat for one person` / same: false
  - `a small boat` / same: false
  - `   ` / same: false
  - `a fear of long words` / `a fear of long words, often jokingly` : false (target longer)

  `'sameText ignores capitals, spaces and punctuation'`: `sameText('A cheese.', 'a  cheese')` true; `sameText('a cheese', 'cheeses')` false; `sameText('!!', '?')` false.
  `options.test.ts`: `'house rules default to 8 words and 2 minutes'` (`standardOf`); `'no file of the game names a commercial game'`: walk `games/fictionary/` and read `e2e/fictionary.spec.ts` when it exists; none matches `/balderdash|pictionary/i`.
- [ ] **Step 2: Run** `node --test games/fictionary/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the five files.
- [ ] **Step 4: Run** `node --test games/fictionary/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Fictionary: options, types and definition matching`.

### Task 9: Fictionary word list

**Files:**
- Create: `games/fictionary/words.ts`
- Test: `games/fictionary/words.test.ts`

**Interfaces:**
- Produces: `WORDS: readonly Entry[]`, imported only by `rules.ts`.

- [ ] **Step 1: Write the failing tests** in `words.test.ts`:
  - `'the list has at least 200 entries with no repeated word or definition'`: `WORDS.length >= 200`; words unique; no two definitions `sameText`.
  - `'every word is one lowercase word'`: matches `/^[a-z]+(-[a-z]+)?$/`.
  - `'every definition is short and plain'`: 10 to 100 characters, starts lowercase, no trailing period, matches `/^[a-z0-9 ,;'()-]+$/`.
  - `'no definition contains its own word'`: no definition has its word at the start of one of its words (a regex of `\b` plus the word), so `ort` may still appear in `short`.
  - `'no client file imports rules.ts or words.ts'`.
- [ ] **Step 2: Run** `node --test games/fictionary/words.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the list.** At least 200 real English words that most players will not know (archaic, technical or regional words found in a general dictionary; no proper nouns, no slurs or crude words, nothing a player would recognize from everyday speech). For each one, look the word up in a dictionary while writing it (Merriam-Webster, Collins or Wiktionary online, through WebFetch or WebSearch), confirm the sense, and write a short definition in your own words; never paste a dictionary's wording. Drop any word whose meaning the dictionaries disagree on. Keep a scratch list (outside the repo) of word, dictionary and URL, and put the dictionaries used in the README (Task 13).
- [ ] **Step 4: Run** `node --test games/fictionary/words.test.ts`. Expected: PASS.
- [ ] **Step 5: Spot check.** Pick 20 entries at random (`node -e` with `Math.random` over `WORDS`) and check each against a second dictionary. Any wrong or misleading definition is fixed, and its neighbors from the same writing session are rechecked.
- [ ] **Step 6: Commit** `Fictionary: word list`.

### Task 10: Fictionary rules

**Files:**
- Create: `games/fictionary/rules.ts`
- Test: `games/fictionary/rules.test.ts`

**Interfaces:**
- Consumes: Tasks 8 and 9; `acknowledge`, `awaiting`, `everyoneReady`, `type RoundAccess` from `shared/rounds.ts`; `rankStandings`, `pointsText` from `shared/standings.ts`; `shuffle`; `houseRule`.
- Produces (`rules.ts`): `createGameState(gameId)`, `resetLobby(state, random)`, `applyMove` (always `{ error: 'Fictionary has no turns' }`), `applyAction(state, seat, action, random, now)`, `recordsAction(state, seat, action): boolean`, `allowsUndoVote(): false`, `deadline(state)`, `onDeadline(state, now, random)`, `resumeClock(state, now)`, `onPlayerLeft(state, seat, random)`, `onPlayerDisconnected(state, seat, random)`, `waitingOn(state)`, `finalStandings(state)`, `voters(state): Seat[]` (active seats not in `matched`).
- Actions: `{ type: 'write', text: string }` (1 to 150 characters after trimming), `{ type: 'vote', choice: number }`, `{ type: 'continue' }`.

Decisions:
- `resetLobby`: `deck` is `shuffle(WORDS)` cut to `houseRule(state, WORD_COUNT)`; round 1's entry is `deck[0]` (kept in `deck` too; `word` and `definition` copy it); `phase: 'writing'`, `phaseStartedAt: null`, `currentPlayer: null`, scores zero, everything else empty.
- Every action is refused `Wait for everyone to agree to the house rules` while `phaseStartedAt === null`, and `The game is over` after it. The clock starts from `resumeClock` on the last agreement, as Pictionary's.
- `write` during `writing` by an active seat stores (or replaces) the trimmed text; status `<name> wrote a definition`. When every active seat has a submission, writing closes (`allWritten`). Errors: `Definitions are 1 to 150 characters`, `Writing is over`.
- Closing writing (`allWritten` or the deadline, `timeUp`): seats whose submission `matchesDefinition` go in `matched`; the other non-empty submissions become choices, merged when `sameText` (one choice, every author listed); the real definition is one more choice; the list is shuffled with `random`. If no fake choice exists or `voters` is empty, voting is skipped and the reveal follows at once. Otherwise `phase: 'voting'`, `phaseStartedAt: now`, status `Vote for the real definition` (plus ` (<names> wrote the real one)` when `matched` is non-empty).
- `vote` during `voting` by a seat in `voters`: stores or replaces the index. Errors: `You already know the real definition` (seat in `matched`), `You cannot vote for your own definition` (seat among the choice's `authors`), `Invalid choice`, `Voting is over`. When every voter has voted, the reveal follows; so does the voting deadline.
- Reveal: `roundPoints` is 3 for each matched seat, plus 2 for a vote on the real choice, plus 1 to every author of a fake per vote it got; added to `scores`. `reveal: { acknowledged: [] }`, `lastMove: { type: 'reveal', word, definition }`, status `The real definition of <word>: <definition>`. On the last round (`round === deck.length`) the game ends here instead: `isGameOver`, `winners` the top scorers, status `<names> won with <n> points`, `reveal: null`.
- `continue` goes through `acknowledge` with `RoundAccess` (`noun: 'word'`); everyone ready starts the next round: `round + 1`, the next entry, empty `submissions`, `matched`, `choices`, `votes`, `roundPoints`, `phase: 'writing'`, `phaseStartedAt: now`, `lastMove: { type: 'nextWord', round }`.
- `recordsAction`: true for any action with a known `type` while `phaseStartedAt !== null` and not over (an invalid one is refused by `applyAction` and so not recorded). The first recorded action marks the game started.
- `allowsUndoVote` is false: there is no turn move to undo, and undoing a reveal would hand voters the answer.
- `onPlayerLeft` (a dismissal): with fewer than 3 active seats the game ends at once with `winners` the top scorers among them and status `Not enough players left: <names> won with <n> points`. Otherwise the leaver's submission and vote are dropped (a choice they wrote stays on the list), and the early-close checks run again (writing complete, voting complete, `everyoneReady`).
- `onPlayerDisconnected`: `everyoneReady` re-check during the reveal only.
- `waitingOn`: writing, active seats with no submission; voting, voters with no vote; reveal, `awaiting`.
- `finalStandings`: `rankStandings` by score descending, `pointsText`.

- [ ] **Step 1: Write the failing tests** (three seats Alice, Bob, Cara via `addPlayer` with `withRules`, the entry patched to `{ word: 'quillon', definition: 'either arm of the cross guard of a sword' }`, `phaseStartedAt: NOW`; helpers `write`, `vote`, `cont` around `applyAction`):
  - `'an action before the clock starts is refused'`.
  - `'writing closes once everyone has written, and the choices are the fakes plus the real one'`: three different fakes: `phase === 'voting'`, 4 choices, exactly one `real`, `lastMove` `closeWriting` `allWritten`.
  - `'a submission matching the real definition scores 3 and is not a choice'`: Bob writes `Either arm of the cross-guard of a sword.`: `matched` is `[2]`, 3 choices; a vote from Bob is `{ error: 'You already know the real definition' }`; after Alice and Cara vote, `roundPoints[2] >= 3`.
  - `'identical fakes become one choice with both authors'`: Alice and Cara write `a small bird`, `a Small Bird.`: one choice with `authors: [1, 3]`; Cara's vote for it is refused; Bob's vote for it gives Alice and Cara 1 each.
  - `'scoring: 2 for the real one, 1 per vote to each author'`: Alice and Bob vote real, Cara votes Alice's fake: `roundPoints` `{ 1: 3, 2: 2, 3: 0 }`.
  - `'a vote for your own definition or a bad index is refused'`.
  - `'voting ends early once every voter has voted, else on its deadline'`: `deadline` is `NOW + 120_000` while writing and `phaseStartedAt + 60_000` while voting; `onDeadline` in voting gives the reveal with the votes cast so far.
  - `'writing time ending with no fakes skips voting'`: `onDeadline` with no submissions gives `phase === 'reveal'` and `roundPoints` all 0.
  - `'Continue waits for everyone, then the next word'`: `waitingOn` `[1, 2, 3]`, then `[2, 3]`; after all three, `round === 2`, `phase === 'writing'`, new `word`.
  - `'the last word ends the game at its reveal'`: with `wordCount: 5`, after round 5's votes `isGameOver`, `winners` the top scorers, `reveal === null`.
  - `'a dismissal down to two players ends the game with the scores as they stand'`: `removePlayer` mid-voting with scores `{ 1: 4, 2: 6, 3: 1 }`, seat 3 dismissed: over, `winners: [2]`.
  - `'a dismissal of the only seat still writing closes writing'`: four seats, three have written, seat 4 dismissed: `phase === 'voting'`.
  - `'status and lastMove never hold the real definition or an author before the reveal'`: `JSON.stringify({ gameStatus, lastMove })` contains neither `cross guard` nor any submission text after every action up to the last vote.
- [ ] **Step 2: Run** `node --test games/fictionary/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** `node --test games/fictionary/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Fictionary: writing, voting and scoring`.

### Task 11: Fictionary views, registration and manager test

**Files:**
- Modify: `games/fictionary/rules.ts` (`toPublicState`, `privateSeatView`)
- Create: `games/fictionary/index.ts`, `games/fictionary/views.test.ts`, `games/fictionary/manager.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `shared/categories.test.ts` (`'fictionary'` in `party`; count up by 1), `games/secretState.test.ts` (`'fictionary'` in `WITH_SECRET`), `games/privateSeatView.test.ts` (a `fictionary` entry in `CASES`: a writing state with submissions from seats 1 and 2, and a voting state with choices, an own fake for seat 1 and a vote from seat 2)

**Interfaces:**
- Produces (`index.ts`): `fictionary: GameDefinition<GameState, PublicGameState>` wiring every hook of Task 10, `toPublicState`, `privateSeatView`, and `secretState: state => seatFields(state, state.phase === 'reveal' || state.isGameOver ? ['deck'] : ['deck', 'definition'])`. No `spectatorState` and no `spectatorsSeeEverySeat`: a spectator sees the table view and may ask to see a seat.
- `privateSeatView(state, seat)`: `seatFields(toPublicState(state, false, seat), ['submission', 'ownChoice', 'myVote'])`.

Decisions for `toPublicState(state, undo, viewer)`: `open` is `phase === 'reveal' || isGameOver`. `definition` only when open. `written` is the seats with a submission. `submission` is the viewer's own (null for `null`). `choices` are `{ text }` only until open, then the full `Choice`. `ownChoice` is the index of the choice listing the viewer among its authors. `voted` is the seats with a vote; `myVote` the viewer's; `votes` all of them when open, else `{}`. `deck` never.

- [ ] **Step 1: Write the failing tests.** `views.test.ts`, with a helper `leaks(view, text)` on `JSON.stringify`:
  - `'nobody sees the real definition before the reveal'`: every viewer (`null`, 1, 2, 3) in writing and voting: no `cross guard` in the view; all see it at the reveal.
  - `'a seat sees only its own submission while writing'`: Bob's view holds his text and not Alice's; `null` holds neither.
  - `'during voting no view says who wrote a choice or which is real'`: no `authors` or `real` key in any `choices` item for every viewer; `ownChoice` is set only for its author.
  - `'votes are hidden until the reveal, except your own'`.
  - `'the reveal shows every author and every vote'`.
  - `'the null view plus privateSeatView is the seat view'` in each phase.
  - `manager.test.ts` through `createGameManager([fictionary], first, undefined, { now: () => clock.now })` with mocked `setTimeout`, `rememberingKeys` and `agreeAll`, as `games/pictionary/manager.test.ts`:
    - `'a word plays through writing, voting, reveal and Continue'`.
    - `'the writing deadline closes writing on the server clock'`: advance 119_999 ms: writing; 1 ms more: voting.
    - `'no history step shows the definition or an author before the reveal'`: `JSON.stringify(stepsOf(manager, 'fictionary'))` holds neither until the reveal.
    - `'undo is never offered'`: `requestUndo` is refused.
- [ ] **Step 2: Run** `node --test games/fictionary/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the views, `index.ts` and the registrations.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (Task 12).
- [ ] **Step 5: Commit** `Fictionary: hidden views and registration`.

### Task 12: Fictionary client

**Files:**
- Create in `games/fictionary/client/`: `GameScreen.tsx`, `GameStatus.tsx`, `WritingPanel.tsx`, `VotingPanel.tsx`, `RevealRows.tsx`, `Scores.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `fictionary.scss`
- Modify: `src/clientGames.ts` (one line), `shared/svg/gameIcons.ts` (one `fictionary` line: an open book with a question mark)
- Test: `games/fictionary/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState` (Task 8), `phaseDeadline` from `../clock.ts`, `gameService.sendAction`, `RoundSummaryDialog`, `useCountdown`, `useTimerWarning`, `YouTag`.
- Produces: `fictionaryClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `gameLength` (`plural(round, 'word')`), `FinalRound` (the last word's `RevealRows`).

Decisions:
- The word is always on top in large type with `Round <n> of <m>` (`m` is `houseRule(gameState, WORD_COUNT)`) and the timer (`role="timer"`, `aria-label="Time left"`).
- `WritingPanel`: a textarea labelled `Your definition` (`maxLength` 150) and **Submit** (**Update** once `submission` is set), a line `You wrote: <submission>`, and `Written: <names>` for everyone.
- `VotingPanel`: one button per choice (`role="radio"` in a `role="radiogroup"` labelled `Which is the real definition?`), the own choice disabled with the tag `Yours`, `myVote` checked, and `Voted: <names>`. A matched seat sees `You wrote the real definition. Waiting for the votes.` instead of buttons.
- Reveal: `RoundSummaryDialog` (label `Round <n> reveal`, title the word) with `RevealRows`: each choice, `Real definition` or `Written by <names>`, `Voted for by <names>`, then each seat's `+<roundPoints>`. Continue sends `{ type: 'continue' }`. The last word has no Continue; its rows are the game-over screen's `FinalRound`.
- `describeMove` texts: `Alice wrote a definition`; `Everyone has written`; `Writing time is up`; `Bob voted`; `The real definition of quillon: either arm of the cross guard of a sword`; `Word 2 of 8`.
- Layout: one column, choices full width, at least 44 px tall for touch; no overlap at 320 px.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts` asserting each text above exactly.
- [ ] **Step 2: Run** `node --test games/fictionary/client/describeMove.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client, loader and icon lines.
- [ ] **Step 4: Run** `node --test games/fictionary/**/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Fictionary: screen, history and FAQ`.

### Task 13: Fictionary README and end-to-end tests

**Files:**
- Create: `games/fictionary/README.md`, `e2e/fictionary.spec.ts`

README decisions (Rules, Controls, Differences from Wikipedia; name the dictionaries the definitions were checked against under Rules). Read the Fictionary article first; the differences expected:
- No dealer: the game picks the word and holds the real definition, so everyone writes and votes every round.
- Writing and voting are on screen with a writing time (60, 90, 120 or 180 s) and a 60 second vote, each ending early once everyone is in.
- Scoring 2 for voting real, 1 per vote to a fake's author, 3 for writing the real definition (matched by the game, one letter of slack); the article's dealer points do not exist.
- A matched entry is not shown, the matching player does not vote, and identical fakes are shown once and credited to every author.
- A fixed number of words (5, 8 or 10) instead of rounds until a target.
- No undo; the game ends with the scores as they stand if fewer than 3 players remain.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/fictionary.spec.ts`**, one test per rule, control and difference in the README, patching the entry `{ word: 'quillon', definition: 'either arm of the cross guard of a sword' }`. At least: every page shows the word; a submitted definition is not on another page; writing ends early when all three have written; the writing deadline (patch `phaseStartedAt: Date.now() - 119_500`) moves to voting; the own choice is disabled and marked Yours; a matched player sees the notice and no buttons; identical fakes show once; votes score 2, 1 and 3 as in Task 10; the reveal lists authors and voters and Continue starts word 2; Number of words 5 ends after word 5 (patch `round: 5`); History (`headerButton(page, 'History')`) during voting holds no author name next to a choice and no definition; the WebSocket frames a player receives during voting never contain `cross guard`; dismissing a player down to two ends the game; FAQ opens.
- [ ] **Step 3: Run** `npx vite build` then `E2E_SKIP_BUILD=1 E2E_PORT_BASE=8300 npx playwright test --workers=2 e2e/fictionary.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Fictionary: README and end-to-end tests`.

### Task 14: Browser check

**Files:** none new (fixes go in the owning task's files, each with its own commit).

- [ ] **Step 1: Run the site:** `npx vite build`, then `PORT=3403 node server/server.ts` in the background.
- [ ] **Step 2: Play Charades in Chrome** (load the `claude-in-chrome` skill first) with three tabs, one per player, at `http://localhost:3403`: a full game with Turns per player 1, including a correct guess, a near guess, guessed-only chat and a timeout. Open History mid-turn and check no prompt shows; after the game download the game file and open it from the landing page with View as each seat. Then play two Pictionary turns with two tabs to confirm drawing, guessing and the reveal look and behave as before the extraction.
- [ ] **Step 3: Play Fictionary in Chrome** with three tabs: Number of words 5 through to the end, including a matched definition, identical fakes and an early close. Check History during voting and the downloaded file the same way.
- [ ] **Step 4: Check layout** of both games at laptop width and at phone width, by replacing a tab's body with same-origin iframes 390 px and 320 px wide (the window cannot be resized on this machine), in light and dark (`data-theme` on each iframe's `documentElement`): no overlap, no blank rows, no sideways scroll (beyond the iframe's own scrollbar at 320 px), chat input, Submit and the choices reachable.

### Task 15: Full checks and pull request

**Files:** none new.

- [ ] **Step 1: Run** `npm test`. Expected: PASS.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: PASS.
- [ ] **Step 3: Run** `npm run lint`. Expected: PASS with no warnings.
- [ ] **Step 4: Run** `npx vite build && E2E_SKIP_BUILD=1 E2E_PORT_BASE=8300 npx playwright test --workers=2 e2e/pictionary.spec.ts e2e/charades.spec.ts e2e/fictionary.spec.ts`. Expected: PASS.
- [ ] **Step 5: Check the writing:** `git diff origin/party-games-and-polish --stat` touches only the files this plan names, with no Pictionary test file or `e2e/pictionary.spec.ts` among them, and `git grep -nP "\x{2014}" -- shared/guessing games/pictionary games/charades games/fictionary e2e/charades.spec.ts e2e/fictionary.spec.ts` prints nothing.
- [ ] **Step 6: Push and open the PR:** `git push -u origin game-charades-fictionary`, then `gh pr create --base party-games-and-polish --title "Charades and Fictionary"` with a body that lists both games, their Differences from Wikipedia, the dictionaries used for Fictionary, the one-line registration edits made (for the coordinator's conflict resolution, including the `shared/categories.test.ts` count), and that the root README, `e2e/landing.spec.ts` and `docs/architecture.md` are left to the coordinator. The body ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

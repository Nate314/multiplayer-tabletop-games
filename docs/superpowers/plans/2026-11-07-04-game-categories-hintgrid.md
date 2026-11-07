# Categories and Hint Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two party games: Categories (the traditional letter-and-list game, with typed answers, a challenge vote and unique-answer scoring) and Hint Grid (an original two-team word-association game on a 5 by 5 grid).

**Architecture:** Two new folders, `games/categories/` and `games/hintgrid/`, on the `GameDefinition` contract. Categories is a round game with no turns, like Fictionary: answering is a game action on a server clock, the review's challenges and votes are game actions, and Continue uses `shared/rounds.ts`. One pure module (`scoring.ts`) decides each answer's verdict and is shared by the rules and the screen. Hint Grid is turn based: the lobby picks teams and roles with unrecorded actions, a clue is the clue-giver's move, and guesses are the team's guessers' moves through `allowsOutOfTurn`, so each one is undoable by vote. Pictionary (`games/pictionary/`) is the model for both.

**Tech Stack:** TypeScript, React 19, SCSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Goals", "Rules for every agent", "Shared ground", "Categories" and "Hint Grid". The spec's chunk table may still call this branch `game-categories-wordspies`; the game is Hint Grid, id `hintgrid` (see "New names": Word Spies failed the name search). House style: `docs/superpowers/plans/2026-10-31-18-codebreaker.md`.

**Branch:** `game-categories-hintgrid` in its own worktree, from `party-games-and-polish`. Site `PORT=3404`, e2e `E2E_PORT_BASE=8400` (never 6000, Chrome refuses it). PR into `party-games-and-polish`.

## Global Constraints

- Categories: id `categories`, category `'party'`, 2 to 8 players. Hint Grid: id `hintgrid`, name `Hint Grid`, category `'party'`, 4 to 8 players.
- Categories letters: "a random letter, from a set without the hard letters Q, U, V, X, Y and Z (my call), unless the **Hard letters** house rule (toggle, off by default, owner's decision) puts them back in", and "a list of 12 categories from a built-in pool of at least 150."
- Categories: "Answers are hidden until the timer ends or everyone presses Done." "Any player can challenge an answer; the other players vote and a majority rejects it. An answer that does not start with the letter is rejected automatically."
- Categories scoring: "1 point for each valid answer no one else gave; duplicates (equal after normalizing, ignoring a leading "a", "an" or "the") score 0. Highest total after the rounds wins."
- Categories house rules: "rounds (1 to 5; standard 3), time (60, 90, 120 or 180 s; standard 120), categories per list (8, 10 or 12; standard 12)", plus Hard letters.
- Hint Grid: "Two teams, Red and Blue, each with one clue-giver. In the lobby each player picks a team and a role, and an **Even out** button balances them. The game cannot start until each team has a clue-giver and at least one guesser."
- Hint Grid key: "9 for the starting team, 8 for the other, 7 bystanders, 1 trap. Clue-givers see the key; guessers do not." A grid of 25 words "from a built-in list of at least 400."
- Hint Grid clues: "one word and a number. A clue that is a word on the grid (normalized) is refused." Guessers "get up to the number plus one guesses and may stop early with **End guessing**. A bystander or the other team's word ends the turn. The trap loses the game at once." "A tap by any guesser on the team counts." "The first team to reveal all its words wins. Standings show the winning team's players as winners."
- Hint Grid hidden key: "in each clue-giver's private view only, and in `secretState`. Spectators see the key (`spectatorsSeeEverySeat` style)." A table screen and History (`viewer: null`) see only turned-over cards until the game ends.
- Undo: Hint Grid clues, guesses and End guessing are turn moves, undoable by vote. Categories has no turn moves; its actions are game actions and it sets `allowsUndoVote: () => false` (see Task 3). Team and role picks are unrecorded lobby actions.
- Leaving: "A game that needs a minimum (Hint Grid teams, ...) ends when the players left can no longer play, with the scores as they stand."
- Rules from Wikipedia's [Categories (game)](https://en.wikipedia.org/wiki/Categories_(game)) and [Codenames](https://en.wikipedia.org/wiki/Codenames_(board_game)) articles; each README lists every difference under "Differences from Wikipedia" in the format of `games/rook/README.md`. Where the spec disagrees with Wikipedia, the spec wins.
- Hint Grid is an original game: no name, term, card text or word list copied from the commercial game. Player-visible text says Hint Grid, clue-giver, guesser, bystander and trap. The commercial name appears only in the README's Differences from Wikipedia link and opening line; "Scattergories" appears nowhere. Tests in Tasks 2 and 7 enforce it.
- Files outside the two game folders: one-line entries only, in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `shared/categories.test.ts` (the `party` list and the grouped count, 42 today), `games/secretState.test.ts` (`WITH_SECRET`), `games/privateSeatView.test.ts` (`CASES`), plus `e2e/categories.spec.ts` and `e2e/hintgrid.spec.ts`. Do NOT edit the root `README.md` game list or count, `e2e/landing.spec.ts` or `docs/architecture.md`; the coordinator does. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`; if a platform or fixture change seems needed, stop and report it.
- New specs reach header controls (History, Share, Rules, Hide, Pause, Settings, Theme) only through `headerButton(page, name)` from `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, READMEs, FAQs or commit messages.
- Every commit message ends with these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

## Review Focus

1. A Categories answer with a leading article: `The Tiger` for T is valid, `The Eagle` for T is a wrong letter, and `a dog` duplicates `Dog` but not `dogs` (Task 2).
2. A Categories player types an answer and the timer ends a moment later: what the server holds is what the review shows, so the screen sends answers 300 ms after typing stops and on leaving a field (Task 5, e2e Task 6), and the review never shows a blank where the player saw text.
3. A Categories challenge opened after some players pressed Continue: their Continue is cleared, so the round cannot end with a vote still owed (Task 3).
4. A Hint Grid clue `Ocean` when `ocean` is on the grid is refused; `oceans` and `sea` are accepted; `ice cream` is refused as two words (Task 8).
5. A Hint Grid card tapped by the clue-giver, by the other team's guesser, or before a clue is given is refused, and an approved undo of a guess turns the card face down again in every view, History included (Tasks 8 and 9).

---

### Task 1: Worktree, branch and ports

**Files:** none in the repo.

- [ ] **Step 1: Create the worktree** from the main checkout:
  ```bash
  git fetch origin
  git worktree add ../multiplayer-tabletop-games-categories-hintgrid -b game-categories-hintgrid origin/party-games-and-polish
  cd ../multiplayer-tabletop-games-categories-hintgrid
  npm ci
  ```
  If `node` is missing from PATH (the nvm symlink `C:\nvm4w\nodejs` has gone missing before), prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH.
- [ ] **Step 2: Confirm the ports are free:** `netstat -ano | grep -E ':(3404|840[0-9])\s'` prints nothing. If one is taken, pick another pair (never 6000) and use it everywhere this plan says 3404 or 8400.
- [ ] **Step 3: Confirm the base is green:** `npm test && npm run typecheck`. Expected: PASS.

### Task 2: Categories options, info, types, pool and scoring

**Files:**
- Create: `games/categories/options.ts`, `games/categories/info.ts`, `games/categories/types.ts`, `games/categories/clock.ts`, `games/categories/pool.ts`, `games/categories/scoring.ts`
- Test: `games/categories/scoring.test.ts`, `games/categories/pool.test.ts`

**Interfaces:**
- Produces (`options.ts`):
  - `HARD_LETTERS: ToggleRule`: id `hardLetters`, label `Hard letters`, standard `false`, help `Adds Q, U, V, X, Y and Z to the letters.`
  - `ROUNDS: ChoiceRule<1 | 2 | 3 | 4 | 5>`: id `rounds`, label `Rounds`, standard 3, labels `1 round` to `5 rounds`.
  - `ROUND_SECONDS: ChoiceRule<60 | 90 | 120 | 180>`: id `roundSeconds`, label `Time per round`, standard 120, labels `1 minute`, `90 seconds`, `2 minutes`, `3 minutes`.
  - `LIST_SIZE: ChoiceRule<8 | 10 | 12>`: id `listSize`, label `Categories per list`, standard 12, labels `8 categories`, `10 categories`, `12 categories`.
  - `CATEGORIES_RULES: HouseRule[] = [ROUNDS, ROUND_SECONDS, LIST_SIZE, HARD_LETTERS]`
  - `EASY_LETTERS = [...'ABCDEFGHIJKLMNOPRSTW']`, `HARD = [...'QUVXYZ']`, `lettersFor(hard: boolean): string[]`.
- Produces (`info.ts`): `categoriesInfo: GameInfo` with `id: 'categories'`, `category: 'party'`, `name: 'Categories'`, description `Name something for every category that starts with the round's letter`, `minPlayers: 2`, `maxPlayers: 8`, `houseRules: CATEGORIES_RULES`, `ownTurnLimit: true`, `passAndPlay: false`.
- Produces (`clock.ts`): `phaseDeadline(state)`: `phaseStartedAt + houseRule(state, ROUND_SECONDS) * 1000` while answering; null in the lobby (`phaseStartedAt === null`), in review and after the game.
- Produces (`types.ts`):
  ```ts
  type Phase = 'answering' | 'review';
  type Verdict = 'empty' | 'wrongLetter' | 'duplicate' | 'rejected' | 'valid';
  type Challenge = { category: number; seat: Seat; by: Seat; votes: Partial<Record<Seat, boolean>>; verdict: 'open' | 'rejected' | 'kept' }; // a vote of true rejects
  type Review = { acknowledged: Seat[] }; // Acknowledgeable
  type LastMove =
    | { type: 'answers'; playerNumber: Seat }  // only the first, which starts the game
    | { type: 'done'; playerNumber: Seat }
    | { type: 'closeAnswers'; reason: 'allDone' | 'timeUp' }
    | { type: 'challenge'; playerNumber: Seat; category: number; seat: Seat }
    | { type: 'judge'; playerNumber: Seat; category: number; seat: Seat }
    | { type: 'verdict'; category: number; seat: Seat; rejected: boolean }
    | { type: 'continue'; playerNumber: Seat }
    | { type: 'nextRound'; round: number; letter: string };
  type GameState = BaseGameState & {
    phase: Phase; round: number; letter: string; list: string[];
    letters: string[]; pool: string[];       // shuffled, still to come: the secrets
    phaseStartedAt: number | null;
    answers: Partial<Record<Seat, string[]>>; // one per category, '' when blank
    done: Seat[]; challenges: Challenge[]; review: Review | null;
    scores: Record<Seat, number>; lastMove: LastMove | null;
  };
  type PublicGameState = Omit<GameState, 'letters' | 'pool' | 'answers'> & BasePublicState & {
    answers: Partial<Record<Seat, string[]>>;          // the viewer's own while answering; every seat's in review
    verdicts: Partial<Record<Seat, Verdict[]>>;        // review only, else {}
    roundPoints: Partial<Record<Seat, number>>;        // review only, else {}
  };
  ```
- Produces (`scoring.ts`, imported by the rules and the client; it holds no secrets):
  - `withoutArticle(text: string): string`: trimmed, a leading `a `, `an ` or `the ` (any case, followed by more text) removed.
  - `answerKey(text: string): string`: `normalize(withoutArticle(text))` from `shared/guess.ts`.
  - `startsWithLetter(text: string, letter: string): boolean`: the first character of `withoutArticle(text)`, upper-cased, equals `letter`.
  - `verdicts(answers: Partial<Record<Seat, string[]>>, seats: Seat[], letter: string, challenges: Challenge[]): Partial<Record<Seat, Verdict[]>>`: per seat in `seats` and category: `empty` when blank; `wrongLetter` when it does not start with the letter; `duplicate` when another seat in `seats` has a non-empty, right-letter answer with the same `answerKey` for that category; `rejected` when its challenge's verdict is `rejected`; else `valid`.
  - `roundPoints(verdicts): Partial<Record<Seat, number>>`: the count of `valid` per seat.
- Produces (`pool.ts`): `POOL: readonly string[]`, imported only by `rules.ts`.

- [ ] **Step 1: Write the failing tests.** `scoring.test.ts`:
  - `'a leading article is ignored for the letter and for duplicates'`: `startsWithLetter('The Tiger', 'T')` true; `startsWithLetter('The Eagle', 'T')` false; `startsWithLetter('the', 'T')` true; `answerKey('a dog') === answerKey('Dog')`; `answerKey('dogs') !== answerKey('dog')`; `answerKey('An Ice-cream') === answerKey('ice cream')`.
  - `'verdicts: empty, wrong letter, duplicate, rejected and valid'`: letter `B`, two categories, seats 1 to 3, answers `{ 1: ['Banana', 'Bear'], 2: ['a banana', 'Cat'], 3: ['', 'Bison'] }`, a rejected challenge on seat 3's category 1: seat 1 `['duplicate', 'valid']`, seat 2 `['duplicate', 'wrongLetter']`, seat 3 `['empty', 'rejected']`; `roundPoints` `{ 1: 1, 2: 0, 3: 0 }`.
  - `'a wrong-letter answer does not make another a duplicate'`: letter `B`, seat 1 `Apple` and seat 2 `apple` are both `wrongLetter` and seat 3's `Berry` stays `valid` beside them; seat 1 `Berry` and seat 2 `berry ` (trailing space) are both `duplicate`.
  - `'a seat left out of seats neither scores nor duplicates'`: same answers, `seats` `[1, 3]`: seat 1's `Banana` is `valid`.

  `pool.test.ts`:
  - `'the pool has at least 150 categories, none repeated'`: `POOL.length >= 150`; `new Set(POOL.map(normalize)).size === POOL.length`.
  - `'every category is a short plain phrase'`: 3 to 40 characters, matches `/^[A-Z][A-Za-z ,'-]*$/`.
  - `'lettersFor leaves out the hard letters unless asked'`: `lettersFor(false)` has 20 letters and none of `QUVXYZ`; `lettersFor(true)` has 26.
  - `'no client file imports rules.ts or pool.ts'` (as `games/pictionary/words.test.ts`).
  - `'no file of the game names a commercial game'`: walk `games/categories/` and read `e2e/categories.spec.ts` when it exists; none matches `/scattergories/i`.
- [ ] **Step 2: Run** `node --test games/categories/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the six files.** The pool is written fresh (do not work from a commercial game's lists): at least 150 categories that most letters can answer, such as `Fruits`, `Things in a kitchen`, `Board games`, `Reasons to be late`.
- [ ] **Step 4: Run** `node --test games/categories/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Categories: options, types, pool and scoring`.

### Task 3: Categories rules

**Files:**
- Create: `games/categories/rules.ts`
- Test: `games/categories/rules.test.ts`

**Interfaces:**
- Consumes: Task 2; `acknowledge`, `awaiting`, `everyoneReady`, `type RoundAccess` from `shared/rounds.ts`; `rankStandings`, `pointsText`; `shuffle`; `houseRule`.
- Produces (`rules.ts`): `createGameState`, `resetLobby(state, random)`, `applyMove` (always `{ error: 'Categories has no turns' }`), `applyAction(state, seat, action, random, now)`, `recordsAction(state, seat, action): boolean`, `allowsUndoVote(): false`, `deadline`, `onDeadline(state, now, random)`, `resumeClock(state, now)`, `onPlayerLeft`, `onPlayerDisconnected`, `waitingOn`, `finalStandings`, `votersOf(state, author: Seat): Seat[]` (active seats but the author).
- Actions: `{ type: 'answers', answers: string[] }`, `{ type: 'done', answers: string[] }`, `{ type: 'challenge', category: number, seat: Seat }`, `{ type: 'judge', category: number, seat: Seat, reject: boolean }`, `{ type: 'continue' }`.

Decisions:
- `resetLobby`: `letters` is `shuffle(lettersFor(houseRule(state, HARD_LETTERS)))`, `pool` is `shuffle(POOL)`; round 1 takes `letter` off `letters` and `list` (`houseRule(state, LIST_SIZE)` entries) off `pool`, so no letter or category repeats in a game. `phase: 'answering'`, `phaseStartedAt: null`, `currentPlayer: null`, scores zero, the rest empty.
- Every action is refused `Wait for everyone to agree to the house rules` while `phaseStartedAt === null`, and `The game is over` after it.
- `answers` and `done` during answering: an array of exactly `list.length` strings, each trimmed and at most 40 characters (`Answers are up to 40 characters`, `Send one answer per category`), stored for the seat. `done` also adds the seat to `done`; after it the seat's answers are refused `You are done for this round`. Status `<name> is done`. When every active seat is done, answering closes (`allDone`); the deadline closes it too (`timeUp`): `phase: 'review'`, `review: { acknowledged: [] }`, status `Review the answers`. After answering: `Answering is over`.
- `challenge` during review by an active seat: refused `You cannot challenge your own answer`, `Only a scoring answer can be challenged` (its verdict is not `valid`), `That answer was already challenged`. It adds a `Challenge` with `votes: { [by]: true }`, clears `review.acknowledged`, and resolves at once if every voter has voted.
- `judge` by a seat in `votersOf(author)`: refused `You do not vote on your own answer`, `No open challenge on that answer`, `You already voted`. When every voter has voted, the verdict is `rejected` if the reject votes are more than half the voters, else `kept`; `lastMove` is then `verdict`, status `<author>'s answer for <category> was rejected` (or `kept`).
- `continue` during review: refused `Vote on the open challenges first` while the seat owes a vote; else `acknowledge` with `RoundAccess` (`noun: 'round'`). Everyone ready: `scores` gain `roundPoints`; after the last round (`round === houseRule(state, ROUNDS)`) the game ends with `winners` the top scorers and status `<names> won with <n> points`; else round + 1 with the next letter and list, answers, done and challenges emptied, `phase: 'answering'`, `phaseStartedAt: now`, `lastMove: { type: 'nextRound', round, letter }`.
- `recordsAction`: true for `done`, `challenge`, `judge` and `continue` while the clock has started and the game is not over; `answers` only while `!state.started` (the first one starts the game, so a late join cannot reset a round in progress). An unrecorded `answers` leaves `lastMove` as it was.
- `allowsUndoVote` is false: there is no turn move, and undoing the review would reopen answering after everyone has seen the answers.
- `onPlayerLeft` (a dismissal; the platform ends the game with one player left): the leaver's answers, challenges on them and votes are dropped; each open challenge is checked again with the smaller voter list; answering closes if everyone left is done; `everyoneReady` is checked. Verdicts are computed over active seats only, so a leaver's duplicate partner can become valid.
- `onPlayerDisconnected`: the `everyoneReady` re-check in review.
- `waitingOn`: answering, active seats not done; review, seats owing a vote plus `awaiting`.
- `finalStandings`: `rankStandings` by score descending, `pointsText`.

- [ ] **Step 1: Write the failing tests** (three seats via `addPlayer` and `withRules`, patched `letter: 'B'`, `list: ['Fruits', 'Animals']`, `phaseStartedAt: NOW`):
  - `'round one deals a letter and a list of the rule's size, from the easy letters by default'`: with `listSize: 8` the list has 8 entries; over 50 seeded lobbies the letter is never in `QUVXYZ`; with `hardLetters: true` the `letters` deck plus `letter` has 26.
  - `'an action before the clock starts is refused'`.
  - `'answers are stored, a long answer is refused, and Done locks them'`.
  - `'answering closes when everyone is done, or on the deadline'`: `deadline` is `NOW + 120_000`; `onDeadline` gives `phase === 'review'`, `lastMove` `closeAnswers` `timeUp`.
  - `'a challenge by the only other player rejects at once'`: two seats; seat 2 challenges seat 1's `Banana`: verdict `rejected`.
  - `'with three players a majority of the other two rejects, and a split keeps'`: seat 2 challenges seat 1, seat 3 votes reject: rejected; another with seat 3 voting keep: kept.
  - `'only a scoring answer may be challenged, never your own, and once'`.
  - `'a new challenge clears every Continue'`: seats 1 and 2 continue, seat 3 challenges: `review.acknowledged` is `[]`; seat 1's Continue is then `{ error: 'Vote on the open challenges first' }`.
  - `'Continue adds the round points and starts the next round with a new letter and list'`: `scores` gain `{ 1: 2, ... }` as the verdicts give; `round === 2`; the new letter and list differ from round 1's.
  - `'the last round ends the game with the top total winning'`: `rounds: 1`; tied totals share the win.
  - `'a dismissed player's duplicate partner scores'`: seats 1 and 3 both `Bear`; seat 3 dismissed in review: seat 1's `Bear` is `valid`.
  - `'a dismissed voter no longer blocks a challenge'`.
  - `'status and lastMove never hold an answer while answering'`.
- [ ] **Step 2: Run** `node --test games/categories/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** `node --test games/categories/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Categories: answering, review and scoring`.

### Task 4: Categories views, registration and manager test

**Files:**
- Modify: `games/categories/rules.ts` (`toPublicState`, `privateSeatView`)
- Create: `games/categories/index.ts`, `games/categories/views.test.ts`, `games/categories/manager.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `shared/categories.test.ts` (`'categories'` in `party`; count up by 1), `games/secretState.test.ts` (`'categories'` in `WITH_SECRET`), `games/privateSeatView.test.ts` (a `categories` entry in `CASES`: an answering state with answers from seats 1 and 2, and a review state)

**Interfaces:**
- Produces (`index.ts`): `categories: GameDefinition<GameState, PublicGameState>` wiring every hook of Task 3, `toPublicState`, `privateSeatView: (state, seat) => seatFields(toPublicState(state, false, seat), ['answers'])`, `secretState: state => seatFields(state, ['letters', 'pool'])`. No `spectatorState`.
- `toPublicState`: while answering, `answers` is `{ [viewer]: own }` (`{}` for `null`), `verdicts` and `roundPoints` `{}`; in review and after the game, every active seat's answers, `verdicts(...)` and `roundPoints(...)`. `letters` and `pool` never.

- [ ] **Step 1: Write the failing tests.** `views.test.ts`: `'while answering a seat sees only its own answers and History none'` (every viewer, JSON holds no other seat's text); `'the review shows every answer with its verdict and points'`; `'the null view plus privateSeatView is the seat view'` in both phases; `'no view holds the letters or categories still to come'`. `manager.test.ts` (mocked `setTimeout`, `rememberingKeys`, `agreeAll`, as `games/pictionary/manager.test.ts`): `'a round plays through answering, a challenge and Continue'`; `'the round deadline closes answering on the server clock'` (119_999 ms: answering; 1 ms more: review); `'no history step shows an answer before the review'`; `'a second answers action is not a history step'`; `'undo is never offered'`.
- [ ] **Step 2: Run** `node --test games/categories/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the views, `index.ts` and the registrations.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (Task 5).
- [ ] **Step 5: Commit** `Categories: hidden views and registration`.

### Task 5: Categories client

**Files:**
- Create in `games/categories/client/`: `GameScreen.tsx`, `GameStatus.tsx`, `AnswerSheet.tsx`, `ReviewTable.tsx`, `Scores.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `categories.scss`
- Modify: `src/clientGames.ts` (one line), `shared/svg/gameIcons.ts` (one `categories` line: a list of three lines beside a large letter)
- Test: `games/categories/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState`, `Verdict` (Task 2), `phaseDeadline`, `gameService.sendAction`, `useCountdown`, `useTimerWarning`, `YouTag`.
- Produces: `categoriesClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `gameLength` (`plural(round, 'round')`).

Decisions:
- Top: the letter in large type (`aria-label="Letter B"`), `Round <n> of <m>`, the timer (`role="timer"`, `aria-label="Time left"`).
- `AnswerSheet`: one text input per category, labelled by the category, `maxLength` 40, kept in local state. It sends `{ type: 'answers', answers }` 300 ms after typing stops and when a field loses focus; **Done** sends `{ type: 'done', answers }` and disables the inputs. `Done: <names>` below.
- `ReviewTable`: one row per category, one cell per seat (the player's answer and a tag: `+1`, `Duplicate`, `Wrong letter`, `Rejected`, `Challenged`, or nothing when blank). A **Challenge** button on each `valid` answer of another seat (`aria-label="Challenge Bob's answer for Fruits"`); on an open challenge, voters see **Keep** and **Reject**. Round points per seat at the foot, then **Continue** and `Waiting for <names>`. At phone width each category becomes a card listing the answers vertically; no sideways scroll at 320 px.
- `describeMove` texts: `Alice started answering`; `Alice is done`; `Everyone is done`; `Time is up`; `Bob challenged Alice's answer for Fruits`; `Cara voted on Alice's answer for Fruits`; `Alice's answer for Fruits was rejected`; `Alice's answer for Fruits was kept`; `Alice is ready for the next round`; `Round 2: the letter is M`.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts` asserting each text above exactly.
- [ ] **Step 2: Run** `node --test games/categories/client/describeMove.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client, loader and icon lines.
- [ ] **Step 4: Run** `node --test games/categories/**/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Categories: screen, history and FAQ`.

### Task 6: Categories README and end-to-end tests

**Files:**
- Create: `games/categories/README.md`, `e2e/categories.spec.ts`

README decisions (Rules, Controls, Differences from Wikipedia). Read the Categories (game) article first and list what it actually says; the differences expected:
- One random letter per round, from 20 letters unless Hard letters adds Q, U, V, X, Y and Z, never repeated in a game.
- A list of 8, 10 or 12 categories per round from a built-in pool, with a timer of 60 to 180 seconds and Done to end early.
- Unique-answer scoring: 1 point per valid answer nobody else gave, duplicates (ignoring a leading a, an or the) score 0.
- A leading a, an or the is skipped when checking the letter.
- Challenges are voted on by everyone but the answer's author, the challenger's own vote counting as reject; more than half rejects; a challenge reopens Continue for everyone.
- No undo; players who leave are dropped from the scoring.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/categories.spec.ts`**, one test per rule, control and difference in the README, patching `letter: 'B'` and a known `list`. At least: the letter and 12 inputs show, and Categories per list 8 shows 8; Hard letters off leaves `QUVXYZ` out of `table.state()`'s `letters` and on puts them in; another page never shows my answers while answering; everyone pressing Done opens the review; the timer ending opens it (patch `phaseStartedAt: Date.now() - 119_500`) with the answer typed just before shown; a wrong-letter answer is tagged Wrong letter; `a banana` and `Banana` are both Duplicate; a challenge rejected by a majority, and a split kept; a challenge clears Continue; Continue starts round 2 with a new letter; Rounds 1 ends the game with the top total winning; History (`headerButton(page, 'History')`) during answering shows no answers; the WebSocket frames a player receives while answering never contain another player's answer; FAQ opens; the review fits at phone size with `touch: true`.
- [ ] **Step 3: Run** `npx vite build` then `E2E_SKIP_BUILD=1 E2E_PORT_BASE=8400 npx playwright test --workers=2 e2e/categories.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Categories: README and end-to-end tests`.

### Task 7: Hint Grid info, types, words and teams

**Files:**
- Create: `games/hintgrid/info.ts`, `games/hintgrid/types.ts`, `games/hintgrid/words.ts`, `games/hintgrid/teams.ts`
- Test: `games/hintgrid/teams.test.ts`, `games/hintgrid/words.test.ts`

**Interfaces:**
- Produces (`info.ts`): `hintgridInfo: GameInfo` with `id: 'hintgrid'`, `category: 'party'`, `name: 'Hint Grid'`, description `Two teams race to find their words on a grid from one-word clues`, `minPlayers: 4`, `maxPlayers: 8`, `passAndPlay: false`. No house rules (the platform's turn timer is still offered).
- Produces (`types.ts`):
  ```ts
  type Team = 'red' | 'blue';
  type CardKind = Team | 'bystander' | 'trap';
  type Role = { team: Team; clueGiver: boolean };
  type Clue = { team: Team; word: string; count: number };
  type LastMove =
    | { type: 'clue'; playerNumber: Seat; clue: Clue }
    | { type: 'guess'; playerNumber: Seat; index: number; kind: CardKind }
    | { type: 'endGuessing'; playerNumber: Seat };
  type GameState = BaseGameState & {
    roles: Partial<Record<Seat, Role>>;
    words: string[]; key: CardKind[]; revealed: boolean[]; // 25 each
    startingTeam: Team; turn: Team; phase: 'clue' | 'guessing';
    clue: Clue | null; guessesLeft: number; guessesThisTurn: number;
    clues: Clue[]; lastMove: LastMove | null;
  };
  type PublicGameState = Omit<GameState, 'key'> & BasePublicState & {
    key: (CardKind | null)[];       // null for a face-down card the viewer may not see
    left: Record<Team, number>;     // each team's words still face down
  };
  ```
- Produces (`teams.ts`, pure):
  - `TEAM_NAMES: Record<Team, string> = { red: 'Red', blue: 'Blue' }`, `otherTeam(team: Team): Team`.
  - `dealKey(random: Random): { startingTeam: Team; key: CardKind[] }`: starting team `random() < 0.5 ? 'red' : 'blue'`, then `shuffle` of 9 starting, 8 other, 7 `bystander`, 1 `trap`.
  - `clueGiverOf(roles, team): Seat | null`, `guessersOf(roles, team, seats): Seat[]` (ascending).
  - `teamsReady(roles, seats: Seat[]): boolean`: every seat has a role, and each team has exactly one clue-giver and at least one guesser.
  - `evenOut(roles, seats: Seat[]): Partial<Record<Seat, Role>>`: keeps each team's clue-giver on its team; places every other seat, in seat order, on the team with fewer members (Red on a tie) as a guesser; then a team with no clue-giver makes its lowest seat its clue-giver.
- Produces (`words.ts`): `WORDS: readonly string[]`, imported only by `rules.ts`.

- [ ] **Step 1: Write the failing tests.** `teams.test.ts`:
  - `'the key has 9, 8, 7 and 1'`: over 20 seeds, 9 of `startingTeam`, 8 of the other, 7 bystanders, 1 trap, 25 in all; both teams start at least once.
  - `'teamsReady needs everyone placed, one clue-giver and a guesser on each team'`: four seats with 1 red clue-giver, 2 red guesser, 3 blue clue-giver, 4 blue guesser: true; seat 4 unplaced: false; two red clue-givers: false; blue with no guesser: false.
  - `'evenOut with nobody placed alternates teams and makes the first of each the clue-giver'`: seats 1 to 4: 1 and 3 red, 2 and 4 blue, clue-givers 1 and 2.
  - `'evenOut keeps a clue-giver where they are'`: five seats, seat 3 red clue-giver: red `{3, 2, 5}`, blue `{1, 4}` with clue-giver 1; the result is `teamsReady`.
  - `'evenOut balances teams within one'`: for 4 to 8 seats with any starting roles, team sizes differ by at most 1.

  `words.test.ts`: `'the list has at least 400 words, none repeated'`; `'every word is one lowercase word'` (`/^[a-z]+$/`); `'no client file imports rules.ts or words.ts'`; `'no file of the game names the commercial game outside its README'`: every file in `games/hintgrid/` but `README.md`, and `e2e/hintgrid.spec.ts` when it exists, has no match for `/codenames|spymaster|assassin/i`.
- [ ] **Step 2: Run** `node --test games/hintgrid/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the four files.** The word list is written fresh (do not consult the commercial game's list): at least 400 concrete, familiar single nouns with several meanings or associations (for example `bark`, `bridge`, `crown`, `pitch`), no proper nouns. Add `ocean`, `whale` and `anchor` (the tests use them).
- [ ] **Step 4: Run** `node --test games/hintgrid/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Hint Grid: types, words and team picking`.

### Task 8: Hint Grid rules

**Files:**
- Create: `games/hintgrid/rules.ts`
- Test: `games/hintgrid/rules.test.ts`

**Interfaces:**
- Consumes: Task 7; `normalize` from `shared/guess.ts`; `shuffle`; `rankStandings`.
- Produces (`rules.ts`): `createGameState`, `resetLobby(state, random)`, `applyMove(state, seat, move)`, `allowsOutOfTurn(state, seat, move): boolean`, `applyAction(state, seat, action)`, `onPlayerLeft(state, seat)`, `finalStandings`, `wordsLeft(state, team): number`, `turnHolder(state): Seat | null` (the clue-giver of `turn` in the clue phase, its lowest guesser while guessing; null unless `teamsReady`).
- Lobby actions (unrecorded; `recordsAction` is not defined): `{ type: 'pickRole', team: Team, clueGiver: boolean }`, `{ type: 'evenOut' }`.
- Moves: `{ type: 'clue', word: string, count: number }` by `currentPlayer`; `{ type: 'guess', index: number }` and `{ type: 'endGuessing' }` by any guesser of `turn` while guessing.

Decisions:
- `resetLobby`: keeps the `roles` of seats still seated, deals 25 words (`shuffle(WORDS).slice(0, 25)`) and `dealKey`, `revealed` all false, `turn = startingTeam`, `phase: 'clue'`, `currentPlayer = turnHolder(state)`. It keeps the platform's join or leave status.
- `pickRole` and `evenOut` before the start only (`Teams are set once the game starts`); `pickRole` refused `<Team> already has a clue-giver` when that seat would be a second one. Both set `currentPlayer = turnHolder(state)` and the status: `Pick teams: each team needs a clue-giver and a guesser` until `teamsReady`, then `<Team> starts: <name> gives the first clue`. While `currentPlayer` is null every move is refused by the platform with `Not your turn`, which is how the game cannot start before teams are ready.
- `clue`: the word is trimmed, 1 to 30 characters, one word (`/^[a-z]+(-[a-z]+)*$/i`), else `Give one word`; `count` an integer 1 to 9, else `The number is 1 to 9`; refused `Your clue is a word on the grid` when `normalize(word)` equals `normalize` of any of the 25 words (face up or down). It sets `clue`, pushes to `clues`, `guessesLeft = count + 1`, `guessesThisTurn = 0`, `phase: 'guessing'`, `currentPlayer = turnHolder`, status `<Team>'s clue: <word> <count>`.
- `allowsOutOfTurn`: true only while guessing, for a guesser of `turn`, for a `guess` or `endGuessing` move. So the clue-giver, the other team and anyone in the clue phase get `Not your turn`.
- `guess`: refused `Invalid card` (not an integer 0 to 24) and `That word is already turned over`. It turns the card over and `guessesThisTurn + 1`. The trap: game over, `winners` the other team's seats, status `<Team> turned over the trap. <Other> wins!`. Then, if either team has no words left, that team wins (status `<Team> found all its words!`). A word of `turn`: `guessesLeft - 1`, and the turn ends at 0. A bystander or the other team's word ends the turn.
- `endGuessing`: refused `Make at least one guess first` when `guessesThisTurn === 0`; else ends the turn.
- Ending the turn: `turn = otherTeam(turn)`, `phase: 'clue'`, `clue: null`, `currentPlayer = turnHolder`, status `<Team>'s clue-giver is thinking`.
- `onPlayerLeft` (a dismissal): the leaver's role is dropped. If either team now has no clue-giver or no guesser, the game ends: `winners` the players of the team with fewer words left, `[]` on a tie; status `Not enough players left: <Team> wins` or `Not enough players left: a draw`. Otherwise `currentPlayer = turnHolder` (the platform may have moved it to the wrong team).
- `finalStandings`: `rankStandings(state, () => 0, seat => TEAM_NAMES[team] + ' team')`.

- [ ] **Step 1: Write the failing tests** (four seats Alice, Bob, Cara, Dan via `addPlayer`; `ready()` applies `pickRole` so 1 is Red's clue-giver, 2 Red guesser, 3 Blue's clue-giver, 4 Blue guesser; then patches `words` with `ocean`, `whale`, `anchor` at 0 to 2, `startingTeam` and `turn` `'red'`, and `key` with 0 and 1 red, 2 bystander, 3 blue, 4 trap, the rest filled 9/8/7/1):
  - `'the lobby has no current player until the teams are ready'`: after three picks `currentPlayer === null`; after the fourth `currentPlayer === 1`; a fifth player joining (`addPlayer`) keeps the four roles and leaves the new seat unplaced, so `currentPlayer === null` again.
  - `'a second clue-giver on one team is refused'`.
  - `'role picks are refused once the game has started'`.
  - `'a clue that is a grid word is refused, whatever its case, and other words are taken'`: `Ocean` is `{ error: 'Your clue is a word on the grid' }`; `oceans` and `sea` are accepted; `ice cream` is `{ error: 'Give one word' }`; count 0 and 10 are `{ error: 'The number is 1 to 9' }`.
  - `'only the team's guessers may guess, and only after the clue'` (through `applyMove` from `shared/seating.ts`): seat 2 before the clue, seat 1 and seat 4 after it are each `{ error: 'Not your turn' }`.
  - `'a team word lets the team guess on, up to the number plus one'`: clue `sea 1`, seat 2 guesses 0 (red): still guessing, `guessesLeft === 1`; guesses 1 (red): the turn passes to Blue, `currentPlayer === 3`.
  - `'a bystander or the other team's word ends the turn'`.
  - `'End guessing needs a guess first'`.
  - `'the trap loses at once'`: seat 2 guesses 4: over, `winners: [3, 4]`.
  - `'turning over the other team's last word wins it for them'`.
  - `'a dismissed clue-giver ends the game with the team with fewer words left winning'`: six seats, seat 1 dismissed with Red at 3 left and Blue at 5: `winners` the Blue seats; equal words left: `winners: []`.
  - `'standings list the winning team's players first'`.
- [ ] **Step 2: Run** `node --test games/hintgrid/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** `node --test games/hintgrid/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Hint Grid: clues, guesses and winning`.

### Task 9: Hint Grid views, registration and manager test

**Files:**
- Modify: `games/hintgrid/rules.ts` (`toPublicState`, `privateSeatView`, `spectatorState`)
- Create: `games/hintgrid/index.ts`, `games/hintgrid/views.test.ts`, `games/hintgrid/manager.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts`, `shared/categories.test.ts` (`'hintgrid'` in `party`; count up by 1), `games/secretState.test.ts` (`'hintgrid'` in `WITH_SECRET`), `games/privateSeatView.test.ts` (a `hintgrid` entry in `CASES`: a started guessing state with the four roles of Task 8 and two cards face up)

**Interfaces:**
- Produces (`index.ts`): `hintgrid: GameDefinition<GameState, PublicGameState>` with `createGameState`, `resetLobby`, `applyMove`, `allowsOutOfTurn`, `applyAction`, `onPlayerLeft`, `finalStandings`, `toPublicState`, `privateSeatView`, `spectatorState`, `spectatorsSeeEverySeat: true`, `secretState: state => state.isGameOver ? {} : seatFields(state, ['key'])`.
- `toPublicState(state, undo, viewer)`: `key` in full for a clue-giver and after the game; else each face-down card is `null`. `left` counts face-down words per team.
- `privateSeatView(state, seat)`: `{ key }` from the seat's view for a clue-giver, `{}` for anyone else (a guesser's key is the table's).
- `spectatorState(state, undo, tableScreen)`: `toPublicState(state, undo, null)` for a table screen, else the full key.

- [ ] **Step 1: Write the failing tests.** `views.test.ts`:
  - `'a guesser and History see only face-up cards'`: for seats 2 and 4 and `null`, every face-down entry of `key` is `null` and the face-up ones are their kinds.
  - `'clue-givers see the whole key'`.
  - `'a spectator sees the key, a table screen does not'` (`spectatorView` with `tableScreen` false and true).
  - `'everyone sees the key once the game is over'`.
  - `'the null view plus privateSeatView is the seat view'` for every seat.
  - `'lastMove and gameStatus never name a face-down card's kind'`.

  `manager.test.ts` through `createGameManager([hintgrid], seeded(42))` with `rememberingKeys`: four joins and the role picks as actions; `'a clue and two guesses are history steps and the picks are not'` (`stepsOf` grows by exactly 3 from the clue and the two guesses, and not at all from the picks); `'an approved undo turns a guessed card face down again'` (`requestUndo` by seat 2, `voteUndo` by the others: `revealed[index]` false, and seat 4's view has `null` there); `'no history step shows a face-down card's kind'`.
- [ ] **Step 2: Run** `node --test games/hintgrid/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the views, `index.ts` and the registrations.
- [ ] **Step 4: Run** the same command and `npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (Task 10).
- [ ] **Step 5: Commit** `Hint Grid: hidden key and registration`.

### Task 10: Hint Grid client

**Files:**
- Create in `games/hintgrid/client/`: `GameScreen.tsx`, `TeamPicker.tsx`, `Grid.tsx`, `ClueForm.tsx`, `ClueLine.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `hintgrid.scss`
- Modify: `src/clientGames.ts` (one line), `shared/svg/gameIcons.ts` (one `hintgrid` line: a 3 by 3 grid of squares, two filled)
- Test: `games/hintgrid/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState`, `Team`, `CardKind` (Task 7), `TEAM_NAMES` from `../teams.ts` (pure, no secrets), `gameService.makeMove`, `sendAction`, `requestUndo`, `voteUndo`, `UndoVote`, `ColorSymbol`, `YouTag`.
- Produces: `hintgridClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`.

Decisions:
- Before the start, `TeamPicker`: a Red and a Blue column listing members (the clue-giver marked `clue-giver`), the buttons `Be Red's clue-giver`, `Guess for Red`, `Be Blue's clue-giver`, `Guess for Blue` and `Even out`, and the status line. The grid shows below it (a clue-giver already sees the key).
- `Grid`: 25 buttons in a 5 by 5 grid; a face-down card's accessible name is its word, plus `, red`, `, blue`, `, bystander` or `, trap` when the viewer's `key` shows it; a face-up card is `aria-disabled`, filled in its kind's color with a `ColorSymbol` (red, blue) or an icon (bystander, trap) so color is never the only cue. Clickable only for a guesser of `turn` while guessing.
- `ClueForm` (the clue-giver on their clue phase): an input `Clue`, a select `Number` (1 to 9) and **Give clue**; a refused clue shows the server error.
- `ClueLine`: `Red's clue: sea 2 (3 guesses left)`, the words left per team, and **End guessing** for the team's guessers.
- **Undo** (`requestUndo`) as Pictionary's screen.
- `describeMove` texts: `Alice gave the clue sea 2`; `Bob turned over whale: Red`; `Bob turned over anchor: a bystander`; `Bob turned over ocean: Blue`; `Bob turned over bomb: the trap`; `Bob ended guessing`.
- Layout: the grid stays 5 columns at every width, words shrink and wrap inside their cards (at least 44 px tall), no sideways scroll at 320 px; team colors readable in light and dark.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts` asserting each text above exactly.
- [ ] **Step 2: Run** `node --test games/hintgrid/client/describeMove.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client, loader and icon lines.
- [ ] **Step 4: Run** `node --test games/hintgrid/**/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Hint Grid: screen, history and FAQ`.

### Task 11: Hint Grid README and end-to-end tests

**Files:**
- Create: `games/hintgrid/README.md`, `e2e/hintgrid.spec.ts`

README decisions (Rules, Controls, Differences from Wikipedia; the opening may say once that it plays like the commercial game, and the Differences section links its Wikipedia article). Read the article first; the differences expected:
- Original names and words: Red and Blue teams, clue-givers, guessers, bystanders and one trap; the word list is this project's own.
- Teams and roles are picked in the lobby with Even out; the game starts once each team has a clue-giver and a guesser and everyone is placed.
- Clues are typed, one word and a number from 1 to 9 (no zero or unlimited clue); a clue that is a grid word is refused by the game.
- Any guesser of the team may tap; at least one guess before End guessing.
- A dismissed player can end the game, won by the team with fewer words left.
- Spectators see the key; a table screen does not.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/hintgrid.spec.ts`**, one test per rule, control and difference in the README, patching `words`, `key`, `startingTeam` and `turn` as Task 8. At least: picking roles shows them on every page and the game waits until ready; Even out balances four unplaced players; a fifth joiner is unplaced and blocks the start; the clue-givers' cards name their kinds and the guessers' do not; a grid-word clue is refused and a good one shows to everyone; a team word lets the team guess on and the number plus one ends the turn; a bystander ends the turn; End guessing; the trap ends the game for the other team; finding all words wins with the standings naming the team; Undo of a guess, approved, turns the card face down; a spectator sees the key and a table screen does not; History (`headerButton(page, 'History')`) mid-game shows no face-down kinds; the WebSocket frames a guesser receives never contain the key array; dismissing a clue-giver ends the game; FAQ opens; the grid fits at phone size with `touch: true`.
- [ ] **Step 3: Run** `npx vite build` then `E2E_SKIP_BUILD=1 E2E_PORT_BASE=8400 npx playwright test --workers=2 e2e/hintgrid.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Hint Grid: README and end-to-end tests`.

### Task 12: Browser check

**Files:** none new (fixes go in the owning task's files, each with its own commit).

- [ ] **Step 1: Run the site:** `npx vite build`, then `PORT=3404 node server/server.ts` in the background.
- [ ] **Step 2: Play Categories in Chrome** (load the `claude-in-chrome` skill first) with three tabs, one per player, at `http://localhost:3404`: Rounds 2 to the end, with a wrong-letter answer, a duplicate, one rejected and one kept challenge, and one round ended by the timer. Open History during answering and check no answers show; after the game download the game file and open it from the landing page with View as each seat.
- [ ] **Step 3: Play Hint Grid in Chrome** with four tabs: pick teams, try Even out, play to a win and, in a second game, to the trap. Include a refused clue and an approved undo. Check History mid-game and the downloaded file the same way, and watch from a fifth tab as a spectator.
- [ ] **Step 4: Check layout** of both games at laptop width and at phone width, by replacing a tab's body with same-origin iframes 390 px and 320 px wide (the window cannot be resized on this machine), in light and dark (`data-theme` on each iframe's `documentElement`): no overlap, no blank rows, no sideways scroll (beyond the iframe's own scrollbar at 320 px), the answer inputs, review buttons, team picker and grid all reachable.

### Task 13: Full checks and pull request

**Files:** none new.

- [ ] **Step 1: Run** `npm test`. Expected: PASS.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: PASS.
- [ ] **Step 3: Run** `npm run lint`. Expected: PASS with no warnings.
- [ ] **Step 4: Run** `npx vite build && E2E_SKIP_BUILD=1 E2E_PORT_BASE=8400 npx playwright test --workers=2 e2e/categories.spec.ts e2e/hintgrid.spec.ts`. Expected: PASS.
- [ ] **Step 5: Check the writing:** `git diff origin/party-games-and-polish --stat` touches only the files this plan names, and `git grep -nP "\x{2014}" -- games/categories games/hintgrid e2e/categories.spec.ts e2e/hintgrid.spec.ts` prints nothing.
- [ ] **Step 6: Push and open the PR:** `git push -u origin game-categories-hintgrid`, then `gh pr create --base party-games-and-polish --title "Categories and Hint Grid"` with a body that lists both games, their Differences from Wikipedia, the one-line registration edits made (for the coordinator's conflict resolution, including the `shared/categories.test.ts` count), and that the root README, `e2e/landing.spec.ts` and `docs/architecture.md` are left to the coordinator. The body ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```

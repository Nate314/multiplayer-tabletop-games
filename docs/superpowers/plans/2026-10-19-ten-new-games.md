# Ten New Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Connect Four, Dominoes, Euchre, Farkle, Hearts, Rack-O, Spades, Texas Hold'em, The Crew and Yahtzee to the site, each a complete game on the existing platform, shipped in one PR.

**Architecture:** The coordinator first builds two shared pieces (trick-taking helpers, a dice component) on `ten-new-games`. Then ten agents run in parallel, one per game, each in its own git worktree on branch `game-<id>` from `ten-new-games`, each adding one `games/<id>/` folder, one `e2e/<id>.spec.ts` and one line in each registry. No agent opens a PR; the coordinator merges all ten branches into `ten-new-games` and opens one PR against `master`.

**Tech Stack:** TypeScript, React 19, Vite, Express and `ws`, `node --test`, Playwright, Node 22.18+ through nvm.

**Spec:** `docs/superpowers/specs/2026-10-19-ten-new-games-design.md`

## Global Constraints

- No new npm dependency.
- Rules follow the game's Wikipedia article; where it is silent, the publisher's official rules; where the spec says otherwise, the spec. Every difference listed in the README under "Differences from Wikipedia" in the format of `games/rook/README.md`.
- Hidden information goes through `toPublicState`; `viewer: null` sees no hand, deck, boneyard, kitty or face-down card.
- A game agent touches nothing outside `games/<id>/` and `e2e/<id>.spec.ts` except: one line in `games/registry.ts` (alphabetical by name), one line in `src/clientGames.ts`, the README game list and the game count in its first sentence, and `docs/architecture.md` only where it lists games by name. A needed platform or `e2e/fixtures.ts` change is reported, not made.
- CSS is scoped under `[data-game="<id>"]`; works in the light and dark themes.
- No em-dashes in READMEs, FAQs, comments or commit messages.
- `npm test`, `npm run typecheck`, `npm run lint` and `npx playwright test e2e/<id>.spec.ts` pass before an agent reports done.
- Commits end with the session's Co-Authored-By and Claude-Session lines; the one PR body ends with the Claude Code line and session link.

## Review Focus

- A player dismissed mid-game while they hold a pending decision (a Hearts pass, a Spades bid, Euchre's making trump, a Hold'em bet, a Crew communication): the game moves on or ends as the spec says and never waits forever. Each game task has a `dismissed player mid-turn` test.
- A rejoin or refresh mid-turn shows the same half-finished turn (Yahtzee's held dice and rolls left, Farkle's set-aside dice and turn total, Hold'em's betting round, Hearts' chosen pass cards once sent): that state lives on the server. Each manager test rejoins mid-turn.
- History and game files: the table view for every step leaks no hidden card, and "View as" shows only that seat's own hand. Each game task has a `table view hides hands` test over every step of a short game.
- Untrusted moves and actions: a card the player does not hold, a column out of range, a bet below the minimum raise or above the stack, a non-integer amount, a lobby choice after the first move, or a malformed object returns `{ error }` and leaves the state unchanged. Each game task has an `invalid moves` test.
- Undo after a hidden draw or roll (Dominoes boneyard, Rack-O draw pile, Hold'em's next card, a die roll): `onUndo` reshuffles, so undo-and-redo cannot reveal what comes next. Each game with a hidden pile has an `undo reshuffles` test; dice games rely on the platform's note that a replayed roll may differ.

---

### Task 1: Shared trick-taking helpers

**Files:**
- Create: `shared/tricks.ts`
- Test: `shared/tricks.test.ts`

**Interfaces:**
- Produces:
  - `type Play<C> = { seat: Seat; card: C }`
  - `canFollow<C, S>(hand: readonly C[], card: C, trick: readonly Play<C>[], suitOf: (card: C) => S): boolean`: true when the trick is empty, the card is of the led suit, or the hand holds no card of the led suit. Suits compared by `===`.
  - `trickWinner<C, S>(trick: readonly Play<C>[], suitOf: (card: C) => S, rank: (card: C) => number, trump: S | null): Seat`: the highest-ranked trump if any trump was played, otherwise the highest-ranked card of the led suit. Higher `rank` wins. Throws on an empty trick.
  - Game-specific rules (Hearts' first trick, breaking hearts or spades, The Crew's rockets as the trump suit, Euchre's bowers through its `suitOf` and `rank`) stay in each game.

- [ ] **Step 1: Write the failing tests:** `canFollow allows any card on an empty trick`; `canFollow requires the led suit when held` (hand `[h5, s2]`, trick led `h9`: `s2` false, `h5` true); `canFollow allows any card when void` (hand `[s2, c3]`, trick led `h9`: both true); `trickWinner takes the highest of the led suit when no trump` (`h5, h9, s13` with trump `null`: the `h9` seat); `trickWinner takes the highest trump` (`h13, s2, s7` with trump `s`: the `s7` seat); `trickWinner uses suitOf so a card can change suit` (a `suitOf` that maps one card to the trump suit wins with it). Test cards are local `{ suit, n }` objects, so the helpers are proven generic.
- [ ] **Step 2:** Run `node --test shared/tricks.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `shared/tricks.ts` (a reduce over the trick, like `games/rook/rules.ts:97`).
- [ ] **Step 4:** Run it again. Expected: PASS.
- [ ] **Step 5:** Commit `feat: shared trick-taking helpers`.

### Task 2: Dice component, docs, branch push

**Files:**
- Create: `src/components/Dice.tsx`
- Modify: `src/App.css` (append a `:where()` block for `.dice-row`, as `PlayingCard`'s block does), `docs/architecture.md` (the platform list and Contracts section name `shared/tricks.ts` and `Dice.tsx`)

**Interfaces:**
- Produces: default export `Dice(props: { values: number[]; selected?: boolean[]; onToggle?: (index: number) => void; disabled?: boolean; label: string; animKeyPrefix?: string })`. Draws one six-sided die per value with pips on a 3 by 3 grid (the `PIPS` table from `games/catan/client/Dice.tsx`). With `onToggle` each die is a `<button aria-pressed={selected[i]}>` with `aria-label` like `die 3: 5`; otherwise a `<span>`. The row is a `role="group"` with `aria-label={label}`. `data-anim-key={`${animKeyPrefix}-${i}`}` on each die when the prefix is given. Classes: `dice-row`, `dice-die`, `dice-die-selected`, `dice-pip`. Colors through `--dice-face`, `--dice-pip`, `--dice-selected` with light and dark defaults.

- [ ] **Step 1:** Implement the component and its CSS.
- [ ] **Step 2:** Run `npm run typecheck && npm run lint && npm test`. Expected: all pass. (The component is browser-checked in Tasks 6 and 12, where it first appears on a page.)
- [ ] **Step 3:** Commit `feat: shared dice component`, push `ten-new-games` (no PR yet).

---

## Game tasks (3 to 12), one agent each, all in parallel after Task 2

Every game task has the same shape. The agent:

1. Creates a worktree for branch `game-<id>` from `ten-new-games` (superpowers:using-git-worktrees), runs `npm install` and `npx playwright install chromium` in it.
2. Reads the spec section for its game, the Wikipedia article (and the official rules where the article is vague), and the model game named in the task end to end.
3. Writes with TDD, committing at least once per item below:
   - `types.ts` and `rules.ts` with `rules.test.ts`: the task's pinned tests, plus setup, every move type, scoring, game end, `invalid moves`, `dismissed player mid-turn`, `table view hides hands` and, where the game has a hidden pile, `undo reshuffles`.
   - `index.ts` (the `GameDefinition` with the task's `info`), `manager.test.ts` (a short seeded game through `createGameManager`, including a rejoin mid-turn).
   - `client/`: `GameScreen.tsx`, `HistoryBoard.tsx` (takes `viewer`), `describeMove.ts` with `describeMove.test.ts` (returns `''` for `lastMove: null`), `faq.ts`, `index.ts` (the `ClientGame` with the task's `icon`), `<id>.css`, and `animateMove.ts` where something slides or rolls.
   - `README.md` in the shape of `games/rook/README.md` (Rules, Controls, Differences from Wikipedia, citing the article), then the registry lines, the main README list entry and count.
   - `e2e/<id>.spec.ts`: one test per rule, control and difference in the README, built on `e2e/fixtures.ts` (`seat`, `patch`, `random`, `dice`) as `e2e/war.spec.ts` does.
4. Runs `npm test`, `npm run typecheck`, `npm run lint`, `npx playwright test e2e/<id>.spec.ts`: all pass.
5. Browser check: `PORT=<port> DATABASE_PATH=data/<id>.sqlite npm run start` in its worktree, then in Chrome one tab per player (the minimum count, and the maximum where the task says so). Plays through at least one full round or a forced game end, opens History and steps through it, downloads the game file, opens it with "Open a saved game", and checks "View as" for two seats. Checks the screen at 1280x800 and 800x900 for overlap or controls off-screen.
6. Pushes `game-<id>`. Reports: what was built, the README's differences, test and browser results, and anything it could not do. No PR.

**Lobby choice** (Tasks 4 and 11): a game action `{ type: 'choose…' }` any seated player may send while `started` is false; stored in state, kept by `resetLobby`, shown in the lobby to everyone, refused once started. Pinned test in each: `lobby choice is kept across joins and refused after the first move`.

**End vote** (Tasks 10 and 11): actions `{ type: 'voteEnd'; yes: boolean }` allowed only between hands or missions; the votes clear when a new hand or mission starts or a voter leaves; the game ends when every eligible player has voted yes. Each game owns its copy (two small uses; my call not to share it until a third needs it).

### Task 3: Connect Four

- **Info:** `{ id: 'connectfour', name: 'Connect Four', description: 'Drop discs into the grid and line up four in a row', minPlayers: 2, maxPlayers: 2 }`, icon `🔴`, port 3201. Model: `games/checkers` (two players, `shared/drawOffer.ts`).
- **Moves:** `{ type: 'drop'; column: number }` (0 to 6). Ending actions through `applyEndingAction`.
- **Pinned tests:** `a disc falls to the lowest empty cell`; `a full column is refused`; `four in a row wins horizontally, vertically and on both diagonals`; `a full board with no four is a draw`; `resign and draw by agreement end the game`.
- **Hidden:** nothing.

### Task 4: Dominoes

- **Info:** `{ id: 'dominoes', name: 'Dominoes', description: 'Match tile ends to build a line and be first to play out your hand', minPlayers: 2, maxPlayers: 4 }`, icon `🁫`, port 3202. Model: `games/uno` for hands, rounds and Continue.
- **Lobby choice:** `{ type: 'chooseSet'; set: 6 | 9 }`, default 6.
- **Moves:** `{ type: 'play'; tile: number; end: 'left' | 'right' }` (a tile id; `end` ignored for the first tile), `{ type: 'draw' }` (only when no tile in hand fits and the boneyard is not empty), `{ type: 'pass' }` (only when no tile fits and the boneyard is empty). Continue is the action `{ type: 'acknowledgeRound' }`.
- **Pinned tests:** `double-six has 28 tiles and double-nine 55`; `hand size and first lead follow the article for each set and player count` (values copied from the article into a comment with its section name); `a tile must match the open end it is played on and is flipped to fit`; `draw is allowed only when nothing fits`; `pass is allowed only when nothing fits and the boneyard is empty`; `playing out the hand ends the round with the article's scoring`; `a blocked round goes to the lowest pip total`; `the game ends at the article's target score`.
- **Hidden:** hands and the boneyard.

### Task 5: Euchre

- **Info:** `{ id: 'euchre', name: 'Euchre', description: 'Make trump with your partner in a fast trick-taking game where jacks are on top', minPlayers: 4, maxPlayers: 4 }`, icon `🃏`, port 3203. Model: `games/rook` (partnerships, bidding, Continue, leaving).
- **Uses:** `standardDeck` filtered to 9 to A, `shuffle`, `canFollow` and `trickWinner` with a `suitOf` that makes the left bower a trump, `PlayingCard`.
- **Moves:** `orderUp`, `pass` (first round), `nameTrump { suit }`, `pass` (second round), `goAlone { alone: boolean }` for the maker, `discard { card }` for the dealer after picking up, `play { card }`. Continue is `{ type: 'acknowledgeRound' }`.
- **Pinned tests:** `24 cards, 5 each, one turned up and three in the kitty`; `the right and left bowers rank above the other trumps and the left bower follows trump, not its own suit`; `ordering up gives the dealer the turned card and a discard`; `second round may not name the turned-down suit`; `all pass twice redeals with the next dealer`; `a lone maker's partner sits out the hand`; `scoring is 1 for 3 or 4 tricks, 2 for a march, 4 for a lone march, 2 to the defenders for a euchre`; `first team to 10 wins`; `a player leaving ends the game and the other team wins`.
- **Hidden:** hands, the kitty except the turned card, the dealer's discard.

### Task 6: Farkle

- **Info:** `{ id: 'farkle', name: 'Farkle', description: 'Roll six dice, bank your points or push your luck and risk them all', minPlayers: 2, maxPlayers: 8 }`, icon `🎲`, port 3204. Model: `games/backgammon` for dice moves.
- **Uses:** `Dice` component.
- **Scoring table:** copied from Wikipedia's standard scoring into `scoring.ts` with the section name in a comment; `score(dice: number[]): number | null` returns null when any die in the selection does not score.
- **Moves:** `{ type: 'roll'; keep: number[] }` (indexes of the current roll to set aside, at least one scoring die; empty only for the first roll of the turn), `{ type: 'bank'; keep: number[] }`.
- **Pinned tests:** `single 1s are 100 and single 5s 50`; every combination in the copied table scores its value; `a selection with a non-scoring die is refused`; `a roll with nothing scoring farkles and ends the turn with zero`; `setting aside all six gives hot dice and a fresh six`; `reaching 10,000 gives everyone else one more turn and the highest total wins`.
- **Hidden:** nothing.

### Task 7: Hearts

- **Info:** `{ id: 'hearts', name: 'Hearts', description: 'Dodge the hearts and the queen of spades, or shoot the moon and take them all', minPlayers: 4, maxPlayers: 4 }`, icon `♥️`, port 3205. Model: `games/rook` for tricks and Continue.
- **Uses:** `standardDeck`, `rankValue(rank, true)`, `shuffle`, `canFollow`, `trickWinner` with trump `null`, `PlayingCard`.
- **Pass:** the action `{ type: 'pass'; cards: [number, number, number] }` (hand indexes); the hand's tricks start when all four have passed. The first time all four pass in the game the game sets `started: true`. No-pass hands skip straight to play.
- **Moves:** `{ type: 'play'; card: PlayingCard }`.
- **Pinned tests:** `pass direction cycles left, right, across, none`; `passed cards arrive only after all four pass`; `the 2 of clubs leads the first trick`; `no heart or queen of spades on the first trick unless the hand has nothing else`; `hearts cannot be led until broken unless the hand is all hearts`; `hearts are 1 point and the queen of spades 13`; `shooting the moon gives each other player 26`; `the game ends at 100 and the lowest score wins, ties share`; `a player leaving ends the game and the lowest score so far wins`.
- **Hidden:** hands; cards in a pending pass.

### Task 8: Rack-O

- **Info:** `{ id: 'racko', name: 'Rack-O', description: 'Draw and swap cards to put your ten-slot rack in order', minPlayers: 2, maxPlayers: 4 }`, icon `📶`, port 3206. Model: `games/skipbo` for draw and discard piles.
- **Moves:** `{ type: 'draw'; from: 'deck' | 'discard' }`, then `{ type: 'place'; slot: number }` (0 to 9, the replaced card is discarded) or `{ type: 'discard' }` (only for a card drawn from the deck). Continue is `{ type: 'acknowledgeRound' }`.
- **Pinned tests:** `deck size per player count follows the article` (values in a comment with the section name); `the deal fills slots in order and the rack cannot be rearranged`; `a card taken from the discard pile must be placed`; `an ascending rack calls Rack-O and ends the round`; `round scoring follows the article`; `an empty draw pile reshuffles the discards but the top card`; `the game ends at the article's target score`.
- **Hidden:** other players' racks, the draw pile, the card drawn from the deck until placed or discarded.

### Task 9: Spades

- **Info:** `{ id: 'spades', name: 'Spades', description: 'Bid your tricks with your partner, spades are always trump', minPlayers: 4, maxPlayers: 4 }`, icon `♠️`, port 3207. Model: `games/rook`.
- **Uses:** `standardDeck`, `rankValue(rank, true)`, `canFollow`, `trickWinner` with trump `'spades'`, `PlayingCard`.
- **Moves:** `{ type: 'bid'; tricks: number }` (0 to 13, 0 is nil), `{ type: 'play'; card: PlayingCard }`. Continue is `{ type: 'acknowledgeRound' }`.
- **Pinned tests:** `bidding goes around once from the dealer's left`; `spades cannot be led until broken unless the hand is all spades`; `a made contract scores 10 per trick bid plus 1 per bag`; `a set contract loses 10 per trick bid`; `ten bags cost 100`; `nil scores 100 made and loses 100 broken, apart from the partner's contract`; `500 wins and minus 200 loses`; `a player leaving ends the game and the other team wins`.
- **Hidden:** hands.

### Task 10: Texas Hold'em

- **Info:** `{ id: 'holdem', name: "Texas Hold'em", description: 'Two private cards, five shared ones, and betting with play chips', minPlayers: 2, maxPlayers: 8 }`, icon `♣️`, port 3208. Model: `games/uno` for hands and Continue.
- **Uses:** `standardDeck`, `rankValue(rank, true)`, `shuffle`, `PlayingCard`. Hand ranking in `handRank.ts`: `bestHand(cards: PlayingCard[]): { category: number; tiebreak: number[]; name: string }` over 7 cards.
- **Values:** 1,000 starting chips, blinds 10 and 20, fixed.
- **Moves:** `{ type: 'fold' }`, `{ type: 'check' }`, `{ type: 'call' }`, `{ type: 'raise'; to: number }` (total bet this round; an all-in for less than a full raise is allowed and does not reopen betting, as the article says). Continue between hands is `{ type: 'acknowledgeRound' }`; the end vote is the shared shape above.
- **Pinned tests:** `the button moves each hand and blinds are posted left of it`; `heads-up the button posts the small blind and acts first before the flop`; `a raise must be at least the last raise`; `betting ends when every active player has matched or is all in`; `side pots split correctly with three different all-in amounts`; `hand ranking orders every category and breaks ties by kickers` (including the wheel A-2-3-4-5); `a split pot gives the odd chip as the article says`; `a player with no chips is out and skipped`; `the end vote ends the game only when every player with chips votes yes, ranked by chips`; `one player with every chip ends the game`; `a player leaving folds their hand, their chips leave the table and the hand goes on`.
- **Hidden:** hole cards and the deck; at showdown, the hands still in are shown; a folded or uncalled winner's cards stay hidden.

### Task 11: The Crew

- **Info:** `{ id: 'thecrew', name: 'The Crew', description: 'Work together to complete mission tasks in a trick-taking game with little talking', minPlayers: 3, maxPlayers: 5 }`, icon `🚀`, port 3209. Model: `games/rook` for tricks.
- **Uses:** `shuffle`, `canFollow`, `trickWinner` with rockets as the trump suit.
- **Data:** `missions.ts` with all 50 missions of the original logbook: task count, task order tokens, and each special rule as structured data, sourced from the web and cross-checked between at least two sources, sources cited in the README. Mechanics only, no story text. A test asserts 50 missions numbered 1 to 50.
- **Lobby choice:** `{ type: 'chooseMission'; mission: number }`, 1 to 50, default 1.
- **Moves:** task choosing in commander order (`{ type: 'takeTask'; task: number }`), the commander's decisions where a mission has one, `{ type: 'play'; card }`. **Actions:** `{ type: 'communicate'; card; token: 'highest' | 'lowest' | 'only' }` between tricks only, once per player per mission, refused if untrue or forbidden by the mission; Continue after a mission `{ type: 'acknowledgeRound' }`; the end vote between missions.
- **Pinned tests:** `40 colored cards 1 to 9 and 4 rockets`; `the holder of the 4 rocket is commander`; `rockets are trump`; `a task is done when its owner wins the trick with that card`; `task order tokens are enforced`; `communication is allowed only between tricks, once per mission, and must be true`; `success deals the next mission and failure retries it with the attempt count up`; `every mission's special rule has a test` (one per distinct rule kind); `completing mission 50 ends the game with the whole crew as winners`; `the end vote ends the game naming the last mission done`; `a player leaving ends the game`.
- **Hidden:** hands; tasks and communicated cards are public.

### Task 12: Yahtzee

- **Info:** `{ id: 'yahtzee', name: 'Yahtzee', description: 'Roll five dice up to three times and fill every scoring box', minPlayers: 2, maxPlayers: 8 }`, icon `🎲`, port 3210. Model: `games/backgammon` for dice.
- **Uses:** `Dice` component.
- **Moves:** `{ type: 'roll'; hold: boolean[] }` (five flags; all false and ignored on the first roll), `{ type: 'score'; category: Category }`.
- **Pinned tests:** `three rolls at most`; `each category scores as the article says` (one test per category); `the upper bonus is 35 at 63 or more`; `a second Yahtzee gives 100 and follows the Joker rule`; `a category can be scored only once, zero allowed`; `the game ends after 13 rounds and the highest total wins, ties share`.
- **Hidden:** nothing.

---

### Task 13: Coordinator review, merge and the one PR

- [ ] **Step 1:** As each agent reports, run superpowers:requesting-code-review on its branch against `ten-new-games`, fix or send back findings, and confirm the browser check was reported.
- [ ] **Step 2:** Merge every `game-<id>` into `ten-new-games`, resolving `games/registry.ts`, `src/clientGames.ts`, README and `docs/architecture.md` conflicts by keeping every game, alphabetical, and setting the game count to 31.
- [ ] **Step 3:** Run `npm test`, `npm run typecheck`, `npm run lint` and the full `npm run test:e2e`. Expected: all pass. Load the landing page in Chrome and open each new game once.
- [ ] **Step 4:** Push `ten-new-games` and open one PR with `gh pr create --base master` titled "Ten new games", listing each game, its differences from Wikipedia, and test results.
- [ ] **Step 5:** After the owner merges, `git checkout master && git pull`, and remove the ten worktrees.

# Seven New Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Go Fish, Monopoly, Rook, Rummikub, Skip-Bo, Splendor and War to the site, each a complete game on the existing platform.

**Architecture:** The coordinator first builds three shared pieces (a shuffle, the standard 52-card deck, a playing card component) on `seven-new-games`. Then seven agents run in parallel, one per game, each in its own git worktree on branch `game-<id>` from `seven-new-games`, each adding one `games/<id>/` folder plus one line in each registry and opening its own PR.

**Tech Stack:** TypeScript, React 19, Vite, Express and `ws`, `node --test`, Node 22.18+ through nvm.

**Spec:** `docs/superpowers/specs/2026-10-18-seven-new-games-design.md`

## Global Constraints

- No new npm dependency (spec Goals).
- Rules follow the game's Wikipedia article; where it is silent, the publisher's official rules; every difference listed in the README under "Differences from Wikipedia".
- Hidden information goes through `toPublicState`; `viewer: null` sees no hand, deck order or face-down card.
- A game agent touches nothing outside `games/<id>/` except: one line in `games/registry.ts` (alphabetical by name), one line in `src/clientGames.ts`, the README game list and the game count in its first sentence, and `docs/architecture.md` only where it lists games by name. A needed platform change is reported, not made.
- CSS is scoped under `[data-game="<id>"]`; works in the light and dark themes.
- No em-dashes in READMEs, FAQs, comments or commit messages.
- `npm test`, `npm run typecheck` and `npm run lint` pass before any PR.
- Commits end with the session's Co-Authored-By and Claude-Session lines; PR bodies end with the Claude Code line and session link.

## Review Focus

- A player dismissed mid-game while it is their turn, or while they hold a pending decision (an auction, a trade, a bid, the nest, a war in progress): the game moves on without them and never waits forever. Each game task has a `dismissed player mid-turn` test.
- A rejoin or refresh mid-turn shows the same half-finished turn (Rummikub's committed table, Splendor's token return, Monopoly's pending buy): the turn's in-progress state lives in the server state, not only in the browser. Each game's manager test rejoins mid-turn.
- History and game files: the table view (`viewer: null`) for every step leaks no hand, deck or face-down card, and "View as" shows that seat's own hand. Each game task has a `table view hides hands` test over every step of a short game.
- Untrusted moves: a move naming a card the player does not hold, a seat that is not seated, a negative or non-integer amount, or a malformed object returns `{ error }` and leaves the state unchanged. Each game task has an `invalid moves` test.
- Running out: an empty draw pile, stock or pool mid-game (reshuffle where the rules say so, otherwise the rule for an empty pile) never throws. Covered per game where the game has one.

---

### Task 1: Shared shuffle

**Files:**
- Create: `shared/shuffle.ts`
- Test: `shared/shuffle.test.ts`

**Interfaces:**
- Produces: `shuffle<T>(items: readonly T[], random: Random): T[]`, returns a new array, Fisher-Yates over `random()` as in `games/uno/rules.ts:71`.

- [ ] **Step 1: Write the failing tests** `shuffle keeps every item and leaves the input alone` (same multiset, input array unchanged) and `shuffle follows random` (with `random = () => 0`, `shuffle([1, 2, 3, 4])` deep-equals `[2, 3, 4, 1]`).
- [ ] **Step 2:** Run `node --test shared/shuffle.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `shuffle` in `shared/shuffle.ts`.
- [ ] **Step 4:** Run `node --test shared/shuffle.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: shared shuffle for new games`.

### Task 2: Standard playing cards

**Files:**
- Create: `shared/playingCards.ts`
- Test: `shared/playingCards.test.ts`

**Interfaces:**
- Produces:
  - `type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'`
  - `type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'`
  - `type PlayingCard = { suit: Suit; rank: Rank }`
  - `SUITS: readonly Suit[]`, `RANKS: readonly Rank[]` (in the order above)
  - `standardDeck(): PlayingCard[]` (52 cards, suit-major in `SUITS` order, ranks in `RANKS` order)
  - `rankValue(rank: Rank, acesHigh: boolean): number` (2 to 10 face value, J 11, Q 12, K 13, A 14 when aces high else 1)
  - `cardName(card: PlayingCard): string` (for example `'10 of hearts'`, `'ace of spades'`, `'queen of clubs'`)
  - `sameCard(a: PlayingCard, b: PlayingCard): boolean`

- [ ] **Step 1: Write the failing tests:** `standard deck has 52 different cards, 13 per suit`; `rankValue orders aces by the flag` (`rankValue('A', true) === 14`, `rankValue('A', false) === 1`, `rankValue('K', true) === 13`, `rankValue('2', false) === 2`); `cardName spells out face cards` (`cardName({ suit: 'spades', rank: 'A' }) === 'ace of spades'`, `cardName({ suit: 'hearts', rank: '10' }) === '10 of hearts'`).
- [ ] **Step 2:** Run `node --test shared/playingCards.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `shared/playingCards.ts`.
- [ ] **Step 4:** Run it again. Expected: PASS.
- [ ] **Step 5:** Commit `feat: standard 52-card deck for War and Go Fish`.

### Task 3: Playing card component, docs, branch push

**Files:**
- Create: `src/components/PlayingCard.tsx`
- Modify: `src/App.css` (append a `:where()` block for `.playing-card`), `docs/architecture.md` (the platform list and Contracts section name `shared/shuffle.ts`, `shared/playingCards.ts` and `PlayingCard.tsx`)

**Interfaces:**
- Consumes: `PlayingCard`, `cardName` from Task 2.
- Produces: default export `PlayingCard(props: { card: PlayingCard | null; size?: 'small' | 'medium' | 'large'; animKey?: string; highlighted?: boolean; selected?: boolean; onClick?: () => void; disabled?: boolean })`. `card: null` draws a face-down back. With `onClick` it renders a `<button>` with `aria-label={cardName(card)}`, otherwise a `<span>` with `title`. Rank and suit symbol (`♣ ♦ ♥ ♠`) in two corners and a large suit in the middle; hearts and diamonds red. `data-anim-key={animKey}` on the root. Default size `medium`. Classes: `playing-card`, `playing-card-<size>`, `playing-card-back`, `playing-card-red`, `playing-card-highlighted`, `playing-card-selected`.

- [ ] **Step 1:** Implement the component and its CSS. Colors through CSS variables (`--playing-card-face`, `--playing-card-back`, `--playing-card-red`, `--playing-card-black`) with light and dark defaults, so a game can retheme them on `[data-game]`.
- [ ] **Step 2:** Run `npm run typecheck && npm run lint && npm test`. Expected: all pass. (The browser check for the component happens in Tasks 4 and 5, where it first appears on a page.)
- [ ] **Step 3:** Commit `feat: playing card component`, push `seven-new-games`, open its PR with `gh pr create --base master` (title "Seven new games: design, plan and shared card pieces").

---

## Game tasks (4 to 10), one agent each, all in parallel after Task 3

Every game task has the same shape. The agent:

1. Creates a worktree for branch `game-<id>` from `seven-new-games` (superpowers:using-git-worktrees), runs `npm install` in it.
2. Reads the spec section for its game, the Wikipedia article, and `games/uno` (or the nearest existing game named in the task) end to end as the model.
3. Writes with TDD, committing at least once per item below:
   - `types.ts` and `rules.ts` with `rules.test.ts`: the task's pinned tests below, plus setup, every move type, scoring, game end, `invalid moves`, `dismissed player mid-turn` and `table view hides hands`.
   - `index.ts` (the `GameDefinition` with the task's `info`), `manager.test.ts` (a short seeded game through `createGameManager`, including a rejoin mid-turn).
   - `client/`: `GameScreen.tsx`, `HistoryBoard.tsx` (takes `viewer`), `describeMove.ts` with `describeMove.test.ts` (returns `''` for `lastMove: null`), `faq.ts`, `index.ts` (the `ClientGame` with the task's `icon`), `<id>.css`, and `animateMove.ts` where a move has something that slides.
   - `README.md` in the shape of `games/uno/README.md` (Rules, Controls, Differences from Wikipedia), then the registry lines, the main README list entry and count.
4. Runs `npm test`, `npm run typecheck`, `npm run lint`: all pass.
5. Browser check: `PORT=<port> DATABASE_PATH=data/<id>.sqlite npm run start` in its worktree, then in Chrome one tab per player (the minimum count, and the maximum where the task says so). It plays through at least one full round or a forced game end, opens History and steps through it, downloads the game file, opens it with "Open a saved game", and checks "View as" for two seats. It checks the screen at 1280x800 and 800x900 for overlap or controls off-screen.
6. Pushes and opens a PR with `gh pr create --base seven-new-games`, body: what was built, the README's differences, test and browser results. Reports the PR URL and anything it could not do.

### Task 4: War

- **Info:** `{ id: 'war', name: 'War', description: 'Flip cards, higher card takes both, and win the whole deck', minPlayers: 2, maxPlayers: 2 }`, icon `⚔️`, port 3101. Model: `games/uno` for state and hands.
- **Uses:** `standardDeck`, `rankValue(rank, true)`, `shuffle`, `PlayingCard` component.
- **Moves:** `{ type: 'flip' }` only. The turn passes after each flip; the battle settles on the second flip; the second flipper starts the next battle. A war (tie) has each player put one card face down and one face up, both taken by each player's flip move (each flip during a war lays that player's down card and up card); repeats on another tie. A player out of cards in a war uses their last card face up; a player with no cards left loses.
- **Auto-flip:** a checkbox in `GameScreen` (local React state, off by default, not stored), that sends `{ type: 'flip' }` 1000 ms after it becomes this player's turn and the game is not over and no vote is running.
- **Pinned tests:** `deal gives each player 26`; `higher card takes both` (seeded piles, aces beat kings); `a tie starts a war and the winner takes all six`; `a player out of cards during a war uses their last card face up`; `won cards go under the winner's pile in random order` (the `random` passed decides the order); `game ends when one player has all 52`.
- **Hidden:** both piles' order; only counts and the battle's cards are public.

### Task 5: Go Fish

- **Info:** `{ id: 'gofish', name: 'Go Fish', description: 'Ask for ranks, go fish, and collect the most books of four', minPlayers: 2, maxPlayers: 6 }`, icon `🐟`, port 3102. Model: `games/uno`.
- **Uses:** `standardDeck`, `shuffle`, `PlayingCard` component.
- **Moves:** `{ type: 'ask'; target: Seat; rank: Rank }` (only a rank the asker holds, only another seated player who holds cards).
- **Pinned tests:** `deal is 7 each for 2 or 3 players and 5 for 4 or more`; `a hit hands over every card of the rank and the asker goes again`; `go fish drawing the asked rank goes again, any other card passes the turn`; `four of a rank are laid down as a book at once` (including books completed by the deal); `a player with an empty hand draws one, or is out when the stock is empty`; `the game ends with all 13 books, most books win, ties share`; `the ask log is public in every view`.
- **Hidden:** hands and the stock.

### Task 6: Skip-Bo

- **Info:** `{ id: 'skipbo', name: 'Skip-Bo', description: 'Build piles from 1 to 12 and be first to empty your stock pile', minPlayers: 2, maxPlayers: 6 }`, icon `🃏`, port 3103. Model: `games/phase10` for multi-pile hand play.
- **Moves:** `{ type: 'play'; from: { kind: 'hand'; index: number } | { kind: 'stock' } | { kind: 'discard'; pile: 0 | 1 | 2 | 3 }; to: 0 | 1 | 2 | 3 }` (a building pile) and `{ type: 'discard'; handIndex: number; pile: 0 | 1 | 2 | 3 }`, which ends the turn.
- **Pinned tests:** `deck has 162 cards, twelve of each 1 to 12 and 18 Skip-Bo`; `stock is 30 each for 2 to 4 players and 20 for 5 or 6`; `hand refills to 5 at turn start and when emptied mid-turn`; `a building pile starts with 1 or Skip-Bo and takes the next number`; `a Skip-Bo plays as the next number`; `a pile reaching 12 is shuffled into the draw pile`; `cannot play from a discard pile onto another discard pile or play to a discard pile except to end the turn`; `emptying the stock wins`; `an empty draw pile with no completed piles to reshuffle does not throw`.
- **Hidden:** hands, draw pile, all but the top of each stock (count shown).

### Task 7: Rook

- **Info:** `{ id: 'rook', name: 'Rook', description: 'Bid, take the nest, name trump and win tricks with your partner to 500', minPlayers: 4, maxPlayers: 4 }`, icon `🐦`, port 3104. Model: `games/uno` for rounds and Continue; `games/azul` for the round-acknowledge action.
- **Variant:** Kentucky Discard as the Wikipedia article gives it. The agent copies the article's deck, rank order (including where the Rook card ranks and when it may be played), point values, nest size, minimum and maximum bid and last-trick bonus into a comment at the top of `rules.ts` with the article's section name, and the tests use those values.
- **Moves:** `bid` (amount, multiple of 5) or `pass` during bidding; `discard` (the nest-size cards) and `nameTrump` for the bid winner; `play` (one card) during tricks. Continue after a hand is the action `{ type: 'acknowledgeRound' }`.
- **Pinned tests:** `deck and deal match the variant` (card count, hand size, nest size); `bidding goes around in steps of 5 and a pass is final`; `the bid winner takes the nest and discards back to a hand`; `must follow suit when able`; `trick goes to the highest trump, else the highest of the led suit`; `points per hand total the variant's maximum, last-trick bonus included`; `bidding team that misses loses its bid`; `first team to 500 wins after Continue`; `a player leaving ends the game and the other team wins`.
- **Hidden:** hands and the nest; discards hidden from all but the bidder.

### Task 8: Rummikub

- **Info:** `{ id: 'rummikub', name: 'Rummikub', description: 'Lay down sets and runs of numbered tiles and rearrange the table to empty your rack', minPlayers: 2, maxPlayers: 4 }`, icon `🀄`, port 3105. Model: `games/scrabble` for racks and a server-checked play; `games/phase10` for group validation.
- **Tiles:** each has a stable `id: number` (0 to 105) so a rearranged table can be checked tile by tile.
- **Moves:** `{ type: 'play'; table: number[][] }` (the whole table as groups of tile ids, in order; the server derives the rack) and `{ type: 'draw' }`. Joker values are inferred from their position in each group.
- **Pinned tests:** `106 tiles and 14 each`; `set is 3 or 4 of one number in different colors`; `run is 3 or more in a row of one color, no wrap from 13 to 1`; `first meld must reach 30 from own tiles and may not touch the table`; `a play must add at least one rack tile and leave every group valid`; `a play may not take a table tile back to the rack`; `a joker taken from the table must be replaced by its tile and played again that turn`; `emptying the rack ends the round with the scores`; `empty pool and everyone passing a full round: lowest rack wins`.
- **Hidden:** racks and the pool.
- **Screen:** the player rearranges locally (drag and drop, plus click to pick up and click to place) and sends one `play`; Reset restores the server's table. Others see the committed table.

### Task 9: Splendor

- **Info:** `{ id: 'splendor', name: 'Splendor', description: 'Collect gems, buy development cards and attract nobles to reach 15 prestige', minPlayers: 2, maxPlayers: 4 }`, icon `💎`, port 3106. Model: `games/azul` for a shared market.
- **Data:** `cards.ts` with the 90 published development cards (level, bonus color, prestige, cost) and the 10 nobles (3 prestige each, cost), checked against two independent published lists; a test asserts 40 level 1, 30 level 2, 20 level 3 and 10 nobles.
- **Moves:** `takeThree` (3 different colors, or fewer only when fewer colors remain), `takeTwo` (one color with 4+ left), `reserve` (a face-up card or the top of a level's deck), `buy` (face-up or own reserved card, paying with gems and gold after bonuses), then, when needed, `returnTokens` (down to 10) and `chooseNoble` (when more than one qualifies) as the same player's follow-up moves before the turn passes.
- **Pinned tests:** `token counts are 4, 5 and 7 per color for 2, 3 and 4 players, and 5 gold`; `nobles are players plus one`; `take two needs 4 left of that color`; `reserve gives a gold when any is left and caps at 3 reserved`; `bonuses discount costs and gold pays any shortfall`; `over 10 tokens returns down to 10 before the turn passes`; `a qualifying noble visits at the end of the turn, one per turn, chosen when several`; `reaching 15 finishes the round, most prestige wins, ties go to fewest cards`.
- **Hidden:** deck order; a card reserved from a deck shows only its level to others.

### Task 10: Monopoly

- **Info:** `{ id: 'monopoly', name: 'Monopoly', description: 'Buy, trade and build on properties and bankrupt every other player', minPlayers: 2, maxPlayers: 8 }`, icon `🎩`, port 3107. Model: `games/parchisi` for dice and a track; `games/uno` for action-driven out-of-turn input.
- **Data:** `board.ts` with the 40 standard US spaces (prices, rents, house costs, mortgage values), and the 16 Chance and 16 Community Chest cards, as the current official rules give them.
- **Moves (turn player):** `roll`, `buy`, `decline` (starts the auction), `build`, `sellBuilding`, `mortgage`, `unmortgage`, `payJailFine`, `useJailCard`, `endTurn`, `declareBankruptcy`. **Actions (any player):** `bid` and `passBid` in an auction; `offerTrade`, `answerTrade`, `cancelTrade`. Building, selling and mortgaging off-turn to raise money owed are moves of the player who owes, while the turn waits on them.
- **Pinned tests:** `each player starts with $1500` and `passing Go pays $200`; `three doubles in a turn sends you to jail`; `jail: pay $50, card, or doubles; pay on the third failed roll`; `declining to buy starts an auction for every player and the high bid buys`; `a monopoly doubles unimproved rent`; `building must be even and stops at 32 houses and 12 hotels`; `unmortgaging costs the mortgage plus 10%`; `a trade moves property, cash and jail cards only when both agree`; `bankrupt to a player hands over everything; to the bank, properties are auctioned`; `last player left wins`; `no Free Parking money`.
- **Hidden:** Chance and Community Chest order only.

### Task 11: Coordinator review and merge order

- [ ] **Step 1:** As each PR arrives, run superpowers:requesting-code-review on it, fix or send back findings, and confirm its browser check was reported.
- [ ] **Step 2:** After `seven-new-games` merges, retarget open game PRs to `master` (`gh pr edit <n> --base master`).
- [ ] **Step 3:** After each game PR merges, rebase the remaining `game-<id>` branches on `master`, resolving `games/registry.ts`, `src/clientGames.ts` and README conflicts by keeping every game, alphabetical, and fixing the game count; rerun `npm test`, push.

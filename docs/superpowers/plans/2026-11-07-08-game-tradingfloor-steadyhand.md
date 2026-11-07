# Trading Floor and Steady Hand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two real-time games: Trading Floor (`tradingfloor`, Card games, 3 to 8 players), an open-outcry commodity trading game with the Bull and Bear house rule, and Steady Hand (`steadyhand`, Party games, 1 to 8 players), a steady-hand game where you drag a part out of a twisting slot without touching the walls, with the Buzzes allowed house rule.

**Architecture:** Two new folders on the `GameDefinition` contract, with no platform change. **Trading Floor** follows Jigsaw's Together mode: no turns (`currentPlayer` stays `null`, `ownTurnLimit: true`), every step is a game action from any seat at any time; swaps and corners are recorded actions (`recordsAction`), offers and withdrawals are not; hands go through `toPublicState`, `privateSeatView`. **Steady Hand** follows Jenga: turns are moves, and the live drag is unrecorded `applyAction` calls (`pick`, `drag`, `drop`) by the current player, which the platform applies, broadcasts and never records (no `recordsAction`); the browser checks the pointer against the slot shape and sends the result (`out` or `buzz`) as the turn move, which is recorded and undoable.

**Tech Stack:** TypeScript, React 19, SCSS, SVG, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-party-games-and-polish-design.md`, sections "Goals", "Anti-goals", "Shared ground", "Rules for every agent", "Trading Floor" and "Steady Hand". Read it with this plan.

**Branch:** `game-tradingfloor-steadyhand`, in its own worktree, from `party-games-and-polish`. Site `PORT=3808`, e2e `E2E_PORT_BASE=8800` (never 6000). PR into `party-games-and-polish`.

**How the live drag fits the platform (checked in `server/games.ts`):** `manager.action` runs `applyAction`; when `recordsAction` is missing or false it sets `room.state` and calls `save`, and `respond` in `server/server.ts` broadcasts every seat's view. So an unrecorded action is exactly "everyone sees it live, History never does". The one cost: `save` also upserts the live state row in the store on each action (it skips that only while `simulating` is true). Using `simulating` instead was rejected: the simulation timer broadcasts every 50 ms on its own, so a drag would send twice as many frames. At 20 updates a second of a small state the upsert is acceptable; no platform change is needed. The recorded turn move's "before" snapshot holds the last streamed position, so `resumeClock` (run after an approved undo and on load after a restart) clears it.

## Global Constraints

**Trading Floor** (spec values verbatim):
- Id `tradingfloor`, name `Trading Floor`, category `'card'`, `minPlayers: 3`, `maxPlayers: 8`, `ownTurnLimit: true`, `passAndPlay: false`.
- An original commodity-trading card game (commodities such as Copper, Coffee, Cotton, Cocoa, Silver, Sugar, Soy and Saffron, each with a point value). The deck holds one commodity per player, 9 cards each, and each player is dealt 9 cards.
- **No turns: everyone trades at once.** A player puts up an offer of 1 to 4 cards that must all be the same commodity, showing only the count ("3!"). Any other player with an open offer of the same count can accept it, and the cards swap blind. Offers can be withdrawn. Offers, accepts and withdrawals are game actions; a swap is recorded in History.
- Whoever first holds all 9 of one commodity presses **Corner!** and wins the round, scoring that commodity's value. First to the target score (house rule: 250 or 500; standard 500) wins the game.
- **House rule "Bull and Bear"** (off by default), following Pit's rules on Wikipedia: one Bull and one Bear are added to the deck, so two players are dealt 10 cards. Either card may ride along in any offer with the commodity cards (it does not have to match them). The Bull is wild for a corner: 8 of a commodity plus the Bull corners for its value, and all 9 plus the Bull corners for double. The Bear cannot be part of a corner. Whoever holds the Bear when a round ends loses 20 points, and whoever holds the Bull without cornering loses 20 too.
- Two players accepting the same offer at once: the first to reach the server wins, and the other gets a quiet "already taken" with nothing lost. Hands are private views.
- Rules checked against Wikipedia's [Pit (game)](https://en.wikipedia.org/wiki/Pit_(game)) article; no content from it.

**Steady Hand** (spec values verbatim):
- Id `steadyhand`, name `Steady Hand`, category `'party'`, `minPlayers: 1`, `maxPlayers: 8`, `continuesAlone: true`.
- An original theme (a robot repair bay). A board of parts sits in narrow, twisting slots.
- On your turn you pick a part, then drag it out along its slot to the exit with the cursor or a finger. Touching a slot wall buzzes and ends your turn, and the part goes back. A part brought out scores its value. Slots vary in width and length, so harder parts score more.
- A buzzed part stays in its slot for anyone to try. The game ends when every part is out, and the highest score wins.
- **House rule "Buzzes allowed"**: Unlimited, 1, 3 or 5 per player. The standard is 3 at every player count (coordinator's decision: no `standardFor`, because `afterSeatChange` would keep a solo room's 3 when friends join anyway). A player who has used all their buzzes is out of turns; the game ends when every part is out or nobody has buzzes left.
- **Solo:** the game is a score attack: your score is the value of the parts you got out, plus a bonus for each buzz you have left if you cleared the board.
- **Live play:** the dragging player's position is checked in their own browser against the slot shapes, and the result (out or buzzed) is sent as the turn move. Everyone else watches the part move live from a throttled stream (at most 20 updates a second), which is not recorded in History. Trusting the player's browser is acceptable for a friends' game.
- House rule: wall tolerance (Easy, Normal or Hard), which widens or narrows every slot.
- Rules checked against Wikipedia's [Operation (game)](https://en.wikipedia.org/wiki/Operation_(game)) article; no content from it.

**Both:**
- Each README lists every difference under "Differences from Wikipedia" in the format of `games/rook/README.md`; where the spec disagrees with Wikipedia, the spec wins and the README lists it. No name, character, art or card text from a commercial game; "Pit" and "Operation" appear only in the README's Wikipedia link line.
- Anti-goal: a real-time game that refuses a fair action because a friend acted a moment earlier, or that floods the socket.
- Files outside the two game folders: one line each in `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `shared/categories.test.ts` (`card` gets `tradingfloor`, `party` gets `steadyhand`, both counts 42 to 44), `games/privateSeatView.test.ts` (a `tradingfloor` entry in `CASES`), and the new `e2e/tradingfloor.spec.ts` and `e2e/steadyhand.spec.ts`. Neither game has a `secretState`, so `games/secretState.test.ts` stays. Do **not** touch the root `README.md` game list or count, `e2e/landing.spec.ts`, `docs/architecture.md`, `e2e/fixtures.ts` or anything else in `src/`, `server/`, `shared/`. If a platform or fixture change seems needed, stop and report it.
- New e2e specs reach header controls only through `headerButton(page, name)` from `e2e/fixtures.ts`.
- No new npm dependency. No em-dashes in code comments, README, FAQ or commit messages.
- Every commit message ends with these two lines (use `git commit -F -` with a heredoc so they stay one trailer block):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- If `node` is missing, prepend `C:\Users\Natha\AppData\Local\nvm\v22.22.3` to PATH (memory note).

**Resolved (Steady Hand, Buzzes allowed):** the standard is 3 at every seat count; no `standardFor`, no platform change.

## Review Focus

1. Two players accept the same offer within a moment: the first swaps; the second gets `Already taken`, keeps their own offer open and loses no card. An accept naming an offer that was withdrawn and replaced by the same seat's new offer is also `Already taken`, never a swap with the new one (Task 4 manager test, Task 3 rules test).
2. History (viewer `null`), a spectator, the table screen and a game file never show any hand or the commodities in an open offer, including in a swap's `lastMove`; after a swap each player sees only their own new cards (Task 3 `views` tests, Task 4).
3. A fast pointer flick that jumps over a slot wall between two pointer events buzzes, because the browser checks the whole segment between samples, not only the samples (Task 8 `geometry.test.ts`, `'a jump across a wall between samples buzzes'`).
4. A late `drag` packet that arrives after the turn passed, or a `drag` from a seat that is not dragging, is refused and never moves a part; an approved undo or a server restart mid-drag leaves no part floating (Task 8 `'drag from anyone but the dragger is refused'`, `'resumeClock lets go of the part'`).
5. The dragging player's own part follows their pointer and does not jump back when the server's echo of an older position arrives; only other viewers draw from the streamed position (Task 10 `liveDrag.test.ts`, `'the dragger draws the local position'`).

---

### Task 1: Worktree, branch and ports

**Files:** none in the repo.

- [ ] **Step 1:** From the main checkout: `git -C C:/Users/Natha/Documents/code/multiplayer-tabletop-games worktree add ../mtg-game-tradingfloor-steadyhand -b game-tradingfloor-steadyhand party-games-and-polish`. Expected: a worktree at `C:/Users/Natha/Documents/code/mtg-game-tradingfloor-steadyhand` on branch `game-tradingfloor-steadyhand`. All later work happens there.
- [ ] **Step 2:** Check the ports are free: `netstat -ano | grep -E ':(3808|880[0-9]) '` prints nothing. If one is taken, pick another site port and another e2e base a multiple of 100 from 8000 up that no other chunk uses (never 6000), use them everywhere this plan names 3808 or 8800, and say so in the PR.
- [ ] **Step 3:** `npm ci`, then `npm test`. Expected: PASS.

### Task 2: Trading Floor cards, options and types

**Files:**
- Create: `games/tradingfloor/info.ts`, `games/tradingfloor/options.ts`, `games/tradingfloor/types.ts`, `games/tradingfloor/cards.ts`
- Test: `games/tradingfloor/cards.test.ts`

**Interfaces:**
- Consumes: `targetScoreRule` from `shared/houseRules.ts`; `shuffle` from `shared/shuffle.ts`.
- Produces (`options.ts`): `TARGET_RULE = targetScoreRule(500, [250])`; `BULL_BEAR_RULE: ToggleRule` = id `bullBear`, label `Bull and Bear`, standard `false`, help `Adds a wild Bull and a costly Bear to the deck.`; `TRADINGFLOOR_RULES = [TARGET_RULE, BULL_BEAR_RULE]`.
- Produces (`info.ts`): `tradingfloorInfo: GameInfo`: the Global Constraints values, description `Shout out offers and swap cards blind until you corner one commodity`, `houseRules: TRADINGFLOOR_RULES`.
- Produces (`types.ts`):
  ```ts
  type Commodity = 'saffron' | 'silver' | 'coffee' | 'cocoa' | 'copper' | 'sugar' | 'cotton' | 'soy';
  type Card = { id: number; kind: Commodity | 'bull' | 'bear' };
  type Offer = { id: number; seat: Seat; cards: number[] };       // card ids, server side only
  type OpenOffer = { id: number; seat: Seat; count: number };     // what everyone sees
  type Corner = { commodity: Commodity; points: number; double: boolean };
  type RoundSummary = { round: number; winner: Seat; corner: Corner; hand: Card[]; penalties: Partial<Record<Seat, number>>; acknowledged: Seat[] };
  type LastMove = { type: 'swap'; seats: [Seat, Seat]; count: number } | { type: 'corner'; playerNumber: Seat; commodity: Commodity; points: number; double: boolean } | null;
  type GameState = BaseGameState & {
    phase: 'trading' | 'summary';
    round: number;
    hands: Partial<Record<Seat, Card[]>>;
    offers: Offer[];
    nextOfferId: number;
    scores: Partial<Record<Seat, number>>;
    summary: RoundSummary | null;
    lastMove: LastMove;
  };
  type PublicGameState = Omit<GameState, 'hands' | 'offers'> & BasePublicState & {
    hand: Card[];                    // the viewer's own; [] for null
    offering: number[];              // the viewer's own open offer's card ids; [] for null
    offers: OpenOffer[];
    handCounts: Record<Seat, number>;
  };
  ```
- Produces (`cards.ts`):
  - `COMMODITIES: { kind: Commodity; name: string; value: number }[]` in deal order: Saffron 100, Silver 85, Coffee 80, Cocoa 75, Copper 70, Sugar 60, Cotton 55, Soy 50.
  - `CARDS_EACH = 9`, `BULL_BEAR_PENALTY = 20`.
  - `deal(seats: Seat[], round: number, bullBear: boolean, random: Random): Partial<Record<Seat, Card[]>>`: the first `seats.length` commodities, 9 cards each, plus `bull` and `bear` when `bullBear`; shuffled; dealt one at a time starting from `seats[(round - 1) % seats.length]`, so with Bull and Bear the first two seats dealt to get 10.
  - `offerError(hand: Card[], cardIds: unknown): string | null`: `Offer 1 to 4 cards` (not an array of 1 to 4 distinct integers), `Those are not your cards`, `Offer cards of one commodity` (more than one commodity among the non-bull, non-bear cards). An offer of only the Bull and/or Bear is allowed (see Task 6 differences).
  - `cornerOf(hand: Card[]): Corner | null`: null when the hand holds the Bear; 9 of a commodity with the Bull is `double: true` and twice the value; 9 without the Bull, or 8 plus the Bull, is its value.

- [ ] **Step 1: Write the failing tests** in `cards.test.ts`:
  - `'three players deal three commodities, 9 each, 9 cards a hand'`; `'with Bull and Bear two hands hold 10 and the deck 29'`; `'the dealer rotates by round'` (with Bull and Bear, round 1 gives 10 to the first two seats, round 2 to seats 2 and 3).
  - `'an offer is 1 to 4 own cards of one commodity, with the Bull or Bear riding along'`: 4 Soy ok; 5 cards `Offer 1 to 4 cards`; Soy and Sugar `Offer cards of one commodity`; 3 Soy plus the Bear ok; the Bull alone ok; a card id not in the hand `Those are not your cards`; a repeated id `Offer 1 to 4 cards`.
  - `'corners: 9, 8 plus the Bull, 9 plus the Bull doubles, never with the Bear'`: Saffron ×9 gives `{ points: 100, double: false }`; ×8 + Bull 100; ×9 + Bull `{ points: 200, double: true }`; ×9 + Bear null; ×8 null.
  - `'commodity values are all different'`.
- [ ] **Step 2: Run** `node --test games/tradingfloor/cards.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four files.
- [ ] **Step 4: Run** `node --test games/tradingfloor/cards.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Trading Floor: cards, deal, offers and corners`.

### Task 3: Trading Floor rules and views

**Files:**
- Create: `games/tradingfloor/rules.ts`
- Test: `games/tradingfloor/rules.test.ts`, `games/tradingfloor/views.test.ts`

**Interfaces:**
- Consumes: Task 2; `acknowledge`, `awaiting`, `type RoundAccess` from `shared/rounds.ts`; `houseRule` from `shared/houseRules.ts`; `viewHand`, `handCounts` from `shared/hands.ts`; `rankStandings`, `pointsText` from `shared/standings.ts`; `seatFields` from `shared/spectators.ts`; `baseGameState` from `shared/seating.ts`.
- Produces (`rules.ts`): `createGameState(gameId)`, `resetLobby(state, random)`, `applyAction(state, seat, action, random)`, `recordsAction(state, seat, action): boolean`, `applyMove(): Result<GameState>` (always `{ error: 'Trading Floor has no turns' }`), `allowsUndoVote(): false`, `onPlayerLeft(state, seat, random)`, `onPlayerDisconnected(state, seat)`, `waitingOn(state)`, `finalStandings(state)`, `toPublicState(state, undoAvailable, viewer)`, `privateSeatView(state, seat)` = `seatFields(toPublicState(state, false, seat), ['hand', 'offering'])`.

Decisions:
- `resetLobby` deals round 1 for the seats and rule now (it runs after every join and rule change), `currentPlayer: null`, `phase: 'trading'`, no offers, scores 0.
- Actions, refused once `isGameOver` (`The game is over`) and, except `continue`, during `summary` (`The round is over`):
  - `{ type: 'offer', cards: number[] }`: `offerError`; replaces the seat's open offer if any; new id from `nextOfferId`. Sets `started: true` (as Jigsaw's first action does; the platform then holds it until everyone agreed). Not recorded.
  - `{ type: 'withdraw' }`: `You have no open offer`. Not recorded.
  - `{ type: 'accept', offer: number }`: the offer with that id must still be open, else `Already taken`; not your own (`That is your own offer`); you must have an open offer, else `Make an offer of ${count} first`, of the same count, else `Your offer must be ${count} cards`. The two offers' cards swap hands and both offers close; `lastMove: { type: 'swap', seats: [accepter, offerer], count }`; status `Alice and Bob swapped 3 cards`. Recorded.
  - `{ type: 'corner' }`: `cornerOf(hand)` or `You have no corner`. Scores the corner, then `-20` for every other seat holding the Bull and for every seat holding the Bear; `summary` with the winner's hand shown; `phase: 'summary'`; offers cleared. If any score reaches the target, the game is over: `winners` are the top totals (ties share). Recorded.
  - `{ type: 'continue' }` during `summary` through `acknowledge` with `RoundAccess` (`noun: 'round'`); everyone ready deals round `round + 1` with `deal`. Not recorded.
- `recordsAction` is true exactly for `accept` and `corner` while `phase === 'trading'` and not over.
- **No undo:** `allowsUndoVote` returns false, so the platform offers no undo. Trading Floor has no turn moves to undo, and undoing a swap would also wipe every offer made since.
- `onPlayerDisconnected` withdraws that seat's open offer.
- `onPlayerLeft`: with 3 or more left, the round is called off with no score and round `round + 1` is dealt to those left (one commodity per player again); with fewer than 3 left, the game ends with the scores as they stand, the top totals winning.
- `waitingOn`: `awaiting` during `summary`, else `[]`.
- `toPublicState`: `hand` is `viewHand(hands, viewer)`, `offering` the viewer's own offer's cards, `offers` mapped to `OpenOffer`, `handCounts`; `hands` and the offers' cards never leave otherwise. `lastMove` carries no cards.
- `finalStandings`: `rankStandings` by score descending, score text `pointsText`.

- [ ] **Step 1: Write the failing tests** (three seats, `seeded(3)`; hands patched to known cards):
  - `rules.test.ts`:
    - `'an offer shows only its count'`; `'a new offer replaces my open one'`; `'withdraw closes my offer'`; `'withdraw with nothing open is refused'`.
    - `'accepting swaps the two offers blind and records it'`: cards moved both ways, both offers closed, `recordsAction` true, `lastMove` without card kinds.
    - `'accept needs my own open offer of the same count'`: the two messages.
    - `'an offer withdrawn and replaced cannot be accepted by its old id'`: `{ error: 'Already taken' }`, my offer still open, hands unchanged.
    - `'Corner! with 9 scores the value and ends the round'`; `'a hand without a corner is refused'`.
    - `'Bull and Bear: 8 plus the Bull corners, 9 plus the Bull doubles, the Bear blocks, holders lose 20'`.
    - `'the game ends when a score reaches the target; 250 under the house rule'`.
    - `'Continue deals the next round once everyone is ready'`: `waitingOn` shrinks; the next deal starts one seat on.
    - `'actions during the summary are refused except Continue'`.
    - `'a player leaving mid-round redeals for those left; below three the game ends with the scores as they stand'`.
    - `'a disconnected player\'s offer is withdrawn'`.
    - `'there are no turns and no undo vote'`: `currentPlayer === null` after `resetLobby`, `allowsUndoVote` false.
  - `views.test.ts`:
    - `'a player sees only their own hand and own offered cards'`: seat 1's view has seat 1's hand, `offering` its ids; seat 2's view holds none of seat 1's card ids; `null` view has `hand: []`, `offering: []`.
    - `'no view names the commodities in an open offer'`: `JSON.stringify(offers)` in every view has no commodity name.
    - `'the summary shows the cornering hand to everyone'`.
- [ ] **Step 2: Run** `node --test games/tradingfloor/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** `node --test games/tradingfloor/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Trading Floor: trading, corners, rounds and hidden hands`.

### Task 4: Trading Floor registration and manager test

**Files:**
- Create: `games/tradingfloor/index.ts`, `games/tradingfloor/manager.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts` (after `tickettoride`, before `ultimatetictactoe`: the list is alphabetical by name), `shared/categories.test.ts` (`card` list, counts), `games/privateSeatView.test.ts` (`tradingfloor: s => [{ ...s, offers: [{ id: 1, seat: 1, cards: s.hands[1].slice(0, 2).map(c => c.id) }], nextOfferId: 2 }]`)

**Interfaces:**
- Produces: `tradingfloor: GameDefinition<GameState, PublicGameState>` with `info`, `createGameState`, `resetLobby`, `applyMove`, `applyAction`, `recordsAction`, `allowsUndoVote`, `onPlayerLeft`, `onPlayerDisconnected`, `waitingOn`, `finalStandings`, `toPublicState`, `privateSeatView`.

- [ ] **Step 1: Write the failing test** `manager.test.ts` through `createGameManager([tradingfloor], seeded(42))` with `rememberingKeys` and `agreeAll`:
  - `'two accepts of one offer: the first swaps, the second is already taken and keeps its offer'`: seats 2 and 3 each have an open offer of 2; both `manager.action(room, s, { type: 'accept', offer })` back to back; the first succeeds, the second is `{ error: 'Already taken' }`, seat 3's offer is still in `offers`, its hand unchanged.
  - `'offers are not History steps, swaps and corners are'`: `stepsOf(manager, 'tradingfloor')` grows only on accept and corner.
  - `'no history step shows a hand'`: every step's `hand` is `[]` and no step's `offers` has a `cards` field.
  - `'an action from a seat that offered a moment ago is never refused as stale'`: offer, then accept from another seat without `moveCount`.
  - `'requesting undo is refused'`.
- [ ] **Step 2: Run** `node --test games/tradingfloor/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `index.ts` and the registration lines.
- [ ] **Step 4: Run** the same plus `npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (client in Task 5).
- [ ] **Step 5: Commit** `Trading Floor: registration and manager test`.

### Task 5: Trading Floor client

**Files:**
- Create in `games/tradingfloor/client/`: `GameScreen.tsx`, `Hand.tsx`, `OfferBoard.tsx`, `CardFace.tsx`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `tradingfloor.scss`
- Modify: `src/clientGames.ts`, `shared/svg/gameIcons.ts` (a `tradingfloor` icon with `lineIcon`: two fanned cards with a swap arrow)
- Test: `games/tradingfloor/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PublicGameState`, `COMMODITIES`, `cornerOf`, `offerError` (Tasks 2, 3); `gameService.sendAction`; `RoundSummaryDialog`.
- Produces: `tradingfloorClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `gameLength` (`plural(round, 'round')`), `FinalRound` (the last summary).

Decisions:
- `Hand`: my cards grouped by commodity, each a button with the commodity name and value; tapping selects up to 4 (`aria-pressed`); `offerError` on the selection disables **Offer** and shows why. **Offer N** sends `offer`; my open offer is shown raised with **Withdraw**.
- `OfferBoard`: one bubble per open offer, `Bob: 3!`, with **Accept** enabled only when my open offer has the same count. Bubbles show the count only.
- **Corner!** is always visible, enabled when `cornerOf(hand)` is not null.
- An `Already taken` error shows as one quiet line in the status area for 3 seconds, never a dialog.
- The table shows each seat's name, card count and score, and the target.
- Round end: `RoundSummaryDialog` with the winner, the corner, the revealed hand and penalties; Continue sends `continue`.
- `describeMove`: `Alice and Bob swapped 3 cards`; `Alice cornered Saffron for 100 points`; `Alice cornered Saffron with the Bull for 200 points`.
- Layout: offers above the hand; at phone width the hand wraps into rows and **Offer**, **Withdraw** and **Corner!** stay in one fixed bar.

- [ ] **Step 1: Write the failing test** `describeMove.test.ts` for the three texts exactly.
- [ ] **Step 2: Run** `node --test games/tradingfloor/client/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client and the two one-line registrations.
- [ ] **Step 4: Run** `node --test games/tradingfloor/client/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Trading Floor: screen, history and FAQ`.

### Task 6: Trading Floor README and end-to-end tests

**Files:**
- Create: `games/tradingfloor/README.md`, `e2e/tradingfloor.spec.ts`

README (sections Rules, Controls, Differences from Wikipedia, linking [Wikipedia's Pit (game) article](https://en.wikipedia.org/wiki/Pit_(game))). Differences to list:
- Original commodities and values (Saffron 100 down to Soy 50) instead of the article's grains; the commodities in play are the first ones in that list, one per player.
- Wikipedia gives no target score; here 500, or 250 by house rule.
- No bell: the Corner! button ends the round, and trading starts as soon as anyone makes an offer.
- Wikipedia lets the Bull and Bear be traded alone or with cards of one commodity; here the same (an offer may be only the Bull or Bear), within the four-card limit.
- Wikipedia: the Bear's holder cannot declare a corner; here the same.
- Offers are blind but typed, not shouted: each offer shows its count beside the player's name, and one open offer per player at a time.
- No undo: there are no turns, and taking back a swap would undo every offer made since.
- A player leaving mid-round calls the round off and deals again for those left; below three players the game ends with the scores as they stand.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/tradingfloor.spec.ts`**, three or four pages, hands patched with `table.patch`, one test per rule, control and difference. At least: the offer shows only its count on other pages; Accept is enabled only with a matching offer; a swap moves the cards on both pages; a withdrawn offer disappears; two pages press Accept on the same offer and one sees `Already taken` with its cards and offer kept; Corner! is disabled without a corner and ends the round with a summary; Continue deals the next round; Bull and Bear on: two hands of 10, 8 plus the Bull corners, a Bear holder cannot corner, penalties shown; target 250 ends sooner; History (via `headerButton(page, 'History')`) shows swaps and corners, no offers and no hands; a spectator sees counts but no hand; a player leaving redeals; no Undo control; FAQ opens.
- [ ] **Step 3: Run** `E2E_PORT_BASE=8800 npx playwright test --workers=2 e2e/tradingfloor.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Trading Floor: README and end-to-end tests`.

### Task 7: Steady Hand board, geometry and options

**Files:**
- Create: `games/steadyhand/info.ts`, `games/steadyhand/options.ts`, `games/steadyhand/types.ts`, `games/steadyhand/board.ts`, `games/steadyhand/geometry.ts`
- Test: `games/steadyhand/geometry.test.ts`, `games/steadyhand/options.test.ts`

**Interfaces:**
- Produces (`options.ts`):
  - `BUZZES_RULE: ChoiceRule<0 | 1 | 3 | 5>` = id `buzzes`, label `Buzzes allowed`, standard `3`, choices `0 'Unlimited'`, `1 '1'`, `3 '3'`, `5 '5'`, help `A player who has used all their buzzes is out of turns.`
  - `TOLERANCE_RULE: ChoiceRule<'easy' | 'normal' | 'hard'>` = id `tolerance`, label `Wall tolerance`, standard `'normal'`, choices `Easy`, `Normal`, `Hard`; `TOLERANCE = { easy: 1.3, normal: 1, hard: 0.75 }` (factor on each slot's half-width).
  - `STEADYHAND_RULES = [BUZZES_RULE, TOLERANCE_RULE]`; `SOLO_BONUS = 10` (points per buzz left after clearing the board alone).
- Produces (`info.ts`): `steadyhandInfo: GameInfo` with the Global Constraints values, description `Steer each part out of its twisting slot without touching the walls`, `houseRules: STEADYHAND_RULES`.
- Produces (`types.ts`):
  ```ts
  type Point = [number, number];                                   // board units, viewBox 0 0 1000 640
  type Part = { id: number; name: string; value: number; width: number; path: Point[] }; // path[0] is the rest spot, the last point the exit
  type Live = { seat: Seat; part: number; at: Point };
  type LastMove = { type: 'out'; playerNumber: Seat; part: number; value: number } | { type: 'buzz'; playerNumber: Seat; part: number; at: Point } | null;
  type GameState = BaseGameState & {
    outBy: Partial<Record<number, Seat>>;     // part id to the seat that brought it out
    scores: Partial<Record<Seat, number>>;
    buzzes: Partial<Record<Seat, number>>;    // used
    live: Live | null;
    lastMove: LastMove;
  };
  type PublicGameState = GameState & BasePublicState;
  type Move = { type: 'out'; part: number } | { type: 'buzz'; part: number; at: Point };
  type Action = { type: 'pick'; part: number } | { type: 'drag'; at: Point } | { type: 'drop' };
  ```
- Produces (`board.ts`): `PARTS: Part[]`, 10 parts with original robot-bay names (for example Servo, Gear, Spring, Fuse, Lens, Bolt, Chip, Coil, Valve, Sensor), each slot a polyline of 3 to 9 points inside the viewBox, `width` 34 to 60, values 5 to 40. `PART_RADIUS = 10`, `EXIT_RADIUS = 14`.
- Produces (`geometry.ts`, imported by the client and tests, never needing the server):
  - `clearance(part: Part, factor: number): number` = `part.width / 2 * factor - PART_RADIUS`.
  - `distanceToPath(path: Point[], p: Point): number`.
  - `checkStep(part: Part, from: Point, to: Point, factor: number): 'inside' | 'buzz' | 'out'`: samples the segment from `from` to `to` every 2 units or less; any sample farther than `clearance` from the path is `buzz`; a sample within `EXIT_RADIUS` of the last path point is `out`; else `inside`.
  - `pathLength(path: Point[]): number`.

- [ ] **Step 1: Write the failing tests:**
  - `options.test.ts`: `'Buzzes allowed is 3 alone and Unlimited with two or more'`: `standardOf(BUZZES_RULE, 1) === 3`, `standardOf(BUZZES_RULE, 2) === 0`, `standardOf(BUZZES_RULE, 8) === 0`, labels `Unlimited`, `1`, `3`, `5`. `'every tolerance leaves room to move in every slot'`: `clearance(part, TOLERANCE.hard) >= 4` for every part.
  - `geometry.test.ts`:
    - `'moving along the middle of a slot to its exit is out'` (for every part, stepping through `path` with `checkStep`).
    - `'a step past the wall buzzes'`; `'a jump across a wall between samples buzzes'` (from a point inside one leg to a point inside the next leg of a bend, straight across the corner).
    - `'Easy widens and Hard narrows'`: a point at `clearance(normal) + 2` from the path is inside on Easy and a buzz on Normal.
    - `'slots never come close enough to shortcut'`: for every part, any two non-neighboring path segments are more than `2 * (width / 2 * TOLERANCE.easy)` apart, and no two parts' slots come within that distance of each other.
    - `'harder parts score more'`: sorting parts by `pathLength / width` gives non-decreasing values.
- [ ] **Step 2: Run** `node --test games/steadyhand/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the five files.
- [ ] **Step 4: Run** `node --test games/steadyhand/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Steady Hand: board, slot geometry and house rules`.

### Task 8: Steady Hand rules and live drag

**Files:**
- Create: `games/steadyhand/rules.ts`
- Test: `games/steadyhand/rules.test.ts`

**Interfaces:**
- Consumes: Task 7; `houseRule`, `agreementPending` from `shared/houseRules.ts`; `baseGameState`, `nextActivePlayer` from `shared/seating.ts`; `rankStandings`, `pointsText` from `shared/standings.ts`; `asRecord` from `shared/messages.ts`.
- Produces (`rules.ts`): `createGameState(gameId)`, `resetLobby(state)`, `applyMove(state, seat, move)`, `applyAction(state, seat, action)`, `resumeClock(state)`, `onPlayerDisconnected(state, seat)`, `onPlayerLeft(state, seat)`, `finalStandings(state)`, `toPublicState(state, undoAvailable)`, and `buzzesLeft(state, seat): number | null` (null for Unlimited), `inSlot(state): number[]`.

Decisions:
- `resetLobby`: every part in its slot, scores and buzzes 0, `live: null`.
- Actions (no `recordsAction`, so never recorded); each refused when over (`The game is over`) or not `currentPlayer` (`Not your turn`):
  - `pick`: the part must be in a slot (`That part is already out`); refused before the start while `agreementPending` (`Everyone must agree to the house rules first`) and during an undo or dismiss vote; sets `live = { seat, part, at: path[0] }`.
  - `drag`: refused unless `live?.seat === seat` (`You are not holding a part`) and `at` is two finite numbers inside the viewBox; sets `live.at`. Refused during an undo or dismiss vote.
  - `drop`: clears `live` (the part goes back, no buzz, still your turn); allowed during votes, as Jenga's release is.
- Moves (recorded, undoable by vote): `out` (the part must be in a slot) adds its value to the seat's score and marks it out; `buzz` adds one used buzz. Both clear `live`, set `lastMove` and status (`Alice brought out the Gear for 15 points`, `Alice buzzed on the Coil`), then pass the turn to the next seat in order with buzzes left (`buzzesLeft` null or above 0).
- The game ends when no part is in a slot or no seat has buzzes left. Alone (one seat) and the board cleared with a limited Buzzes rule: score plus `SOLO_BONUS` per buzz left. `winners` are the top scores (ties share); status `Alice wins with 60 points`.
- `resumeClock` and `onPlayerDisconnected` (for the dragging seat) clear `live`.
- `onPlayerLeft`: clears the leaver's `live`; if `currentPlayer` (already moved on by the platform) has no buzzes left, move on again; then the end check.
- `toPublicState`: nothing hidden.
- `finalStandings`: `rankStandings` by score descending, score text `pointsText`.

- [ ] **Step 1: Write the failing tests** in `rules.test.ts`:
  - `'pick, drag and drop move only the live part and change no score'`.
  - `'drag from anyone but the dragger is refused'`: seat 2's drag while seat 1 holds; seat 1's drag after its `buzz` move; a drag with `NaN` or outside the viewBox.
  - `'bringing a part out scores its value and passes the turn'`; `'a buzz uses one buzz, returns the part and passes the turn'`.
  - `'a buzzed part stays for anyone to try'`.
  - `'a player out of buzzes is skipped; nobody left with buzzes ends the game'` (Buzzes 1, two seats).
  - `'Unlimited never runs out'`.
  - `'the game ends when every part is out, highest score wins, ties share'`.
  - `'solo: the bonus counts each buzz left after clearing the board'`: Buzzes 3, one buzz used, board cleared: score is part values plus 20.
  - `'resumeClock lets go of the part'`; `'a disconnect of the dragger lets go'`.
  - `'a player leaving mid-drag lets go and the turn moves to someone with buzzes'`.
  - `'pick before everyone agreed is refused'`.
- [ ] **Step 2: Run** `node --test games/steadyhand/rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts`.
- [ ] **Step 4: Run** `node --test games/steadyhand/*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Steady Hand: turns, buzzes, scoring and live drag`.

### Task 9: Steady Hand registration and manager test

**Files:**
- Create: `games/steadyhand/index.ts`, `games/steadyhand/manager.test.ts`
- Modify: `games/registry.ts`, `games/infos.ts` (after `splendor`, before `sudoku`), `shared/categories.test.ts` (`party` list)

**Interfaces:**
- Produces: `steadyhand: GameDefinition<GameState, PublicGameState>` with `info`, `continuesAlone: true`, `createGameState`, `resetLobby`, `applyMove`, `applyAction`, `resumeClock`, `onPlayerDisconnected`, `onPlayerLeft`, `finalStandings`, `toPublicState`. No `recordsAction`, no `simulating`.

- [ ] **Step 1: Write the failing test** `manager.test.ts` through `createGameManager([steadyhand], seeded(42))`:
  - `'drags are never History steps; out and buzz are'`: pick, 30 drags, `out`: `stepsOf` grew by exactly one and no step has a non-null `live`.
  - `'an approved undo after a buzz leaves no part held'`: pick, drag, `buzz`, undo vote approved: `live === null`, the buzz count restored.
  - `'one player plays solo and the game ends with the bonus'`.
- [ ] **Step 2: Run** `node --test games/steadyhand/*.test.ts games/*.test.ts shared/categories.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `index.ts` and the registration lines.
- [ ] **Step 4: Run** the same plus `npm run typecheck`. Expected: PASS except `src/games/loadClientGame.test.ts` (client in Task 10).
- [ ] **Step 5: Commit** `Steady Hand: registration and manager test`.

### Task 10: Steady Hand client

**Files:**
- Create in `games/steadyhand/client/`: `GameScreen.tsx`, `Bay.tsx`, `PartArt.tsx`, `liveDrag.ts`, `HistoryBoard.tsx`, `describeMove.ts`, `faq.ts`, `index.ts`, `steadyhand.scss`
- Modify: `src/clientGames.ts`, `shared/svg/gameIcons.ts` (a `steadyhand` icon with `lineIcon`: a zigzag slot with a small round part)
- Test: `games/steadyhand/client/liveDrag.test.ts`, `games/steadyhand/client/describeMove.test.ts`

**Interfaces:**
- Consumes: `PARTS`, `checkStep`, `TOLERANCE` (Task 7); `PublicGameState`; `SIMULATION_TICK_MS` from `shared/gameDefinition.ts`; `gameService.sendAction`, `makeMove`, `requestUndo`.
- Produces: `steadyhandClient: ClientGame` with `Screen`, `HistoryBoard`, `describeMove`, `faq`, `gameLength` (`plural(parts out, 'part')`).
- Produces (`liveDrag.ts`, pure):
  - `shouldSend(lastSentMs: number, nowMs: number): boolean` = `nowMs - lastSentMs >= SIMULATION_TICK_MS` (at most 20 a second).
  - `stepDrag(part, from: Point, to: Point, factor): { at: Point; result: 'inside' | 'buzz' | 'out' }` (wraps `checkStep`).
  - `drawnPosition(live: Live | null, me: Seat, local: Point | null): Point | null`: the dragger draws `local`; everyone else draws `live.at`.

Decisions:
- `Bay`: an SVG of the repair bay, viewBox `0 0 1000 640`, slots drawn at their `width` times the tolerance factor, each part drawn by `PartArt` at its rest spot or its drawn position; parts already out sit in a tray beside the bay with their bringer's name.
- On your turn a pointer down on a part in a slot sends `pick` and captures the pointer. Every pointer move runs `stepDrag` from the last checked point; `buzz` sends `makeMove({ type: 'buzz', part, at })` with a buzz sound and a short shake; `out` sends `makeMove({ type: 'out', part })`; otherwise a `drag` action when `shouldSend`, and the last skipped position is sent when the 50 ms window ends. Pointer up before the exit sends `drop`. Unmounting mid-drag sends `drop`.
- Watchers draw `live.at` with a 50 ms linear transition, so the part glides between updates.
- Above the bay: whose turn it is, each seat's score and buzzes left (`∞` for Unlimited).
- Touch: `touch-action: none` on the bay; the part's hit area is at least 44 px on a phone.
- `describeMove`: `Alice brought out the Gear for 15 points`, `Alice buzzed on the Coil`.

- [ ] **Step 1: Write the failing tests:** `liveDrag.test.ts`: `'sends at most one drag per 50 ms'` (`shouldSend(1000, 1049)` false, `shouldSend(1000, 1050)` true); `'the dragger draws the local position'` (`drawnPosition(live of seat 1 at A, 1, B)` is B; for seat 2 it is A; null `live` is null); `'a step through the wall buzzes'`. `describeMove.test.ts`: the two texts exactly.
- [ ] **Step 2: Run** `node --test games/steadyhand/client/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the client and the two one-line registrations.
- [ ] **Step 4: Run** `node --test games/steadyhand/client/*.test.ts src/games/loadClientGame.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `Steady Hand: repair bay, live drag, history and FAQ`.

### Task 11: Steady Hand README and end-to-end tests

**Files:**
- Create: `games/steadyhand/README.md`, `e2e/steadyhand.spec.ts`

README (sections Rules, Controls, Differences from Wikipedia, linking [Wikipedia's Operation (game) article](https://en.wikipedia.org/wiki/Operation_(game))). Differences to list:
- An on-screen repair bay with original parts and slots instead of a patient and tweezers; the pointer or a finger is the tool.
- Wikipedia's game deals cards that name which piece a player must remove and pays money; here you pick any part still in a slot and it scores its points.
- A buzz ends your turn and the part stays for anyone; the Buzzes allowed house rule can put players out of turns.
- Solo score attack with a bonus for unused buzzes, and the Wall tolerance house rule, are not in Wikipedia.
- The game trusts each player's browser to report touching the wall.

- [ ] **Step 1: Write the README.**
- [ ] **Step 2: Write `e2e/steadyhand.spec.ts`**, moving `page.mouse` through a part's `path` mapped from the viewBox to the bay's on-screen box (a helper in the spec). At least: Buzzes allowed defaults to 3 with one player and with two; dragging along the path brings a part out and scores it; leaving the path buzzes, returns the part and passes the turn; letting go mid-slot returns the part with no buzz; a second page sees the part move while the first drags (its position changes between two reads) and the History dialog (via `headerButton(page, 'History')`) has no drag steps; Buzzes 1 with two players: a player out of buzzes is skipped and the game ends when nobody has buzzes; solo clear shows the bonus; Hard tolerance buzzes where Easy does not; Undo by vote after a buzz restores it; with `touch: true` a finger drag works; FAQ opens.
- [ ] **Step 3: Run** `E2E_PORT_BASE=8800 npx playwright test --workers=2 e2e/steadyhand.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Steady Hand: README and end-to-end tests`.

### Task 12: Browser check

**Files:** none new (fix what the check finds, with a test for each fix, in the task that owns the code).

- [ ] **Step 1:** In the worktree: `npx vite build`, then `PORT=3808 node server/server.ts` (in the background).
- [ ] **Step 2: Trading Floor in Chrome** at `http://localhost:3808`, one tab per player (three, then four with Bull and Bear): trade to a corner, Continue, and play to the target (patching scores near the target is fine); try a double accept from two tabs. Open History mid-round and check no hand shows; after game over download the game file, open it and use View as each seat.
- [ ] **Step 3: Steady Hand in Chrome**: solo to a cleared board, and two tabs to a forced end; watch the second tab follow a drag smoothly; check History has only out and buzz steps; download and open the game file.
- [ ] **Step 4: Check layout** of both games at laptop size and at phone width (390 px and 320 px same-origin iframes, per the memory note; `data-theme="dark"` on an iframe's root for dark mode), light and dark: no overlap, no blank rows, Offer, Withdraw, Corner! and the bay's parts reachable, a finger drag works in the phone iframe.
- [ ] **Step 5:** Stop the server. Commit any fixes with their tests.

### Task 13: Full test run

**Files:** none.

- [ ] **Step 1: Run** `npm test`. Expected: PASS.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: PASS.
- [ ] **Step 3: Run** `npm run lint`. Expected: PASS with 0 warnings.
- [ ] **Step 4: Run** `E2E_PORT_BASE=8800 npx playwright test --workers=2 e2e/tradingfloor.spec.ts e2e/steadyhand.spec.ts e2e/history.spec.ts e2e/rules.spec.ts e2e/lazyLoading.spec.ts`. Expected: PASS. Do not run or fix `e2e/landing.spec.ts` counts; the coordinator updates them after the merge.

### Task 14: Push and pull request

**Files:** none.

- [ ] **Step 1:** `git push -u origin game-tradingfloor-steadyhand`.
- [ ] **Step 2:** `gh pr create --base party-games-and-polish --head game-tradingfloor-steadyhand --title "Trading Floor and Steady Hand"` with a body that lists: each game's rules and house rules, both Differences from Wikipedia lists, how the live drag uses unrecorded actions (and the store upsert per drag), the coordinator's Buzzes allowed decision, every line changed outside the two game folders, and the lines left to the coordinator (root README game list and count, `e2e/landing.spec.ts` counts, `docs/architecture.md`). The body ends with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ME2Akh28qEm7tjyCAWrpJa
  ```
- [ ] **Step 3:** Report the PR URL.

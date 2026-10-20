# Ten New Games: Design

Date: 2026-10-19
Repo: `Nate314/multiplayer-tabletop-games`
Builds on: the platform as of `962eec1` (end-to-end tests for every game rule)

## Intent

Add ten games to the site: Connect Four, Dominoes, Euchre, Farkle, Hearts, Rack-O, Spades, Texas Hold'em, The Crew and Yahtzee. They are built in parallel, one implementation agent per game, the same way as the last batch (see `2026-10-18-seven-new-games-design.md`), so this document says what each game is and what the shared ground is, so ten builders working at once produce ten games that look and behave like the twenty-one already on the site.

## Goals

- Each game is complete and playable, built the same way as the existing games: a `games/<id>/` folder with `types.ts`, `index.ts`, `rules.ts`, rules tests, a manager test, `README.md` and a `client/` folder (`GameScreen`, `HistoryBoard`, `describeMove`, `faq`, `index.ts`, scoped CSS, `animateMove` where it fits).
- Each game works with everything the platform gives a game: seating, rejoin, held seats, dismiss votes, undo votes, the History dialog, game files with "View as", Play and Animations.
- **Rules audited against Wikipedia** (owner's decision), as was done for every existing game. The builder reads the game's Wikipedia article itself before writing rules code. Where Wikipedia is silent or vague, it follows the publisher's official rules. Every difference is listed in the README under "Differences from Wikipedia", in the format of `games/rook/README.md`. Where this document says something that disagrees with Wikipedia, this document wins and the README lists it as a difference.
- **End-to-end tests** in `e2e/<id>.spec.ts`: one test per rule, control and difference in the game's README, as `e2e/war.spec.ts` and the rest do since #18.
- Hidden information stays hidden: hands, decks, the boneyard and face-down cards go through `toPublicState`, and `viewer: null` sees none of them.
- No new npm dependency.

## Non-goals

- Go, Pit and Poetry for Neanderthals (held for later, owner's decision).
- House rules and variant pickers, except where this document names one.
- Computer players, chat, turn timers.
- Refactoring existing games, including moving Rook or the three existing `Dice.tsx` copies onto the new shared pieces (my call; same rule as the last batch).
- Remembering progress across games (owner's decision for The Crew).

## Anti-goals

- A game that looks finished but has a rule wrong in a way a regular player would notice.
- A hidden card or tile reaching a browser that should not see it, including through History or a game file's table view.
- Four trick-taking games each with their own copy of follow-suit and trick-winner code, or two dice games each with their own dice component.
- A screen that is unusable on a laptop window or overlaps itself at a narrow width.

## Shared ground (built first by the coordinator, before the game agents start)

On the `ten-new-games` branch (my call on placement):

1. **`shared/tricks.ts`** for Hearts, Spades, Euchre and The Crew. Generic over the card type, given a `suitOf(card)` function (so Euchre can make the left bower a trump) and a `beats(a, b, ledSuit)` or rank function supplied by the game:
   - `legalPlays(hand, trick, suitOf)`: must follow the led suit if able.
   - `trickWinner(trick, suitOf, rank, trump)`: the seat that won the trick.
   Game-specific restrictions (Hearts' no hearts led until broken, no points on the first trick) stay in the game. Unit tests included.
2. **`src/components/Dice.tsx`** (CSS under `:where()` like `PlayingCard`) for Yahtzee and Farkle: draws a row of dice by face value, each optionally selectable (held or set aside), with an `aria-label` per die and `data-anim-key` passthrough for a roll animation.
3. The existing `shared/playingCards.ts`, `shared/shuffle.ts` and `src/components/PlayingCard.tsx` are reused as they are. Euchre's 24-card deck is a filter of `standardDeck()`.

The Crew's deck, Dominoes tiles and Rack-O cards belong to their games alone.

**Setup choices** (Dominoes' set, The Crew's starting mission): no platform mechanism exists. Each game handles it itself (my call): a game action any seated player may send before the first move, stored in state, kept by `resetLobby`, and shown to everyone in the lobby. The first move locks it.

## Rules for every game agent

- **Worktree and branch.** Each agent works in its own git worktree on `game-<id>`, started from `ten-new-games`. Agents do **not** open PRs (owner's decision). When all ten are done, the coordinator merges every branch into `ten-new-games` and opens **one PR** for the batch against `master`.
- **Files outside its folder:** `games/registry.ts` and `src/clientGames.ts` (one line each), the README's game list and the count in its first sentence, `docs/architecture.md` only where it lists games by name, and its own `e2e/<id>.spec.ts`. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts`. If a game needs a platform or fixture change, the agent stops and reports it. The coordinator resolves the merge conflicts these shared lines cause.
- **Players leaving.** Handled the way the nearest existing game does it: Rook for partnership games (the partnership breaks, the other team wins), Uno and Phase 10 for others. The README says what happens.
- **Undo.** Every move undoable by vote. Things not bound to the turn (Continue after a round, votes to end, setup choices) are game actions. `onUndo` reshuffles face-down piles, as existing card games do, so an undo cannot reveal the next card or roll.
- **Multi-round games** show a scoring screen after each round and wait for every connected player to press Continue, as Uno and Phase 10 do.
- **Tests.** Rules tests cover setup, every move type, scoring, game end and the hidden-information views. A manager test plays a short game through `createGameManager` with a seeded random. `npm test`, `npm run typecheck`, `npm run lint` and the game's e2e spec all pass.
- **Browser check.** The agent runs the site on its own port and plays the game in Chrome, one tab per player, through at least one full round or a forced game end, checks History and a downloaded game file, and checks the screen at a laptop size and a narrow size for overlap.
- **Writing.** No em-dashes in READMEs, FAQs, comments or commit messages.

## The games

"My call" marks a choice the owner has not made; the owner can overrule any. Everything not named here follows Wikipedia.

### Connect Four (`connectfour`)

- 2 players, 7 columns by 6 rows. Seat 1 plays first.
- A move drops a disc into a column that is not full; it falls to the lowest empty cell.
- Four in a row horizontally, vertically or diagonally wins. A full board with no line is a draw.
- Single game. Resign and draw offers through `shared/drawOffer.ts`, like Chess and Checkers (my call).
- Screen: the grid with a drop button or click target above each column, the winning four highlighted, a drop animation.

### Dominoes (`dominoes`)

- The Draw game, the block game where you draw from the boneyard when you cannot play (owner's decision). 2 to 4 players (my call).
- **Set:** double-six or double-nine, chosen in the lobby (owner's decision). Hand sizes and who leads follow Wikipedia for each set and player count.
- Tiles are played in a single line, matching the open end (no spinner, my call; "build a line").
- A player who cannot play draws from the boneyard until they can play or it is empty, then passes.
- A round ends when a player plays out their hand, or when nobody can play (blocked; lowest pip total wins the round). Scoring and the target score follow Wikipedia's Draw game section.
- Hidden: hands and the boneyard (counts shown).
- Screen: the line of tiles (wrapping or snaking to fit), your hand with playable tiles marked, a choice of end when a tile fits both, other players' tile counts, the boneyard count.

### Euchre (`euchre`)

- Exactly 4 players, partnerships seats 1 and 3 against 2 and 4. 24-card deck, 9 to ace.
- Right bower (jack of trump) and left bower (jack of the same color) are the top trumps, and the left bower counts as a trump, not its printed suit.
- Dealing, turning up the top card of the kitty, the two rounds of making trump (order up, then name a different suit), the dealer picking up and discarding, going alone, and scoring (1, 2, or 4 for a lone march, 2 for a euchre) follow Wikipedia. If all four pass twice, the deal passes and the cards are redealt (no "stick the dealer", my call unless Wikipedia names another default).
- Game to 10 points.
- Hidden: hands, the kitty except the turned-up card, the dealer's discard.
- Screen: the table with four seats and the trick, the turned-up card, the making-trump panel, trump and the makers shown, team scores and tricks this hand.

### Farkle (`farkle`)

- 2 to 8 players (my call). Six dice.
- On a turn you roll, set aside at least one scoring die or combination, then roll the rest or bank. A roll with nothing scoring is a farkle and loses the turn's points. Setting aside all six ("hot dice") lets you roll all six again.
- Scoring table follows Wikipedia's standard scoring (single 1s and 5s, three of a kind and the larger combinations it lists). No minimum score to get on the board (my call unless Wikipedia's main rules have one).
- First to 10,000 triggers a final turn for everyone else; the highest total wins.
- Nothing hidden. The roll uses the platform's `random`.
- Screen: the dice (shared `Dice`), selectable for setting aside with the score of the selection shown, Roll and Bank buttons, the turn total, and a score list.

### Hearts (`hearts`)

- Exactly 4 players, no partnerships (my call; Wikipedia's standard game).
- Passing three cards: left, right, across, then no pass, repeating. The pass is a game action everyone does at once; the round starts when all four have passed.
- The 2 of clubs leads the first trick. No hearts or queen of spades on the first trick unless a player has nothing else. Hearts cannot be led until broken.
- Each heart is 1 point and the queen of spades 13. Taking all 26 (shooting the moon) gives the other three 26 each.
- Game ends when someone reaches 100; lowest score wins, ties share.
- **Leaving** (my call): the game needs four, so a player leaving ends it, and the lowest score so far wins (the hand in progress is not scored).
- The first pass happens before any move, so the game sets `started` itself when the pass completes, so nobody can join mid-pass.
- Hidden: hands and the cards passed to you until the pass completes.
- Screen: the table and trick, your hand with legal cards marked, the pass panel, points taken this hand, scores.

### Rack-O (`racko`)

- 2 to 4 players. The deck size by player count, the 10-slot rack dealt in slot order without rearranging, and scoring follow Wikipedia (and the official rules where it is vague).
- A turn: take the top of the discard pile or the draw pile, then either put it in a rack slot (discarding the card it replaces) or discard it (only a card from the draw pile may be discarded straight away).
- A player whose rack is in ascending order calls Rack-O and ends the round. Scoring per round and the target score (500 in the official rules) follow Wikipedia.
- Hidden: other players' racks (their backs are shown), the draw pile.
- Screen: your rack as 10 slots, low to high, the draw and discard piles, other players' racks face down, round scores.

### Spades (`spades`)

- Exactly 4 players, partnerships seats 1 and 3 against 2 and 4.
- Each player bids a number of tricks, 0 (nil) to 13; the team's contract is the sum of the non-nil bids. Bidding in turn order from the dealer's left.
- Spades are always trump and cannot be led until broken (unless a player has only spades).
- Scoring follows Wikipedia: 10 per trick bid when made, minus 10 per trick bid when set, 1 per overtrick (bag), 10 bags cost 100, nil worth 100 made or lost. Blind nil not offered (my call).
- Game to 500, or a team falls to minus 200 and loses (Wikipedia's usual targets).
- Hidden: hands.
- Screen: the table and trick, the bidding panel, each player's bid and tricks taken, team scores and bags.

### Texas Hold'em (`holdem`)

- 2 to 8 players (my call). Each starts with 1,000 play chips. Blinds 10 and 20, fixed (my call).
- Standard no-limit Hold'em: the button moves each hand, blinds, two private cards, betting before the flop, then flop, turn and river with a betting round each, then showdown. Minimum raise rules, side pots for all-in players, and heads-up blinds (the button posts the small blind) follow Wikipedia.
- **Busting** (owner's decision): a player with no chips is out for the night and watches the rest.
- **Ending** (owner's decision): between hands, any player may call a vote to end. The game ends when every player still holding chips votes yes. The final screen ranks players by chips. The game also ends when one player has every chip. The vote is a game action.
- No timer.
- Hidden: hole cards and the deck. At showdown the players still in show their hands. A player who folds, or wins because everyone folded, keeps their cards hidden; no "show anyway" button (my call).
- Screen: the table with each seat's chips, bet and cards, the board, the pot (and side pots), your hole cards, Fold, Check or Call, and Bet or Raise with an amount, and the best hand named at showdown.

### The Crew (`thecrew`)

- The original game, The Crew: The Quest for Planet Nine, and its 50-mission space campaign (owner's decision). 3 to 5 players (my call; the 2-player variant is left out).
- **Starting mission:** chosen in the lobby, 1 to 50, default 1 (owner's decision).
- **Within one game:** after a mission succeeds, the next mission deals automatically; after a failure, the crew retries the same one. The screen shows the mission number and the attempt count. Nothing carries over to a new game (owner's decision).
- Cards, the commander (holder of the 4 rocket), dealing, task cards and task tokens, and tricks with rockets as trump follow the official rules.
- **Communication:** the official rule, enforced by the site. Once per mission, between tricks (while no card of the current trick has been played, before the first trick included), a player may reveal one card face up with a token saying it is their highest, lowest or only card of that suit; the site only allows a reveal that is true. It is a game action, since any player may do it while the leader waits; it is not undoable, as information once shown cannot be taken back (my call). No chat (my call; talking at the table is up to the group).
- **Missions:** all 50 entered as data in the game folder from the published logbook, sourced from the web (owner's decision: BoardGameGeek, published rule summaries and the like, cross-checked between at least two sources where they disagree, with the sources cited in the README): the number of tasks, task order tokens, and each mission's special rule (the commander's decision, dead spots, a disrupted communication, the distress signal and so on). The builder records the mechanics only, not the logbook's story text. This is the largest data entry in the batch and the builder checks each mission against the official rules.
- **Ending** (my call): completing mission 50 ends the game with the whole crew as winners. Otherwise, between missions, any player may call a vote to end, as in Texas Hold'em; when everyone connected votes yes the game ends, all players are listed as winners and the status names the last mission completed.
- **Leaving** (my call): the mission's deal depends on the crew size, so a player leaving ends the game the same way as an end vote.
- Hidden: hands. Tasks and revealed cards are public.
- Screen: the table and trick, your hand, the tasks with who holds each, the communication panel, the mission number, attempt count and the mission's special rule.

### Yahtzee (`yahtzee`)

- 2 to 8 players (my call; the platform needs two to start). Five dice.
- A turn is up to three rolls, holding any dice between rolls, then scoring one empty category. 13 rounds.
- Upper section with the 35-point bonus at 63, lower section with three and four of a kind, full house (25), small straight (30), large straight (40), Yahtzee (50) and chance. Yahtzee bonuses (100 each) and the Joker rule follow Wikipedia.
- Highest total wins, ties share.
- Nothing hidden.
- Screen: the dice (shared `Dice`) with hold toggles, Roll with rolls left, everyone's score sheet with the possible scores for the current roll shown in your empty boxes.

## Order of work

1. Coordinator: this document, approval, the plan, the shared ground on `ten-new-games`, pushed.
2. Ten agents in parallel, each in its own worktree on `game-<id>`, each on its own port, each ending with a pushed branch and a short report (no PR).
3. Coordinator: review each branch, merge them all into `ten-new-games`, resolve the conflicts on the registry, client registry, README and architecture lines, run `npm test`, `npm run typecheck`, `npm run lint` and the full `npm run test:e2e`, then open one PR against `master`.

## Left to the builders

- Each game's state shape, move and action types, and component breakdown.
- Exact screen layout and styling, within scoped CSS and the light and dark themes.
- Which moves animate, and how.
- FAQ wording.

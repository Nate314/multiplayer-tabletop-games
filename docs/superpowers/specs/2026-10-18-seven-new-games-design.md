# Seven New Games: Design

Date: 2026-10-18
Repo: `Nate314/multiplayer-tabletop-games`
Builds on: the platform as of `51bb120` (history start step, saved games in SQLite, game files)

## Intent

Add seven games to the site: Go Fish, Monopoly, Rook, Rummikub, Skip-Bo, Splendor and War. The owner's group plays both quick card games while people arrive and long evening games, so the list covers both. Catan, Ticket to Ride, Carcassonne and Risk come later and are out of scope here.

The owner asked for the games to be built in parallel, one implementation agent per game. So this document has two jobs: say what each game is, and say enough about the shared ground that seven builders working at once produce seven games that look and behave like the ten already on the site.

## Goals

- Each game is a complete, playable game on the site, built the same way as the existing ten: a `games/<id>/` folder with `types.ts`, `index.ts`, `rules.ts`, rules tests, manager tests, `README.md` and a `client/` folder (`GameScreen`, `HistoryBoard`, `describeMove`, `faq`, `index.ts`, scoped CSS, `animateMove` where it fits).
- Each game works with everything the platform already gives a game: seating, rejoin after a refresh, held seats for disconnected players, dismiss votes, undo votes, the History dialog, game files with "View as" (each player's own hand), Play and Animations.
- The rules follow the game's Wikipedia article, like every existing game. Where Wikipedia is silent or vague, the builder follows the publisher's official rules. Every difference from Wikipedia is listed in the game's README under "Differences from Wikipedia", as the existing READMEs do.
- Hidden information stays hidden: hands, decks, face-down cards and tiles go through `toPublicState`, and `viewer: null` (the History dialog and the table view) sees none of them.
- No new npm dependency.

## Non-goals

- Catan, Ticket to Ride, Carcassonne and Risk (later).
- House rules and variant pickers, except where this document names one.
- Computer players.
- Refactoring the existing ten games (for example to use the new shared `shuffle`).

## Anti-goals

- A game that looks finished but has a rule wrong in a way a regular player would notice at the table.
- A hidden card or tile reaching a browser that should not see it, including through the History dialog or a game file's table view.
- Two games each inventing their own copy of the same card code.
- A game whose screen is unusable on a laptop window or overlaps itself when the window is narrower.

## Shared ground (built first, before the game agents start)

Built by the coordinator on the `seven-new-games` branch, merged into each agent's starting point (my call on placement):

1. **`shared/shuffle.ts`**: `shuffle<T>(items, random): T[]`, the Fisher-Yates shuffle the existing games each have privately. New games import it.
2. **`shared/playingCards.ts`**: the standard 52-card deck for War and Go Fish: `Suit`, `Rank` (`'A' | '2' ... '10' | 'J' | 'Q' | 'K'`), `PlayingCard`, `standardDeck()`, and rank order helpers.
3. **`src/components/PlayingCard.tsx`** (plus its CSS under `:where()` like the other platform pieces): draws a face-up standard card or a card back, in a few sizes, with `data-anim-key` passthrough so games can animate it.

The other games have their own pieces (the Rook deck, Skip-Bo's 1 to 12 deck, Rummikub tiles, Splendor cards and gems, the Monopoly board), each owned by that game alone.

## Rules for every game agent

- **Branch and PR.** Each agent works in its own git worktree on a branch named `game-<id>` started from `seven-new-games`, and opens its own PR with `gh pr create`. The PR base is `seven-new-games` until that branch is merged, then `master`.
- **Files it may touch outside its folder:** `games/registry.ts` and `src/clientGames.ts` (one line each), the README's game list and the count in its first sentence, and `docs/architecture.md` only where it lists games by name (for example the games with hands). Nothing else in `src/`, `server/` or `shared/`. If a game truly needs a platform change, the agent stops and reports it instead of making it.
- **Rules source.** The agent reads the game's Wikipedia article (and the official rules where needed) itself before writing rules code, and its README cites the article.
- **Players leaving.** A dismissed player is handled the way the nearest existing game does it (Uno and Phase 10 for card games), and the README says what happens.
- **Undo.** Every move is undoable by vote, as everywhere else. Things that are not turn-bound (answering a trade, bidding in an auction, Continue after a round) are game actions, as Uno and Azul do it.
- **Multi-round games** show a scoring screen after each round and wait for every connected player to press Continue, as Uno and Phase 10 do.
- **Tests.** Rules tests cover setup, every move type, scoring, game end and the hidden-information views. A manager test plays a short game through `createGameManager` with a seeded random, as `games/uno/manager.test.ts` does. `npm test`, `npm run typecheck` and `npm run lint` all pass.
- **Browser check.** The agent runs the site on its own port (assigned when it starts) and plays the game in Chrome in one tab per player, through at least one full round or a forced game end, and checks the History dialog and a downloaded game file. It checks the screen at a laptop size and a narrow size for overlap.
- **Writing.** No em-dashes in the README, FAQ, comments or commit messages.

## The games

Player counts, rules choices and screens per game. "My call" marks a choice the owner has not made; the owner can overrule any of them.

### War (`war`)

- 2 players (my call; Wikipedia's game). The standard deck is dealt out evenly, face down.
- Each battle, both players turn up their top card; the higher rank takes both (aces high). On a tie, each player puts one card face down and one face up, and the higher face-up card takes everything; repeat on another tie. A player who runs out of cards during a war uses their last card as the face-up card; a player with no cards left loses.
- Won cards go to the bottom of the winner's pile in random order (my call). Wikipedia notes the return order is not fixed by the rules, and a fixed order can loop forever.
- **How a battle is played online** (owner's decision): each player turns up their own card. Flip is a move: the player whose turn it is flips, the turn passes to the other player, and the battle (and any war) settles when the second card is turned up. The player who flipped second starts the next battle (my call), so both flips stay moves the History dialog can show.
- **Auto-flip** (my call): each player has an Auto-flip checkbox that flips their own card one second after their turn comes up, so a long game can play itself. It runs in that player's browser and sends ordinary Flip moves; it needs no server timer. It is off by default and not remembered across page loads.
- Screen: each player's pile with its card count, the cards in the current battle laid out (war cards face down then face up), and who won it.

### Go Fish (`gofish`)

- 2 to 6 players (my call). 7 cards each for 2 or 3 players, 5 for 4 or more, the rest is the stock (Wikipedia).
- On your turn, ask one player for a rank you hold. If they have any, they give you all of them and you go again. If not, "Go fish": you draw one card, and if it is the rank you asked for, you show it and go again; otherwise the turn passes.
- Four of a rank make a book, laid down at once. A player whose hand empties draws a card if the stock has any, otherwise they are out of the round. The game ends when all 13 books are down; most books wins, ties share the win.
- Every ask and its answer is public (a short log on the table), since everyone at a real table hears it.
- Screen: your hand grouped by rank, the other players with card counts and books, a rank picker and a player picker for the ask.

### Skip-Bo (`skipbo`)

- 2 to 6 players, no partnerships (my call). 162 cards: twelve each of 1 to 12 and 18 Skip-Bo wilds.
- Stock pile of 30 cards each with 2 to 4 players, 20 with 5 or 6; its top card is face up. Hands of 5, refilled to 5 at the start of each turn, and again if a player empties their hand during a turn.
- Up to four shared building piles start with a 1 (or a Skip-Bo) and go up to 12; a full pile is shuffled into the draw pile. Each player has four discard piles; you may play the top of your stock, your hand or the top of your discard piles onto building piles, and end your turn by discarding one hand card onto one of your discard piles.
- The first player to empty their stock pile wins. Single game, no points (my call; the box also has a play-to-500 scoring option).
- Hidden: hands, the draw pile and all but the top of each stock pile (count shown).
- Screen: four building piles in the middle, your stock, hand and four discard piles, and each other player's stock top, stock count and discard piles.

### Rook (`rook`)

- Exactly 4 players in two partnerships, seats 1 and 3 against 2 and 4 (my call; the standard game).
- Variant: Kentucky Discard (owner's decision), the version Wikipedia describes as the most common, with the deck, card ranks, point values, nest size, bidding range and the last-trick bonus as that article gives them.
- Bidding goes around the table in steps of 5; a player who passes is out of the bidding. The winner takes the nest, discards the same number of cards, and names trump. Then tricks, following suit when you can.
- The bidding team scores what it took if it made its bid and loses the bid if not; the other team scores what it took. Hands repeat until a team reaches 500 (my call, the common target), with the scoring screen and Continue between hands.
- A player leaving breaks the partnership, so the game ends and the other team wins (my call).
- Hidden: hands and the nest (the bidder sees the nest after winning the bid; discards stay hidden from the others).
- Screen: the table with four seats and the trick in the middle, the bidding panel, the nest and discard step for the bidder, trump and the bid shown, team scores.

### Rummikub (`rummikub`)

- 2 to 4 players. 106 tiles: 1 to 13 in four colors, twice each, and 2 jokers. 14 tiles each; the rest is the pool.
- Groups on the table are sets (3 or 4 of one number in different colors) or runs (3 or more in a row of one color). A player's first meld must total at least 30 points from their own tiles, without using tiles already on the table.
- After that a turn may rearrange the table in any way, as long as every group is valid at the end of the turn and the player added at least one tile from their rack. A player who does not play draws one tile from the pool.
- Jokers follow the official rules: a joker on the table can be taken by replacing it with the tile it stands for, and must be played again that turn.
- A round ends when a player empties their rack. Single round with scores shown (my call): the others lose the total of their tiles (joker 30) and the winner gains that total. If the pool runs out and nobody can play, the lowest rack total wins.
- No turn timer (my call; the official rules have a one-minute timer).
- A move is the whole table and rack at the end of the turn, checked by the server. While a player is rearranging, the others see the table as it was (my call); a Reset button puts the table back.
- Screen: the table as rows of groups with drag and drop (or click to pick up, click to place) between the rack, groups and a new-group area, your rack with sort by color and by number, other players' tile counts.

### Splendor (`splendor`)

- 2 to 4 players. Gem tokens: 7 of each of the five colors for 4 players, 5 for 3, 4 for 2, and 5 gold. 90 development cards in three levels, four face up per level. Nobles: one more than the number of players.
- The card and noble lists are the published ones, entered as data in the game folder; the builder finds and checks the exact list.
- A turn is one of: take 3 gems of different colors; take 2 of one color if 4 or more of it are left; reserve a face-up card or the top card of a level's deck and take a gold (up to 3 reserved); buy a face-up or reserved card. Card bonuses discount later purchases. A player over 10 tokens returns tokens down to 10.
- A noble visits at the end of your turn when your bonuses meet its cost (one per turn; you choose if several qualify).
- When a player reaches 15 prestige, the round finishes so everyone has had the same number of turns. Most prestige wins; on a tie, fewest development cards wins.
- Hidden: the deck order, and a card reserved from the top of a deck (others see only its level). Your own reserved cards are visible to you.
- Screen: nobles, the three card rows with their decks, the gem supply, and each player's tokens, bonuses, prestige and reserved cards.

### Monopoly (`monopoly`)

- 2 to 8 players. The standard US board, cards, prices and rents, as Wikipedia and the current official rules give them.
- Included: buying, and the auction among all players when the lander does not buy; rent, monopolies doubling unimproved rent; houses and hotels with even building and the 32-house, 12-hotel limit; selling buildings back at half; mortgages, with 10% interest to lift one; Chance and Community Chest; jail (three doubles, Go to Jail, pay $50, Get Out of Jail Free, doubles to leave, pay on the third failed turn); Income Tax and Luxury Tax at the current amounts; trading properties, cash and Get Out of Jail Free cards between any players at any time; bankruptcy to another player or to the bank.
- No Free Parking money and no other house rules (my call; the official rules).
- The game ends when one player is left (owner's decision). No time limit game.
- Trades and auction bids are game actions, since players who are not on their turn take part. A trade is offered by one player to another and answered by that player.
- Nothing is hidden except the order of the Chance and Community Chest decks.
- Screen: the board with tokens, owners and buildings, a panel for the current turn (roll, buy or auction, build, mortgage, end turn), each player's cash and properties, the auction and trade panels, and the drawn card.

## Order of work

1. Coordinator: write this document, get it approved, write the plan, build the shared ground on `seven-new-games`, push it and open its PR.
2. Seven agents in parallel, one per game, each in its own worktree and branch, on its own port, each ending with a PR.
3. Coordinator: review each PR, and after each merge rebase the remaining branches over the registry and README lines they all touch.

## Left to the builders

- Each game's state shape, move and action types, and component breakdown.
- Exact screen layout and styling, within each game's scoped CSS and the platform's light and dark themes.
- Which moves animate, and how.
- FAQ wording.

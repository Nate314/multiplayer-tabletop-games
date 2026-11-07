# Ten New Games and Polish: Design

Date: 2026-11-07
Repo: `Nate314/multiplayer-tabletop-games`
Builds on: the platform as of `8593892` (custom domain builds, #72)

## Intent

The owner's group plays online in a Discord call. Who shows up changes from night to night, and so does the game they want, so the site needs a wide menu where anyone can join from a link and pick up the rules fast. This batch adds ten games and fixes a set of small annoyances in existing ones. All of it lands in one push (owner's decision).

Ten games:

- **Party word games:** Charades, Fictionary and Categories. These are traditional public-domain parlor games, built under their traditional names.
- **Original games in familiar genres:** each has its own name, art and content: Career Path (career race), Whodunit (deduction), Word Spies (team word association), Corners (polyomino territory, square and triangle boards), Trading Floor (open-outcry trading) and Steady Hand (steady-hand cursor game). No name, character, art, card text or board layout is copied from a commercial game. Every name in this document marked "my call" is a placeholder the owner may rename.

Polish:

- **Header menu:** every game's header controls go behind one menu button.
- **Naval Battle:** remove one ship while placing; a house rule that says a ship's length on its first hit.
- **Azul:** a pause before the scoring screen so the last move can be seen.
- **Jigsaw:** a house rule that rotates pieces.
- **Snakes and Ladders:** auto-roll; a Roll button that stays put.
- **UNO:** a target score of 0, meaning one round.

Generic names (wave 2, owner's request): 21 existing games carry a commercial game's trademarked name, and four of them (Monopoly, Ticket to Ride, The Crew and Risk) copy published content such as board names, a map or mission text. Game rules and mechanics are generally not protected; names, art, text and maps are. The owner wants every one of them renamed, ids included, with the same rules. This is a risk reduction, not legal advice.

## Goals

- Each new game is complete and playable, built the same way as the existing games: a `games/<id>/` folder with `types.ts`, `info.ts`, `options.ts` (when it has house rules), `index.ts`, `rules.ts`, rules tests, a manager test, `README.md` and a `client/` folder (`GameScreen`, `HistoryBoard`, `describeMove`, `faq`, `index.ts`, scoped SCSS, `animateMove` where it fits). Follow the nearest existing game: Pictionary for the party games, Monopoly or Parchisi for Career Path, Chess or Quoridor for Corners, Jigsaw for Trading Floor's anyone-at-any-time actions, and Jenga for Steady Hand's live play.
- Each game works with everything the platform gives a game: seating, rejoin, held seats, dismiss votes, undo votes, the History dialog, game files with "View as", spectators, the table screen, pause and resume, stats, house rules and the turn timer (or `ownTurnLimit` when the game has its own clock, as Pictionary does).
- **Rules from a reference.** The three traditional games and the genre games are checked against the Wikipedia article for the traditional game or genre (Charades, Fictionary, Categories (game), Blokus, Pit (game), Cluedo, Codenames, The Game of Life, Operation (game)). These are for rules only; no content is taken from them. The README lists every difference under "Differences from Wikipedia" in the format of `games/rook/README.md`. Where this document disagrees with Wikipedia, this document wins and the README lists it.
- **End-to-end tests** in `e2e/<id>.spec.ts`: one test per rule, control and difference listed in the README, as `e2e/codebreaker.spec.ts` does.
- **Hidden information stays hidden:** the Charades prompt, Fictionary's real definition and the authors of each definition, Categories answers before reveal, Whodunit cards and the solution, the Word Spies key, Trading Floor hands. All of it goes through `toPublicState`, `privateSeatView` and `secretState`, and `viewer: null` (History) sees none of it until the game reveals it.
- No new npm dependency.

## Non-goals

- Computer opponents.
- Video or voice inside the site. Charades relies on the group's own Discord cameras.
- Refactoring existing games beyond what the polish items need.
- User-supplied word or prompt lists.

## Anti-goals

- A game that looks finished but has a rule wrong in a way a regular player would notice.
- Any text, name, art or board that reads as a copy of the commercial game it is like.
- A secret (prompt, key, card, hand, real definition) reaching a browser that should not see it, including through History, a game file or a spectator.
- A real-time game (Trading Floor, Steady Hand) that refuses a fair action because a friend acted a moment earlier, or that floods the socket.
- Jigsaw rotating a piece when the player meant to drag it.
- A screen that is unusable on a laptop window or overlaps itself at phone width.

## Shared ground (on `party-games-and-polish`, before the fan-out)

One small commit by the coordinator, so three branches do not each move the same file:

- Move guess matching out of `games/pictionary/text.ts` into `shared/guess.ts` (`normalize`, `isCorrect`, `isClose`, `maskOf`), with its tests. Pictionary imports it from there. Behavior is unchanged. Charades, Fictionary and Categories use it.
- Add a header helper to `e2e/fixtures.ts`, for example `headerButton(page, name)`, that returns a header control by its accessible name, and switch the existing specs to use it for header controls (History, Share, Rules, Hide, Pause, Settings, Theme). For now it just finds the button in the header. Chunk 1 changes only this helper so it opens the ☰ menu first. Every new spec uses the helper for header controls, so no spec breaks when the menu lands (my call).

## Rules for every agent

- **Chunks, branches and PRs.** There are eight chunks (below), each with its own agent, its own git worktree and its own branch, started from `party-games-and-polish` after the shared ground and every plan are committed and pushed. Each agent follows its chunk's plan with subagent-driven development and opens a PR into `party-games-and-polish` (not `master`) when done (owner's decision). The coordinator merges them all into `party-games-and-polish`, checks that everything works together, and opens **one PR** against `master` (owner's decision).
- **Files outside its folders.** A game chunk may add one-line registration entries to `games/registry.ts`, `src/clientGames.ts`, `games/infos.ts`, `shared/svg/gameIcons.ts`, the lists that existing tests keep of every game (`shared/categories.test.ts`, `games/standings.test.ts`, `games/secretState.test.ts`, `games/privateSeatView.test.ts`), `server/assets/registry.ts` if it draws server SVGs, and its own `e2e/<id>.spec.ts`. It does **not** change the README's game list or count, the counts in `e2e/landing.spec.ts`, or `docs/architecture.md`. The coordinator updates those once after the merge, so the numbers do not collide eight ways. Nothing else in `src/`, `server/`, `shared/` or `e2e/fixtures.ts` is touched unless this document says so. If a chunk needs a platform or fixture change not listed here, the agent stops and reports it.
- **Undo.** Every turn move is undoable by vote, as in other games. Things not bound to a turn (writing an answer, voting, setup choices, Continue between rounds) are game actions. An undo never reveals a secret it did not hide.
- **Leaving.** Follow the nearest existing game. A game that needs a minimum (Word Spies teams, Fictionary voting) ends when the players left can no longer play, with the scores as they stand.
- **Tests.** Rules tests cover setup, every move and action type, game end and the hidden-information views. A manager test plays a short game through `createGameManager` with a seeded random. `npm test`, `npm run typecheck`, `npm run lint` and the chunk's e2e specs all pass.
- **Browser check.** The agent runs the site on its own port and plays in Chrome, one tab per player, through a full game or a forced game end. It checks History and a downloaded game file, and checks the screen at laptop size and at phone width (see the memory note on phone-width checks: use iframes, not window resizing).
- **Writing.** No em-dashes in READMEs, FAQs, comments or commit messages.

## Chunks

| # | Branch | Contents |
|---|--------|----------|
| 1 | `polish-header-azul-snakes-uno` | Header menu, Azul pause, Snakes and Ladders auto-roll and Roll button, UNO one-round target |
| 2 | `polish-naval-jigsaw` | Naval Battle removal and first-hit rule, Jigsaw rotation |
| 3 | `game-charades-fictionary` | Charades, Fictionary |
| 4 | `game-categories-wordspies` | Categories, Word Spies |
| 5 | `game-whodunit` | Whodunit |
| 6 | `game-careerpath` | Career Path |
| 7 | `game-corners` | Corners (square and triangle) |
| 8 | `game-tradingfloor-steadyhand` | Trading Floor, Steady Hand |

Small items are combined to keep the number of agents down (owner's decision). The grouping itself is my call.

**Wave 2** starts only after wave 1 (chunks 1 to 8) is merged into `party-games-and-polish` and passes the full test run, because renaming game folders would collide with wave 1's edits to Azul, UNO and the registration files (owner's suggestion). Wave 2 branches start from the merged `party-games-and-polish`:

| # | Branch | Contents |
|---|--------|----------|
| 9 | `generic-landlord-railroutes` | Monopoly and Ticket to Ride: new names, ids and original content, plus the legacy id plumbing |
| 10 | `generic-missiontricks-conquest` | The Crew and Risk: new names, ids and original content |
| 11 | `generic-board-tile` | Renames only: Azul, Carcassonne, Catan, Connect Four, Jenga, Parchisi, Quoridor, Rummikub, Scrabble, Splendor |
| 12 | `generic-card-party` | Renames only: Phase 10, Pictionary, Rack-O, Rook, Skip-Bo, UNO, Yahtzee |

Chunk 9 builds the legacy id plumbing (below) as its first task and opens a separate PR for it, merged before chunks 10 to 12 start, so only one branch writes the shared plumbing (my call).

## Polish

### Header menu (every game)

- The header keeps **Back to games**, the game name and the game id on the left. Everything else moves behind one **menu button (☰)** on the right: History, Share, Show QR code (table screen only), Rules, Hide, Pause (when allowed), Settings, GitHub and Theme.
- Pressing ☰ unfolds a **drop-down panel** under the button, listing those controls top to bottom with their labels (owner's pick of the two mockups). The panel animates open and closed (a short scale-and-fade from the top right corner) and respects `prefers-reduced-motion`.
- It starts closed. It closes on a second press of ☰, a click or tap outside, Escape, or choosing a control. The button has `aria-expanded` and `aria-controls`; focus moves into the panel when it opens and back to ☰ when Escape closes it.
- **Phones and desktop behave the same** (owner's decision). Share and Theme live in the menu at every width. The phone-only rows in Settings (`phoneControls` in `SettingsButton`, used by `GameView.tsx`: Pause, Share, Theme) are removed, so Settings shows only what it showed on desktop before. Remove the CSS that existed only to hide or squeeze header buttons on narrow screens.
- Any badge or state a control shows today (for example the Rules button's agreement prompt, Hide's state) stays visible inside the menu. If a control needs the player's attention while the menu is closed, ☰ shows a small dot (my call).
- Existing e2e tests reach header controls through the `headerButton` helper from the shared ground. This chunk changes that helper so it opens the menu first, and fixes any existing spec the menu still breaks. Nothing else in `e2e/fixtures.ts`.

### Azul

After the move that ends a round, the board stays as it is for **2.5 seconds** before the round summary opens, so everyone sees the last tile and the walls being tiled. This replaces `SUMMARY_DELAY_MS` in `games/azul/client/GameScreen.tsx` with 2500 ms from when the last move's animation starts. It is a client-side delay only. History playback is unchanged.

### Snakes and Ladders

- **Auto-roll**, copying War's Auto-flip (`games/war/client/GameScreen.tsx`): an "Auto-roll" checkbox for each player, client-only, off on load. When it is on and it is your turn, the game rolls for you after one second. It uses the same guard War uses so a click and the timer cannot both roll.
- **Steady Roll button:** the button stays in the same spot for the whole game. Give the status box a fixed height (it is always present, empty or not), give the roll panel a fixed layout that never wraps, and cut long names short with an ellipsis. Check at laptop and phone widths.

### UNO

- The Target score house rule gains a **0** choice, labeled "One round" (owner's decision). The game ends when the first round ends, and that round's winner wins. Add the choice through `targetScoreRule` in `games/uno/options.ts`; the label for 0 is set there, so other games' target rules are unchanged. The round summary and game over screens read naturally with it (no "first to 0 points" text).

### Naval Battle

- **Remove one ship while placing.** A placed ship can be dragged back to the tray, or selected with a tap and returned with a new **Remove** button beside Rotate. Clear and Random placement stay. Removing is draft-only (browser-side) until Confirm fleet, as now.
- **House rule "Say the length on the first hit"** (`announceLength`, toggle, off by default). When it is on, the first hit on a ship reports "hit a ship of length 3". Later hits on the same ship say "hit", and sinking works as now. The length is part of the shot result in the public state (it is meant to be public), and History and `describeMove` show it. Undo of that shot removes it.

### Jigsaw

- **House rule "Rotate pieces"** (`rotation`, toggle, off by default), in every mode (Solo, Together, Race).
- When it is on, every piece starts turned a random 0°, 90°, 180° or 270° in the scatter (the same turns for every Race board). A piece's state gains its quarter-turn count.
- **Turning a piece** (owner's pick): after a player touches or moves a piece, a small ↻ handle appears at its corner; pressing the handle turns it 90° clockwise. On desktop, R or a right-click also turns the piece being held. Dragging the piece body never turns it. Only the player who last touched the piece sees its handle; pieces held by others show no handle.
- Turning is an unrecorded action, like a loose drop: it is not a History step and Undo does not take it back (only snaps are recorded, as now) (my call).
- A piece snaps into place only when it is near its home **and** turned the right way up.

## The games

Player counts, names and content lists are my calls unless marked otherwise. Every word, prompt, definition, suspect, room, commodity and event is written fresh for this project.

### Charades (`charades`, Party games), 2 to 10 players

- Plays like Pictionary without the canvas (cameras are in the group's Discord call; guesses are typed in the game's chat, owner's decision). On each turn, the actor privately sees a few prompts and picks one, then acts it out on camera while the timer runs. Everyone else types guesses into the chat, which uses the shared guess matching, with close-guess hints as in Pictionary.
- Scoring, phases, chat audience and house rules (time per turn, number of choices, turns per player) copy Pictionary's, and the game sets `ownTurnLimit`.
- The screen shows the timer, the masked prompt for guessers (word lengths, as Pictionary's mask does), the chat and the scores. The actor's screen shows the prompt large so it can be glanced at while acting.
- A prompt list of at least 300 actable prompts (actions, animals, jobs, sports, everyday phrases), kept server-side as Pictionary's words are.

### Fictionary (`fictionary`, Party games), 3 to 8 players

- Each round shows one obscure real English word from a built-in list. Every player privately writes a believable fake definition within the writing time.
- The real definition is shuffled in with the fakes, and everyone votes for the one they think is real (never their own).
- Scoring: 2 points for voting for the real definition; 1 point to an author for each vote their fake gets. If a player's submission matches the real definition closely enough (the shared guess matching on normalized text), they get 3 points and their entry is not shown as a separate choice.
- The reveal shows who wrote each definition and who voted for what, then everyone presses Continue.
- No dealer: the game holds the real definition. House rules: number of words (5, 8 or 10; standard 8) and writing time (60, 90, 120 or 180 s; standard 120). Writing and voting end early once everyone has submitted.
- A list of at least 200 real, rare words with short accurate definitions. Each definition is checked against a dictionary while it is written; a wrong definition is a bug.

### Categories (`categories`, Party games), 2 to 8 players

- Each round deals a random letter, from a set without the hard letters Q, U, V, X, Y and Z (my call), unless the **Hard letters** house rule (toggle, off by default, owner's decision) puts them back in, and a list of 12 categories from a built-in pool of at least 150.
- Everyone types an answer for each category, starting with that letter, before the timer runs out. Answers are hidden until the timer ends or everyone presses Done.
- **Review:** answers are shown side by side, category by category. Any player can challenge an answer; the other players vote and a majority rejects it. An answer that does not start with the letter is rejected automatically.
- Scoring: 1 point for each valid answer no one else gave; duplicates (equal after normalizing, ignoring a leading "a", "an" or "the") score 0. Highest total after the rounds wins.
- Other house rules: rounds (1 to 5; standard 3), time (60, 90, 120 or 180 s; standard 120), categories per list (8, 10 or 12; standard 12).

### Word Spies (`wordspies`, Party games), 4 to 8 players

- Two teams, Red and Blue, each with one clue-giver. In the lobby each player picks a team and a role, and an **Even out** button balances them. The game cannot start until each team has a clue-giver and at least one guesser.
- A 5 × 5 grid of words from a built-in list of at least 400. The secret key: 9 for the starting team, 8 for the other, 7 bystanders, 1 trap. Clue-givers see the key; guessers do not.
- The clue-giver types one word and a number. A clue that is a word on the grid (normalized) is refused, so nobody can hint over voice.
- Guessers on that team tap words. A tap by any guesser on the team counts (my call). They get up to the number plus one guesses and may stop early with **End guessing**. A bystander or the other team's word ends the turn. The trap loses the game at once.
- The first team to reveal all its words wins. Standings show the winning team's players as winners.
- The key is in each clue-giver's private view only, and in `secretState`. Spectators see the key (`spectatorsSeeEverySeat` style).

### Whodunit (`whodunit`, Classic board games), 3 to 6 players

- An original setting (my call: a seaside hotel) with 6 suspects, 6 objects and 9 rooms, each with an original name and drawn art. One of each is the hidden solution; the rest are dealt out.
- A grid board of rooms joined by corridors, with doors and two pairs of secret passages between corner rooms. On a turn you roll two dice and move that many squares through corridors, or take a passage, or stay in a room you were moved into.
- In a room you may make a **suggestion** of a suspect and an object in that room. The suspect's token moves there. Going clockwise, the first player who holds one of the three cards must privately show one of them to you (they choose which if they hold more than one). Everyone sees who showed a card, but not which.
- An **accusation** may be made on your turn, once. If it is wrong, you are out of turns but still show cards. If it is right, you win. If everyone is out, nobody wins and the solution is shown.
- Each player gets a private notes sheet that the game keeps (ticks and marks per card), saved in their private view so it survives a rejoin.
- Suggestion results go only to the two players concerned. The solution is in `secretState` until the game ends.
- **Leaving:** going Back to games, closing the tab or losing the connection mid-game only holds the seat, as the platform already does, so nothing is revealed and the player rejoins with their cards (owner's concern). Only a player who is actually removed from the game by a dismiss vote has their cards turned face up for everyone, so the deduction stays sound. Play goes on while two or more players can still accuse (my call: a common house rule). An e2e test covers leaving to the game list and rejoining a minute later with nothing revealed.

### Career Path (`careerpath`, Classic board games), 2 to 6 players

- An original career race on a winding path (my call: about 90 spaces), with a spinner of 1 to 10.
- **Start fork:** College (costs money, later better jobs) or Straight to work.
- Space types: payday (collect salary), job (draw a career card from a pick of two), event (gain or lose money), house (may buy one of two house cards), family (add a partner or a child), risk (spin for a payout), stop spaces that you must stop on (graduation, marriage, house, retirement), and a midgame fork (Safe road or Fast lane).
- Money below zero takes an automatic loan with interest, paid back at retirement.
- At retirement, houses sell for their card value and children add a bonus. The richest player wins.
- All job, house and event texts are original. Two house rules (my call): game length (Short or Full path) and starting cash.
- **House rule "Board"** (choice: Career Path or 1860 Checkered; standard Career Path; owner's decision). The **1860 Checkered** board plays Milton Bradley's public-domain *The Checkered Game of Life* (1860), drawn with this project's own art:
  - An 8 × 8 checkerboard. Pieces stand on the light squares, which carry the named squares; start is Infancy in the bottom-left corner and the goal is Happy Old Age in the top-right corner, worth 50 points.
  - A spinner of 1 to 6 (the original teetotum). 1: one square up or down; 2: one square left or right; 3: one square diagonally; 4: one or two squares up or down; 5: one or two squares left or right; 6: one or two squares diagonally. The player chooses among the legal moves.
  - Named squares send you on (for example Bravery to Honor, School to College, Honesty to Happiness, Industry to Wealth, Gambling to Ruin, Idleness to Disgrace, Crime to Prison) and score points (Wealth 10; Honor, Happiness, College, Success, Fat Office and Congress 5 each). Prison loses a turn.
  - The square named Suicide in the original is renamed **Despair** (my call) and sends the player back to Infancy with all points lost, rather than out of the game, so nobody sits out the rest of an online session (my call; sources differ).
  - Win: land on Happy Old Age with at least 100 points counting its 50. Arriving short, keep playing and collect more.
  - The exact square layout is copied from a public-domain scan of the 1860 board (for example the Smithsonian's or the Library of Congress's); the README cites the scan used and lists anything that could not be read. The 1860 rules on this page come from secondary sources (Wikipedia, thebiggamehunter.com, baldwin-games.com), which disagree in places; the builder settles each disagreement from the scan's printed rules where readable, and lists every choice in the README.

### Corners (`corners`, Strategy board games), 2 to 4 players

- **House rule "Board"** (`board`, choice: Squares or Triangles; standard Squares).
- **Squares:** a 20 × 20 grid and 21 polyomino pieces per color (1 to 5 squares). **Triangles:** a hexagon-shaped triangle grid and 22 polyiamond pieces per color (1 to 6 triangles). The exact triangle board and set are checked against the Wikipedia article on the triangle variant.
- Each player's first piece covers their starting corner (Squares) or a starting point (Triangles). Every later piece must touch a piece of the same color at a corner and never along an edge. Pieces may rotate and flip.
- A player with no legal placement passes for the rest of the game. When nobody can place, the game ends. Scoring: minus one per unplayed square or triangle; plus 15 for placing every piece, plus 5 more if the last piece was the single square or triangle. Highest score wins.
- 2 players play two colors each. 3 players play one color each and take turns placing the fourth, shared color, which scores for no one (my call: matches the common rule).
- Controls: pick a piece from your tray, rotate and flip it with buttons (and keys on desktop), preview it on the board with legal spots shown, tap to place. Works by tap on phones.

### Trading Floor (`tradingfloor`, Card games), 3 to 8 players

- An original commodity-trading card game (my call: commodities such as Copper, Coffee, Cotton, Cocoa, Silver, Sugar, Soy and Saffron, each with a point value). The deck holds one commodity per player, 9 cards each, and each player is dealt 9 cards.
- **No turns: everyone trades at once.** A player puts up an offer of 1 to 4 cards that must all be the same commodity, showing only the count ("3!"). Any other player with an open offer of the same count can accept it, and the cards swap blind. Offers can be withdrawn. Offers, accepts and withdrawals are game actions; a swap is recorded in History.
- Whoever first holds all 9 of one commodity presses **Corner!** and wins the round, scoring that commodity's value. First to the target score (house rule: 250 or 500; standard 500) wins the game.
- **House rule "Bull and Bear"** (off by default), following Pit's rules on Wikipedia (my call): one Bull and one Bear are added to the deck, so two players are dealt 10 cards. Either card may ride along in any offer with the commodity cards (it does not have to match them). The Bull is wild for a corner: 8 of a commodity plus the Bull corners for its value, and all 9 plus the Bull corners for double. The Bear cannot be part of a corner. Whoever holds the Bear when a round ends loses 20 points, and whoever holds the Bull without cornering loses 20 too.
- Two players accepting the same offer at once: the first to reach the server wins, and the other gets a quiet "already taken" with nothing lost. Hands are private views.

### Steady Hand (`steadyhand`, Party games), 1 to 8 players

- An original theme (my call: a robot repair bay). A board of parts sits in narrow, twisting slots.
- On your turn you pick a part, then drag it out along its slot to the exit with the cursor or a finger. Touching a slot wall buzzes and ends your turn, and the part goes back. A part brought out scores its value. Slots vary in width and length, so harder parts score more.
- A buzzed part stays in its slot for anyone to try. The game ends when every part is out, and the highest score wins.
- **House rule "Buzzes allowed"** (owner's decision): Unlimited, 1, 3 or 5 per player. The standard is 3 with one player and Unlimited with two or more (`standardFor`). A player who has used all their buzzes is out of turns; the game ends when every part is out or nobody has buzzes left.
- **Solo:** the game is a score attack: your score is the value of the parts you got out, plus a bonus for each buzz you have left if you cleared the board (my call).
- **Live play:** the dragging player's position is checked in their own browser against the slot shapes, and the result (out or buzzed) is sent as the turn move. Everyone else watches the part move live from a throttled stream (at most 20 updates a second), which is not recorded in History. Trusting the player's browser is acceptable for a friends' game (my call).
- House rule (my call): wall tolerance (Easy, Normal or Hard), which widens or narrows every slot.

## Generic names (wave 2)

### What every renamed game gets

- **A new id and folder.** `git mv games/<old> games/<new>` so history follows, then the new id everywhere: `info.ts`, `games/registry.ts`, `games/infos.ts`, `src/clientGames.ts`, `shared/svg/gameIcons.ts`, `server/assets/registry.ts`, the test lists of every game, `data-game` selectors in SCSS, and `e2e/<old>.spec.ts` renamed to `e2e/<new>.spec.ts`.
- **A new name, icon and wording.** The player-visible name, landing description, icon, README and FAQ use the new name. The game's README may say once, in its opening, that it plays like the commercial game ("plays like Monopoly"), which is descriptive use; nothing else shows the old name. "Differences from Wikipedia" stays and keeps pointing at the Wikipedia article for the rules.
- **Art check.** Any drawn art, piece or card design that imitates the commercial game's look is redrawn in the project's own style.
- **Same rules.** Rules, house rules and options are unchanged, so existing rules tests pass after only the renames.
- **Old data keeps working** (my call). A single `games/legacyIds.ts` maps each old id to its new id. It is used:
  - once at server start, to update `game_type` in the stats database (`server/stats/store.ts`);
  - when loading a pause file, a downloaded game file or an open game saved before the rename;
  - for old join and share links (`/join/<old id>/...` goes to the new id);
  - for browser-stored settings keyed by game id (remembered house rules, layout, filters), copied to the new key on first load.
  Each use has a test. The old ids appear nowhere else in the code.
- The top-level README game list and count, `e2e/landing.spec.ts` and `docs/architecture.md` are updated by the coordinator after wave 2 merges, as in wave 1.

### New names

All names are my calls; the owner may rename any before the plans are written. Each new id is the name in lower case with no spaces or punctuation.

| Old | New name (id) | Note |
|-----|---------------|------|
| Monopoly | **Landlord** (`landlord`) | After Lizzie Magie's public-domain *The Landlord's Game* (1904) |
| Ticket to Ride | **Rail Routes** (`railroutes`) | |
| The Crew | **Mission Tricks** (`missiontricks`) | |
| Risk | **Conquest** (`conquest`) | |
| Azul | **Tessera** (`tessera`) | |
| Carcassonne | **Countryside** (`countryside`) | |
| Catan | **Frontier Isle** (`frontierisle`) | |
| Connect Four | **Four in a Row** (`fourinarow`) | Generic name |
| Jenga | **Block Tower** (`blocktower`) | |
| Parchisi | **Pachisi** (`pachisi`) | The traditional Indian game's name |
| Quoridor | **Maze Race** (`mazerace`) | |
| Rummikub | **Rummy Tiles** (`rummytiles`) | |
| Scrabble | **Letter Grid** (`lettergrid`) | |
| Splendor | **Gem Merchants** (`gemmerchants`) | |
| Phase 10 | **Stage Rummy** (`stagerummy`) | |
| Pictionary | **Sketch** (`sketch`) | |
| Rack-O | **In Order** (`inorder`) | |
| Rook | **Raven** (`raven`) | |
| Skip-Bo | **Spite and Malice** (`spiteandmalice`) | The traditional card game Skip-Bo grew from |
| UNO | **Color Match** (`colormatch`) | |
| Yahtzee | **Five Dice** (`fivedice`) | |

### Original content (chunks 9 and 10)

- **Landlord:** a new board with the same structure (40 spaces, the same price, rent, group and space-type pattern) but original street, station and utility names (my call: a fictional city), and two new card decks with original text that keep each card's effect. The two deck names change too (my call: Fortune and Town Fund).
- **Rail Routes:** an original map, not the published one. Same rules and the same totals (number of routes, colors and lengths, train counts, ticket count and point spread) so the game balances the same way, but a fictional geography with its own city names, route network and tickets (my call: a fictional continent). Ticket scoring is recomputed for the new map and tested.
- **Mission Tricks:** a newly written mission campaign with the same number of missions and the same mechanics (task counts, task tokens, communication limits, special rules), with original mission titles, story text and task setups. No sentence from the published logbook.
- **Conquest:** an original map with the same structure (the same number of territories and continents, the same continent bonuses and a comparable adjacency pattern), with original territory and continent names and borders (my call: a fictional world).
- All four: rules tests are updated where they name spaces, cities, missions or territories; the hidden-information and manager tests still pass.

## Order of work

1. Coordinator: this document, approval, the shared ground commit, one plan per chunk, all committed to `party-games-and-polish` and pushed.
2. In parallel: eight agents, one per chunk, each in its own worktree and on its own port, each opening a PR into `party-games-and-polish`.
3. Coordinator: review and merge every wave 1 PR into `party-games-and-polish`, resolve the conflicts on the registration lines, update the README game list and count, the `e2e/landing.spec.ts` counts and `docs/architecture.md`, and run `npm test`, `npm run typecheck`, `npm run lint` and the full `npm run test:e2e`.
4. Wave 2: chunk 9's legacy id PR first, merged; then the rest of chunk 9 and chunks 10 to 12 in parallel, each opening a PR into `party-games-and-polish`.
5. Coordinator: merge wave 2 and update the same README, landing and architecture lines. Check that no player-visible text still shows an old name (a grep over `games/`, `src/`, `server/` and `e2e/` for each old name, outside `games/legacyIds.ts` and the one descriptive README line). Run the full test suite again, play several games in the browser at laptop and phone widths, and check that an old link and an old stats row still work. Then open one PR against `master`.

## Left to the builders

- Each game's state shape, move and action types, and component breakdown.
- Exact screen layout and styling, within scoped SCSS and the light and dark themes.
- Which moves animate, and how.
- FAQ wording.
- The content lists themselves (prompts, words, definitions, categories, suspects, rooms, careers, events, commodities, part shapes), within the rules above.
- Board layouts for Whodunit, Career Path and Steady Hand.

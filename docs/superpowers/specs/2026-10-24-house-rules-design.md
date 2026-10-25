# House Rules Design

## Intent

Groups play with their own rules at home. The first player to join a game sets the house rules before play starts, everyone else sees them and agrees, and the rules stay visible for the whole game. This also lets a group play a game with more or fewer players than the box allows, behind an explicit "I know what I'm doing" checkbox.

## Goals

- A platform framework for per-game house rules: the game declares its options, the platform handles the lobby form, the host, the agreement vote and showing the rules later
- The first set of rules listed below, each working end to end
- A player-count override that lets the table limit go outside the game's normal range, within a range the game declares it still works at
- Rules recorded with the game, so history, rejoin, restart of the server and saved game files all know which rules were in play

## Non-goals

- Changing rules after the first move
- Saving rule presets between games
- Rules for games not listed below (they can be added later, one small PR per game)
- Dominoes layout rules and the Catan special build phase (their own PRs, built on this framework)

## Anti-goals

- A player ends up in a game under rules they never saw. Agreement must always be to the rules currently shown
- A group that does not care about house rules is slowed down: every game opens with its default rules selected, so everyone just presses Agree. Defaults are each game's standard rules, except where the user chose otherwise (Mancala's two rules below, and the Dominoes layout default in its own design)

## Build order (my call)

Dominoes and Catan branch from this work. Land the framework (the option declarations on `GameDefinition`, the lobby form, host, vote, the read-only view and the player-count override in seating) as the first commit and push it, before any game's rules, so those branches can start from it instead of guessing its shape. The framework must support options that are only offered at certain seat counts (Catan's special build phase needs 5 or more, Rook's team options need 6). The out-of-turn move mechanism (for Uno jump-in) also belongs in the framework commit, because the Catan special build phase uses it too.

## Lobby flow (decided with the user)

- The host is the first player to join. Only the host can edit the house rules form
- Every other player sees the same form read-only, updated live as the host changes it
- Every seated player, the host included, presses Agree. Each player's agreement is shown, like the Azul end-of-round Continue (`shared/rounds.ts` is the existing pattern)
- No move can be made until every seated, connected player has agreed. The first move locks the rules, as it already locks joining
- Any change to the rules by the host clears every agreement
- A player joining or leaving the lobby clears every agreement
- If the host leaves before the game starts, the next player in seat order becomes host and the current choices are kept
- A game whose rules are all standard still shows the form and still needs agreement (Builder: if the game has no house rules and no player-count override at all, skip the form and the vote entirely)

## Showing the rules during the game (decided)

The rules chosen at the start are viewable by every player for the whole game, read-only. Until the preferences PR's settings screen lands, this is a "House rules" button in the game header that opens a dialog listing each rule and its value, non-standard values marked. When the branches are combined, the dialog's content moves into the settings screen.

## Player-count override (decided)

- Each game may declare a stretched player range in addition to its normal `minPlayers` and `maxPlayers`. A game with no stretched range shows no override
- The host ticks "I know what I'm doing" to unlock a player-count field, and can then set the maximum table size anywhere in the stretched range (one number, my call). It cannot be set below the number of players already seated
- Seating (`shared/seating.ts`, "Game is full") uses the chosen maximum instead of `maxPlayers`. With the override ticked, the game can start with as few players as the stretched range's minimum; without it, the normal `minPlayers` applies
- The game's rules must work at every count in its stretched range

Stretched ranges agreed so far:

- Catan: down to 2 (normal board). 5 and 6 come from the Catan expansion PR
- Rook: 4 to 7, see below
- Chess, Euchre, Spades, Hearts and any other game whose rules do not stretch: no override
- Builder: pick the remaining games' ranges from where their rules still hold (for example Uno up to 10), and list every game's range in the PR description for the user to check

### Rook at 5 to 7 players (decided)

- 4 players: the usual 2 teams of 2
- 5 players: the winning bidder calls one partner card, so it is 2 against 3 for that hand
- 6 players: a house rule chooses 2 teams of 3 or 3 teams of 2; teams are fixed for the game
- 6 players as 3 teams of 2: a further house rule, offered only with that choice, sets how the two non-bidding teams score: each team scores the counters it takes on its own, or the two defending teams play together for the hand and each scores the counters they take together
- 7 players: the winning bidder calls two partner cards, so it is 3 against 4 for that hand
- A called partner stays secret until the called card is played. The bidder may call a card that is in the kitty and so play alone (the user approved this guess)
- With called partners, each player scores individually across hands, since teams change every hand
- Hand and kitty sizes adjust so the deck deals evenly. Builder: work out the counts from common 5-handed Rook rules and write them in the game's README

## The first set of rules (approved by the user)

Standard rules are the default for every option unless noted.

- **Chess:** a clock with 5, 10 or 15 minutes per player (or off, the default), plus an optional increment per move. A player whose time runs out loses. The clock is kept on the server
- **Monopoly:** Free Parking jackpot (taxes and fees go into a pot, landing on Free Parking collects it); $400 for landing exactly on GO; auctions on or off
- **Uno:**
  - Stacking +2 and +4 cards
  - 7-0: playing a 7 swaps hands with a chosen player, playing a 0 passes every hand along
  - Draw until you can play
  - Jump-in (the user's own rule): a number card can be played out of turn if its number and color match the top card exactly, and the turn order continues from the player who jumped in. Number cards only. The first jump-in the server receives wins a race. It can be undone like a normal move
- **Scrabble:** a turn timer of off, 1, 2, 3 or 5 minutes. When it runs out, tiles placed this turn go back to the rack and the turn passes
- **Mancala:** two rules, both on by default:
  - When your side is empty, you pick any non-empty pit on the other player's side and sow from it counter-clockwise as usual; your own bank gets stones as you pass it. With this rule on, the game ends only when every pit is empty (instead of when either row is empty)
  - Avalanche (today's game). Off plays Kalah, with captures
- **Catan:** friendly robber: players with 2 points or fewer cannot be robbed
- **Phase 10:** phases in any order
- **Hearts:** the Jack of Diamonds is worth minus 10
- **Every game with a target score:** the target is adjustable (for example Farkle 10,000, Spades 500, Dominoes 100)

## Constraints

- Follow the existing platform and game split (`docs/architecture.md`): the platform owns the form, host, vote and display; each game declares its options and applies them in its own rules
- Moves are validated on the server. Rule values sent by the host are untrusted input and must be checked against the game's declared options
- The timers (chess clock, Scrabble timer) must survive a server restart and work with undo. Builder: decide how undo treats clock time and document it in the game's README
- Jump-in is out of turn, which the platform's turn guards block for moves today. Builder: find the smallest platform change that lets a game accept an out-of-turn move and still record it for undo
- Each changed game's README "Rules" and "Differences from Wikipedia" sections, and its FAQ, cover the new options
- Tests: unit tests for the framework and each rule; e2e tests in the existing style for the lobby flow and at least one rule per game
- Styles in SCSS, nested under the game's `[data-game]` block, matching the SCSS migration (PR #21)

## Left to the builder

- The shape of the option declarations on `GameDefinition` and how a game reads the chosen values
- New WebSocket messages or actions for setting and agreeing
- The look of the form and dialog, following the existing platform styles

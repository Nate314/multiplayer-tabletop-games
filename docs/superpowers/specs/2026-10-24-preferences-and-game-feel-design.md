# Preferences and Game Feel Design

## Intent

Make games easier to follow and nicer to play: a personal settings screen, sounds (most of all a chime when it is your turn), symbols for players who are color blind, and move animations for the games that have none.

## Goals

- A settings screen each player opens from a gear in the game header and from the landing page. Every setting is per player, kept in that browser's `localStorage` through `src/services/settings.ts`, and changes nothing for other players
- Sounds with their own settings
- Color-blind symbols
- Move animations for Phase 10, Rack-O and Yahtzee, the three games with none today
- A "Highlight newly drawn cards" setting for card games

## Non-goals

- Accounts or settings that follow a player between devices
- New colors or palettes for color-blind players (symbols only)
- Recorded audio files

## Anti-goals

- A setting that changes what other players see or hear
- Sounds that play during History scrubbing unless the player turned them on there

## Settings screen (decided)

- A gear button in the game header (next to History and FAQ) and on the landing page opens it
- It holds: sound settings, "Color-blind symbols", "Highlight newly drawn cards"
- It is where the house rules of the current game will be shown read-only once the house rules PR is combined with this one. Builder: leave a clear spot for a "House rules" section that renders nothing when the game has none
- The theme toggle stays where it is
- Controls use the themed checkbox and select styles from the UI polish PR when combined; until then, style them to match the platform buttons

## Sounds (decided)

- **Your turn:** a clear chime when it becomes your turn. It plays when the tab is in the background too
- **Moves:** a soft click when anyone moves a piece or plays a card
- **Dice:** a rattle when dice are rolled
- **Game over:** a short flourish
- **Timer warnings:** a tick in the last 10 seconds of a chess clock or Scrabble turn timer (the timers come from the house rules PR; build the sound and its setting here, and hook it up when combined)
- **Settings:** a volume slider, Mute all, and one checkbox per group (turn chime, moves, dice, game over, timer warnings). Everything is on by default at a moderate volume
- **History:** the History dialog has a Sounds option, off by default. When on, stepping forward plays that move's sounds, never the turn chime. It lives in the History dialog's settings gear from the UI polish PR when combined; until then put it next to the Animations checkbox
- **How (my call, not the user's):** sounds are generated with the Web Audio API, with no audio files. Browsers only allow audio after a user gesture, so the audio context starts on the player's first click or key press
- Builder: decide how a game signals "dice rolled" or "game over" to the sound player. Prefer deriving it from the state change (as `useMoveAnimation` does) over adding a field to every game

## Color-blind symbols (decided)

- A per-player "Color-blind symbols" checkbox, off by default
- When on, every color that matters gets a matching shape on the card, tile or piece. Colors stay as they are
- The same color gets the same symbol in every game, for example red circle, blue square, green triangle, yellow star. Builder: pick a symbol per color used anywhere in the site and document the table in `docs/architecture.md`
- Applies anywhere color alone tells things apart. Builder's starting list: Phase 10, Uno, Rummikub and The Crew suits; Azul tiles; Splendor gems; Ticket to Ride train cards and routes; player colors in Risk, Parchisi, Connect Four, Catan and Mancala. Games where color is already backed by a symbol or number (standard playing card suits) get nothing extra
- The History dialog and saved games show the symbols too while the setting is on

## Animations (decided)

Same rules as the games that already animate: through `useMoveAnimation` live and `animateMove` in the History dialog, about 300 ms per move (`MOVE_DURATION_MS`), nothing under `prefers-reduced-motion: reduce`.

- **Phase 10:**
  - The drawn card slides from the draw or discard pile into its place in your hand
  - Another player's draw slides a card back (or the face-up discard) from the pile to their seat
  - A discard slides from the hand to the discard pile
  - Laying down a phase slides the cards from the hand to the table
  - A hit slides the card onto the set or run it was added to
  - A Skip slides to the discard pile and the skipped player's seat flashes
- **Rack-O:**
  - The drawn card slides from its pile to the holding spot
  - A swap slides it into the rack slot, and the replaced card slides to the discard pile
  - Other players see a card back slide to and from their rack
- **Yahtzee:**
  - Rolled dice tumble briefly while held dice stay still
  - The chosen score slides from the dice into its row on the scorecard

## Highlight newly drawn cards (decided)

- A per-player setting, on by default (the user approved this default as a guess)
- When on, the card you just drew keeps a highlight outline until your next action that ends the draw (a discard, a play, or the end of your turn). Builder: settle the exact end per game and say it in each README
- Applies to Phase 10, Rack-O, Uno, Skip-Bo, Rummikub, Go Fish and Ticket to Ride
- When off, the slide animation still plays

## Constraints

- No new runtime dependencies
- Every storage access may fail; the site works without remembered settings (`storage.ts` already handles this)
- Styles in SCSS, matching PR #21
- Tests: unit tests for settings and the sound trigger logic; e2e tests for the settings screen, color-blind symbols in at least one game, and the highlight; each new `animateMove` gets tests in the style of `games/azul/client/animateMove.test.ts`
- `docs/architecture.md`, the README and affected game READMEs and FAQs are updated

## Left to the builder

- The exact sounds, symbol shapes and settings screen layout
- How the turn chime detects "it became my turn" across rejoin and undo (an undo that gives the turn back should not chime twice)

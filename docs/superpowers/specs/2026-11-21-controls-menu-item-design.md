# A Controls item in every game's menu

Approved approach in conversation on 2026-11-21 (option 1: a hand-written controls list per game).

## Why

Games keep gaining key bindings (R turns a piece, the arrow keys move a selection, Q, E and F in Corners, hold-to-turn
keys in Block Tower), and the only place they are written down is inside FAQ answers, mixed in with the rules. A player
who wants to know "how do I do this here" should find it in one place, the same place in every game.

This is the first of two projects. The second adds full keyboard play and shortcut keys to the games that lack them,
in batches, and each batch updates its games' controls lists. This project describes the controls as they are today.

## Goals

- Every game's menu (☰) has a Controls item that opens a dialog listing that game's controls.
- Each row says what the player is doing, how to do it with a mouse or by touch, and which keys do it, if any.
- The lists are accurate to today's code: every control listed exists, and every control the game has is listed.
- Control how-tos are explained once: answers in the FAQ that only explain controls move to the Controls list.

## Non-goals

- No new key bindings or keyboard play (that is the second project).
- No Controls in the join dialog or on the landing page *(my call: you asked for a game menu item; the join dialog's
  Rules button keeps the FAQ)*.
- No shared key-binding model that drives both the handlers and the dialog (option 2, rejected: it means rewriting the
  14 games' differing key handling first).
- No controls for the app around the game (menu, reactions, undo vote): only the game's own play.

## Anti-goals

- A list that says a key or gesture works when it does not, or invents controls. Every row must be traceable to the
  game's client code.
- Rules text in the Controls list. It says how to do things, not what is allowed.
- A dialog that scrolls sideways at phone width.

## Approaches

1. **A hand-written list per game (picked).** A `controls` list next to each game's FAQ, shown by a new Controls dialog.
   Simple, follows the FAQ pattern, handles unusual controls. Cost: it can drift from the code; a test that every game
   has one, and the second project's e2e tests, catch most drift.
2. Keys declared once, read by both the handlers and the dialog. Never drifts, but needs the 14 games' key handling
   rewritten into one model first, and mouse and touch rows stay hand-written.
3. A Controls tab in the Rules dialog. Less new code, but you asked for a menu item, and a tab hides it behind Rules.

## Design

### Data

- `src/clientGames.ts` gains `export type ControlItem = { action: string; pointer?: string; keys?: string }` and a
  required `controls: ControlItem[]` on `ClientGame`.
  - `action`: what the player is doing, short, starting with a verb: "Move a piece", "Turn the held piece".
  - `pointer`: how with a mouse or by touch: "Click the piece, then the square it goes to. Or drag it."
  - `keys`: which keys, only when the game has its own: "R". Absent when the action is only Tab and Enter on its
    buttons, since the dialog says that once for every game.
  - At least one of `pointer` and `keys` is present.
- Each game's list lives in `games/<id>/client/controls.ts` (export `CONTROLS`), beside `faq.ts`, and its client
  index adds `controls: CONTROLS`.
- Rows are in the order a player meets them in a turn.
- One flat list per game. A control that only exists in some modes, house rules or roles says so in its own text
  ("With the Rotation house rule: ...") rather than through a condition field *(my call)*.
- What counts as a control *(my call)*: every way to act in the game's own play: gestures, drags, clicks on the board
  or hand, keys, and each on-screen game action button (Roll, Pass, Draw, Offer a draw). Not the app's own items
  (the menu, reactions, undo and pause votes, Back to games).
- `controls` is optional on `ClientGame` while the lists are being written and becomes required in the last task, once
  all 55 games have one, so the build passes at every commit *(my call)*.

### Dialog

- A Controls item in `GameMenu`, right after Rules, labelled "Controls" with an icon matching the other menu items.
  It is shown everywhere the menu is (lobby, play, game over, spectators, pass and play), except on the table screen
  (the TV view takes no input) *(my call)*.
- The game page already has the loaded client (`GameView` passes `client.faq` to the Rules dialog), so the dialog
  takes `client.controls` as a prop and needs no loading state.
- It opens a dialog titled "<Game name> controls", built like the Settings and Rules dialogs: same frame, close
  button, Escape closes it, focus moves in and returns to the menu button on close.
- A fixed line at the top for every game: "Tab moves between buttons, and Enter or Space presses one."
- Then the rows, with three columns ("To", "Mouse or touch", "Keys") on wide screens, and stacked (the action as a
  heading, the other two under it with their labels) on narrow ones. A missing cell shows nothing. Markup that reads
  well to a screen reader (a real table, or a description list as `FaqList` uses).
- Works at 320px and on desktop with no sideways scroll, in light and dark themes.

### Content

- Written from each game's client code, checked against its FAQ. The FAQ is not trusted on its own: where they
  disagree, the code wins and the FAQ is corrected.
- FAQ trimming: an FAQ answer that only explains controls is removed. One that mixes rules and controls keeps the rules
  and drops the control steps. Answers about rules, modes, scoring and connection stay.
- Games whose only controls are buttons with visible labels (Roll, Pass) still list them, so every list is useful.
- Copy follows the project rules: plain words, no em-dashes, "click or tap" style as the FAQs already use.

### Tests

- A unit test that every game in `GAME_INFOS` loads a client whose `controls` is non-empty, each row has an `action`
  and at least one of `pointer` and `keys`, and no two rows share an `action`.
- An e2e test that opens Controls from the menu in one game, sees its rows and the Tab line, and closes it with
  Escape and with the close button, focus returning to the menu.
- FAQ trimming is part of this project, done with each game's list. An e2e check of FAQ text that was removed moves
  to the Controls dialog when it was checking the control's description, and is deleted when it only checked that
  the FAQ shows *(my call)*.
- Accuracy: each batch's review checks every row against that game's client code, not only the test *(my call)*.
- Delivery: commits on the current branch, `open-games-flag`, with the rest of its work; no separate PRs.

## Left to the builder

- The dialog's exact markup and styling, matching the existing dialogs.
- The icon.
- Grouping the 55 games into batches for writing the lists.
- Wording of each row, within the rules above.

# A shared device's move or action names its seat

A small change, approved in conversation on 2026-11-15.

## Why

On a pass and play device the server acts for the one seat the device shows (`connection.seat`). Bingo lets every local
player mark their own cards at any time, so its screen sends `SHOW_SEAT` and then the action. Between the two, a state
change can run `handoffSeat` and move the shown seat, and the action then lands on the wrong player's card.

## Goals

- A `MAKE_MOVE` or `GAME_ACTION` from a shared device may carry `payload.seat`, and is then made for that seat.
- Bingo names the seat on every send and stops sending `SHOW_SEAT` first.

## Non-goals

- No other game changes. Without `seat`, every message works exactly as today.
- No change for ordinary (one-seat) connections or spectators: they ignore `seat`.
- The shown seat is left alone by a seat-named message (the normal handoff after the state change still runs).

## Approaches

- **Name the seat on the message (picked).** One check on the server, reusing the `SHOW_SEAT` rule, and no ordering
  between two messages left to go wrong.
- Queue `SHOW_SEAT` and the action together on the server: only narrows the gap.
- A new message type for "act as seat N": duplicates `MAKE_MOVE` and `GAME_ACTION`.

## Design

- `server/server.ts` `handleLocalMessage`: for `MAKE_MOVE` or `GAME_ACTION` with `payload.seat` present, the seat must
  be one of `connection.localSeats`, else `GAME_ERROR` "Not one of this device's players". A valid seat calls
  `manager.move` or `manager.action` for that seat and responds as the ordinary path does. This works from the handoff
  screen too (no seat shown).
- `src/services/gameService.ts`: `makeMove(move, moveCount?, seat?)` and `sendAction(action, seat?)` put `seat` in the
  payload when given.
- `games/bingo/client/GameScreen.tsx`: `send` and `call` pass the seat on a shared device instead of calling
  `gameService.showSeat`.
- `docs/architecture.md`: the pass and play section says a move or action may name its seat.

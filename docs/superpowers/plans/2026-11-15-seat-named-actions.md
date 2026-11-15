# Seat-Named Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pass and play device's move or action names the seat it is for, so Bingo no longer sends `SHOW_SEAT` first.

**Architecture:** `handleLocalMessage` in `server/server.ts` takes `MAKE_MOVE` and `GAME_ACTION` that carry `payload.seat`, checks the seat against `localSeats`, and calls the manager for it. The client service gains an optional seat argument, and Bingo uses it.

**Tech Stack:** TypeScript, ws, React 19, Playwright.

**Spec:** docs/superpowers/specs/2026-11-15-seat-named-actions-design.md

## Global Constraints

- The refusal text is exactly `Not one of this device's players`.
- A message without `seat` behaves exactly as today, on every connection kind.
- Only Bingo's client changes.

## Review Focus

- A seat-named action sent while the device shows no seat (the handoff screen) is made, not refused with "Pass the device first".
- A seat-named action for a seat not on this device (another device's player, or junk like `"1"`) is refused, never made for the shown seat.
- After a seat-named action the device's shown seat follows the normal handoff, as after any state change.

---

### Task 1: Seat-named moves and actions

**Files:**
- Modify: `server/server.ts` (`handleLocalMessage`)
- Modify: `src/services/gameService.ts` (`makeMove`, `sendAction`)
- Modify: `games/bingo/client/GameScreen.tsx` (`send`, `call`, and the comment above `send`)
- Modify: `docs/architecture.md` (pass and play section, next to `SHOW_SEAT`)
- Test: `e2e/bingo.spec.ts`

**Interfaces:**
- Produces: `gameService.makeMove(move: unknown, moveCount?: number, seat?: Seat): void` and `gameService.sendAction(action: unknown, seat?: Seat): void`; `seat` goes in the payload only when given.

- [ ] **Step 1: Write the failing e2e test** in `e2e/bingo.spec.ts`, `a shared device's action names its seat`: seat a Bingo game with `agree: false`, then on a new page open a bare WebSocket (the pattern in `e2e/spectators.spec.ts` `protocol`) that joins with `role: 'passAndPlay'`, `playerNames: ['Ann', 'Bo']`. Agree to the house rules from the socket, patch both cards to `card(1)` and the pool so the first call is `1`. Without any `SHOW_SEAT`:
  - `MAKE_MOVE { move: { type: 'call' }, seat: <current player> }` is made: `called` becomes `[1]`.
  - `GAME_ACTION { action: { type: 'mark', card: 0, square: <square of 1> }, seat: 2 }` is made: `marks` equals `{ 1: [[]], 2: [[<square>]] }`.
  - `GAME_ACTION` with `seat: 9`, and with `seat: '2'`, each get `GAME_ERROR` `Not one of this device's players`, and `marks` is unchanged.
  - `GAME_ACTION` with no `seat` while no seat is shown still gets `Pass the device first`.
- [ ] **Step 2: Run it and see it fail**: `npx playwright test e2e/bingo.spec.ts -g "names its seat"`. Expected: FAIL (the seat-named action is refused with "Pass the device first").
- [ ] **Step 3: Server**: in `handleLocalMessage`, a `MAKE_MOVE` or `GAME_ACTION` whose `payload.seat` is not `undefined` is handled there and returns `true`; the seat is found in `localSeats` the same way `SHOW_SEAT` finds it (share that lookup rather than repeat it).
- [ ] **Step 4: Client**: add the `seat` parameters to `gameService`; in Bingo, `send` becomes `gameService.sendAction(action, shared ? seat : undefined)` and `call` passes `shared ? caller : undefined` as the seat; delete the `showSeat` calls and update the comment to say each send names its seat.
- [ ] **Step 5: Docs**: one sentence in `docs/architecture.md` beside the `SHOW_SEAT` block: a `MAKE_MOVE` or `GAME_ACTION` from a shared device may carry `seat`, one of the device's players, and is made for that seat without changing the shown seat.
- [ ] **Step 6: Verify**: `npx playwright test e2e/bingo.spec.ts e2e/passAndPlay.spec.ts`, `npm test`, `npm run lint`, `npm run typecheck`. Expected: all pass.
- [ ] **Step 7: Commit**: `git commit -m "A shared device's move or action names its seat, so Bingo needs no SHOW_SEAT first"`

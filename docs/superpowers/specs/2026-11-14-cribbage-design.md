# Cribbage

## Intent

Add Cribbage (`cribbage`, display name "Cribbage") as a new card game. The owner wants it as one more game on the site; no deeper driver.

## Goals, non-goals, anti-goals

- Goal: standard Cribbage for 2, 3 or 4 players (4 as two partnerships).
- Goal: automatic scoring with a visible breakdown, and traditional self-counting with Muggins as a house rule.
- Non-goal: manual pegging claims.
- Anti-goal: a phone prompt after every card played.

## Approaches

- A. The game counts everything. Simple, but no traditional option.
- B. Players count their own hands, with Muggins. Traditional, slow on phones.
- **C. Automatic by default, Muggins as a house rule (chosen by the owner).**

## Design

- **Players.** 2 (6 cards dealt, 2 to the crib), 3 (5 dealt, 1 to the crib, 1 from the deck to the crib), 4 in partnerships across the table (5 dealt, 1 to the crib). Crib rotates with the deal; a cut decides the first dealer. Use `shared/playingCards.ts`, `shared/hands.ts`, `shared/partnerships.ts`.
- **Play.** Standard deal, discard to crib, cut the starter (his heels: 2 to the dealer for a Jack), pegging to 31 with Go and last card, then show: non-dealers in order, dealer, crib.
- **Scoring.** Fifteens, pairs, runs, flush (4 in hand, 5 in crib needs the starter), his nobs; pegging fifteens, 31, pairs, runs, Go, last card. Every count shows a breakdown ("Fifteen two, fifteen four, and a pair is six").
- **House rules:**
  - Game length: 121 (default) or 61.
  - Muggins: off (default) or on.
- **Muggins on.** For hand and crib counts the owner of the hand enters a number. Opponents then get a short window to press Muggins! and take the missed points. An overclaim is corrected to the true total with no penalty. Pegging stays automatic.
- **Board.** A pegging track with two leapfrogging pegs per player or partnership; your hand; the current pegging cards and running total ("Count: 23"). Unplayable cards are greyed; Go appears when nothing is playable.
- **Undo.** The platform undo vote; `onUndo` reshuffles hidden cards, as other card games do.
- **Leaving.** A player who leaves a 2-player game loses. With 3 or 4, follow the pattern of the existing partnership and multi-player card games (Euchre, Spades, Hearts) where possible.
- **Docs.** README with Rules, Controls and "Differences from Wikipedia", plus a FAQ.

## Calls made by Claude (owner approved the summary)

2-4 players with partnerships at 4; 61-point option; no overclaim penalty; pegging always automatic; the board layout; leaving rules.

## Left to the builder

The Muggins window length, the board's visual design, and what leaving does at 3 or 4 players, chosen from the existing card games.

## Settled after the builder check (Claude's calls)

- **Muggins with several opponents.** At 3 players, the first opponent to press takes the points. At 4, the points go to the pressing player's partnership.
- **Nobody presses.** The owner keeps only what they claimed, the traditional rule, so a missed point is lost even without a Muggins press.

## Muggins style (owner's decision: a house rule)

Offered only when Muggins is on. Choices:

- **Name the points (default).** During the window opponents see only the hand and the claimed number. Pressing Muggins! opens the hand; the presser taps cards forming a missed combination (fifteen, pair, run, flush, nobs) and takes its points. A wrong selection is refused with no cost.
- **Single press.** One press takes the whole difference between the claim and the true total. A press when nothing was missed costs the presser 2 points.
- **Shown total.** The breakdown is shown during the window, and the first opponent to press takes the missed points.

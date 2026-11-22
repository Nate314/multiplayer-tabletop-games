# Tri-Tiles

## Intent

Add Tri-Tiles (`tritiles`, display name "Tri-Tiles"), a triangle-tile matching game in the style of Tri-Ominos, under a generic name. The owner wants it as one more game; no deeper driver.

## Goals, non-goals, anti-goals

- Goal: classic triangle-tile play and scoring, with the strategic bonuses on by default.
- Goal: the host can switch the bonuses off and pick the target score.
- Non-goal: any trademarked name, art or branding.
- Anti-goal: a board that cannot be used on a phone as it grows.

## Approaches

- A. Classic scoring only.
- B. Simple matching (tile sums, first out). Plays too much like Dominoes.
- **C. Classic by default, bonuses and target as house rules (chosen by the owner).**

## Design

- **Tiles.** The 56 tiles with corner numbers 0-5 (every combination with repetition, each once). A tile's corners read clockwise.
- **Players and deal.** 2 to 6 players. 9 tiles each with 2 players, 7 with 3 or 4, 6 with 5 or 6. The rest is a hidden pool.
- **Opening.** The highest triple held leads (5-5-5 first); without a triple, the highest sum.
- **Placement.** On a triangle grid; a tile must match every corner number it touches along shared edges and points.
- **Scoring (always on).** A placed tile scores its sum. Opening with a triple scores a bonus (classic: sum plus 10; 0-0-0 scores 40). Drawing costs 5 per tile, up to 3 draws a turn; still unable to play after 3 draws, the player passes and loses another 10.
- **House rules:**
  - Hexagon bonus (+50 for completing six tiles around a point): on (default) / off.
  - Bridge bonus (+40 for a tile matching an edge on one side and only a point on the opposite side): on (default) / off.
  - Target score: 200, 400 (default), 600.
- **Rounds.** Ends when a player goes out (+25 plus the sum left in every other hand) or is blocked (pool empty, nobody can play: the lowest hand scores the difference to each other hand). A scoring screen with Continue between rounds, as in Dominoes.
- **Controls.** As Dominoes: tap or drag a tile and every fitting spot lights up. Where a spot accepts the tile in more than one rotation, a Rotate button cycles the options before confirming. The board pans and zooms on a phone.
- **Undo and leaving.** As Dominoes: undo vote, `onUndo` reshuffles the pool, a dismissed player's tiles return to the pool.
- **Docs.** README with Rules, Controls and "Differences from Wikipedia", plus a FAQ.

## Calls made by Claude (owner approved the summary)

Deal sizes, 2-6 players, opening rule, blocked-round scoring, the rotate control, pan and zoom.

## Left to the builder

Triangle-grid coordinates and rendering, exact bonus detection, and test cases. Check the classic opening, bridge and hexagon values against Wikipedia's Triominoes article and record any difference in the README.

## Settled after the builder check (Claude's calls)

- **Game end.** The target is checked when a round ends, not mid-round. If several players pass it in the same round, the highest total wins; equal totals share the win.
- **Opening in later rounds.** The opening rule (highest triple, then highest sum) applies every round, so the triple bonus can come up in any round.

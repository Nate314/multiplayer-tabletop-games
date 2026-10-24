# Dominoes Layouts Design

## Intent

Dominoes today is a single line with two open ends. The user wants the branching layouts people play at home: playing in four directions from the starting double, doubles that open new branches, Chickenfoot and Mexican Train, picked as house rules and combinable.

## Goals

- Three layout house rules, freely combined, built on the house rules framework (that PR is the base of this one)
- A board that draws branches outward from the center
- Drag and drop of tiles onto open ends (moved here from the drag and drop PR)

## Non-goals

- Changing scoring, beyond making the target score a house rule (the house rules PR already does that)
- Other domino games (Fives, Bergen and so on)

## Anti-goals

- A layout that cannot be read on a phone
- Losing today's game: "no branches" must still play exactly as today

## House rules (decided)

1. **Doubles open branches:** none (today's single line), starter only (four directions from the starting double), or every double (each double opens new directions). Default: every double
2. **Chickenfoot:** on or off, default off. After a double is played, the next 3 tiles must go on that double, forming the foot, before anyone plays elsewhere
3. **Trains (Mexican Train):** on or off, default off. Each player owns one branch off the starter, plus a shared Mexican train. You may play only on your own train or the shared one. A player who cannot play leaves their train open (marked), and anyone can play on it until they play on it again
- Any combination is allowed, for example trains with every double branching, or Chickenfoot with starter only
- With Trains on, the starting double is always a hub with one train per player plus the shared Mexican train, whatever the branching setting; the branching setting then applies to doubles played later (my call)
- The default ("every double") changes today's default game on purpose; the user chose it. Existing e2e tests that assume the single line set "none" explicitly
- The double-six or double-nine set choice stays, now as a house rule in the same form

## Board and controls (decided)

- The board draws branches outward from the starting double in the center
- You drag a tile onto a highlighted open end, or click it and then click an open end
- Open ends a player may use are highlighted; an open train is marked

## Constraints

- Rules are validated on the server; the board's legal ends come from the rules, not the client
- When a combination's rules conflict (for example Chickenfoot's 3 tiles against a closed train), the builder picks the reading that a common published ruleset uses, and writes it in the README's Rules and "Differences from Wikipedia" sections
- Undo, rejoin, history, the History board and saved game files work with every layout
- Uses the shared drag logic from the drag and drop PR when combined. Builder: if this branch cannot see it yet, build the dominoes drag on a small local helper and switch to the shared one when the branches are combined
- Check at phone width and a wide width, light and dark mode
- Styles in SCSS, matching PR #21
- Tests: rules tests for each layout and for several combinations; e2e tests for each layout

## Left to the builder

- How the board lays out and scales long branches
- Hand sizes and the first lead with trains on (follow common Mexican Train rules and document them)

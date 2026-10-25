# Catan 5 and 6 Players Design

## Intent

The user's group plays Catan with the 5-6 player expansion. Add it, with the special build phase as an optional house rule, since they don't play with it.

## Goals

- 5 and 6 player Catan, on automatically when 5 or 6 players are seated
- The special build phase as a house rule, built on the house rules framework (that PR is the base of this one)

## Non-goals

- Other expansions (Seafarers, Cities and Knights)
- A larger board for 3 or 4 players

## Anti-goals

- Changing the 3 and 4 player game

## Expansion contents (decided)

- The 30-hex board with its extra harbors, as in the official 5-6 player extension
- 24 cards of each resource instead of 19
- 34 development cards instead of 25
- Six player colors

## Special build phase (decided)

- A house rule, off by default, offered only when 5 or more players are seated
- When on, after each player's turn every other player in turn order may build or buy a development card. They may not trade or play development cards during it
- It uses the out-of-turn move mechanism from the house rules framework, and the drag and drop piece tray works during a player's build chance (my call)

## When the branches are combined (my calls)

- The two new player colors get color-blind symbols (preferences PR) and tray styles (drag and drop PR)

## Player count

- `maxPlayers` becomes 6. The house rules override lets 2 players use the normal board (in the house rules PR)

## Constraints

- Board generation, harbors, the robber, longest road, largest army and every existing rule work on the larger board
- Hidden state stays hidden as today (`toPublicState`)
- The board fits a phone screen as today's board does
- Check at phone width and a wide width, light and dark mode
- Styles in SCSS, matching PR #21
- Tests: board tests for the 30-hex layout, rules tests for the special build phase, e2e tests for a 5 and a 6 player game
- The Catan README's Rules and "Differences from Wikipedia" sections and its FAQ are updated

## Left to the builder

- The exact hex, number and harbor layout (follow the official extension's setup)
- How the special build phase shows whose chance it is and how a player passes

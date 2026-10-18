# Ticket to Ride

Collect train cards, claim railway routes across the USA and connect your destination tickets, for 2 to 5 players.

## Rules

- **Components.** The original USA map: 36 cities joined by 100 tracks over 78 city pairs, 22 of them double routes, from 1 to 6 spaces long, gray or one of eight colors. 110 train cards (12 each of pink, white, blue, yellow, orange, black, red and green, and 14 locomotives) and the 30 destination tickets. Each player has 45 trains
- **Setup.** Everyone is dealt 4 train cards and 3 destination tickets, and 5 train cards are turned face up. In seat order, each player keeps at least 2 of their 3 tickets; the rest go under the ticket deck. Then the first seat takes the first turn and play goes up the seats
- **A turn** is one of:
  - **draw 2 train cards**, each from the face-up row or the top of the deck. A face-up locomotive is the whole draw, and a face-up locomotive cannot be taken as the second card. A locomotive from the deck counts as one card. A face-up card that is taken is replaced from the deck at once
  - **claim a route**: pay as many cards as it has spaces, all of its color (a gray route takes any one color), with locomotives standing in for any color, and place that many trains on it. You need enough trains left. A route does not have to connect to your others
  - **draw 3 destination tickets** and keep at least 1 of them; the others go under the ticket deck. Fewer are drawn when fewer are left
- **Face-up locomotives.** Whenever three of the five face-up cards are locomotives, all five are discarded and five more are turned up
- **Running out.** When the deck runs out, the discards are shuffled into a new deck. When there is neither a deck nor discards, cards can only be taken from the face-up row; with none there either, nobody can draw cards
- **Double routes.** With 4 or 5 players, two different players may each claim one track of a double route, but nobody can claim both. With 2 or 3 players only one track of each double route can be used: once one is claimed, the other is closed
- **Route points.** A route scores when it is claimed, by its length: 1, 2, 4, 7, 10 or 15 points for 1 to 6 spaces
- **End of the game.** When a player ends their turn with 2 trains or fewer, every player, that player included, gets one more turn. Then each completed destination ticket adds its points and each one not completed subtracts them, and the longest continuous path (a line of a player's own routes that may pass a city again but uses each route once) earns 10 points; players who tie for it all get the bonus
- **Winning.** Most points wins. A tie goes to the player who completed the most tickets, then to the longest path, and a tie on all three is shared
- **Hidden information.** Everyone sees the face-up cards, the claimed routes, every score and how many trains, train cards and tickets each player holds. Only you see your own train cards, your tickets and the tickets you are choosing from. Nobody sees the order of either deck, or which card someone drew from the deck. All tickets are shown in the final scoring
- **Leaving.** A dismissed player's routes stay claimed and keep blocking their double routes, but the player is dropped from the scoring. Their train cards go to the discards, their tickets leave the game, and any tickets they were choosing from go back under the deck. If it was their turn, a half-drawn turn or ticket choice is dropped and the next player starts a fresh turn. If theirs was the last turn of the final round, the game ends and is scored. The last player left wins
- Any player can ask to undo the last move. It is undone only if every player still in the game approves. Each card drawn, a ticket draw and the choice of which tickets to keep are moves of their own

## Controls

- Click a face-up card or the deck to take a card, twice per turn. Cards you cannot take now are dimmed
- Click a route on the map to pick it, then click a way to pay. When a route can be paid in more than one way (a gray route, or with locomotives instead), one button is shown per way; Cancel puts the route back. Routes you cannot claim say why
- Click the ticket deck to draw destination tickets. Tick the ones to keep and click Keep. Your first tickets are shown before your turn comes, and Keep works once it does
- Your hand shows your train cards grouped by color with their counts, and your tickets with a check mark on each one already completed by your routes. Point at a ticket to ring its two cities on the map
- The player list shows each player's points, trains left, train cards and tickets. The player whose turn it is is outlined, and in the last round each player still to play is marked
- Claimed routes show in their owner's color with white dots. A closed track of a double route is drawn faded. The route claimed in the last move is outlined
- When the game ends, the final scores below the map show route points, tickets made and missed, and the longest path for each player
- On a narrow window the map keeps a usable size and scrolls sideways
- Click Undo to ask everyone to undo the last move
- Click FAQ at the top of the page for a short guide to the rules and controls

## Differences from Wikipedia

The rules follow [Wikipedia](https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game)) and, where it is silent, the Days of Wonder rules for the original USA game. What remains different or was settled here:

- **The USA map and tickets.** Wikipedia gives no map data. The routes and tickets were entered from the published board and checked against two independent lists that agree track for track (see the comment at the top of `map.ts`). The map is this site's own drawing, with cities placed by longitude and latitude
- **Choosing the first tickets.** At a table everyone chooses at once. Here players choose one after another in seat order, as moves, so each choice can be undone and replayed in the history; a player can look at their offer before their turn
- **Who goes first.** The rules pick the most experienced traveler. Here the first seat goes first
- **Double routes after a dismissal.** Whether both tracks of a double route are open is set by the number of players when the game began, so the board does not change when someone leaves
- **Three face-up locomotives.** The rules do not say what happens when the cards left cannot give a row without three locomotives. Here the row is replaced at most 10 times in a row, and not at all when fewer than 3 cards that are not locomotives are left outside the hands
- **The second card.** When no card is left that could be a second card (nothing in the deck or discards and only locomotives face up), the turn ends after the first
- **Nothing to do.** Neither Wikipedia nor the rules cover a player who cannot draw a card, claim a route or draw tickets. Here that player passes, and if every player passes in a row the game ends and is scored
- **Payment.** The payment picker offers each color with as few locomotives as possible, and locomotives alone. Paying with more locomotives than needed while holding enough of the color is not offered
- **Leaving.** The rules do not cover a player leaving; see Leaving above. It follows Splendor: a dismissed player's hidden cards leave play and what they built stays on the board

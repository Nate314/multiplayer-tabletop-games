# Splendor

Collect gems, buy development cards and attract nobles to reach 15 prestige, for 2 to 4 players.

## Rules

- **Components.** Gem tokens in five colors (white diamond, blue sapphire, green emerald, red ruby and black onyx): 7 of each with 4 players, 5 with 3 and 4 with 2, plus 5 gold jokers. The 90 published development cards in three levels (40, 30 and 20), each with a bonus color, a prestige value and a cost. The 10 published nobles, each worth 3 prestige
- **Setup.** One noble more than the number of players is laid out, and four cards of each level are dealt face up beside that level's deck. The player in the first seat goes first, and play goes up the seats
- **A turn** is one of:
  - take 3 gems of different colors (when fewer than three colors are left in the supply, one of each color that is left)
  - take 2 gems of one color, only if at least 4 of that color are left before you take them
  - reserve a face-up card, or the top card of a level's deck without showing it, and take a gold if any is left. You may hold at most 3 reserved cards, and a reserved card can only leave your hand by being bought
  - buy a face-up card or one of your reserved cards
- **Buying.** Each card you own is a permanent bonus of its color and lowers the cost of later cards by one gem of that color. Gold pays for any missing gem. Spent tokens go back to the supply. A face-up card that is bought or reserved is replaced from its deck; when the deck is empty the space stays empty
- **10 tokens.** A player who ends their turn with more than 10 tokens, gold included, gives back tokens of their choice until they have 10
- **Nobles.** At the end of your turn, a noble whose cost your card bonuses meet visits you and is yours. Only one noble visits per turn; if several qualify you choose one, and the others may come on later turns. A visit cannot be refused
- **End of the game.** When a player reaches 15 prestige at the end of their turn, the round is finished so everyone has had the same number of turns. Then the most prestige wins; a tie goes to the player who bought the fewest development cards, then to the fewest reserved cards, and a tie on all three is shared
- **Hidden information.** Nobody sees the order of the decks. A card reserved from the top of a deck is shown to the others only as a card back of its level; its owner sees it
- **Leaving.** A dismissed player's tokens go back to the supply and their reserved cards leave the game; their bought cards and nobles stay on show and their turns are skipped. If it was their turn, the turn ends there, including any token return or noble choice they had left. If that turn was the last of the final round, the game ends. The last player left wins
- Any player can ask to undo the last move. It is undone only if every player still in the game approves. Giving back tokens and choosing a noble are moves of their own

## Controls

- On your turn, click gems in the supply to pick them, then click Take gems. Click one color twice to take two of it. Click a picked gem again to put it back
- Click a face-up card, then Buy or Reserve. Click a deck to reserve its top card. Click one of your own reserved cards to buy it
- Cards you can afford have a gold outline. The panel above the table says what a purchase would cost you after bonuses and gold
- When you hold more than 10 tokens, the panel lets you pick which tokens to give back, then click Return
- When several nobles qualify, click the one you want
- When you cannot take, reserve or buy anything, a Pass button appears
- Each player's panel shows their prestige, tokens, card bonuses by color, reserved cards and nobles. The player whose turn it is is outlined
- The last move is outlined: a reserved card among its player's reserved cards, and for a bought card the bonus it added. Pieces slide to where they went
- Click Undo to ask everyone to undo the last move
- Click FAQ at the top of the page for a short guide to the rules and controls

## Differences from Wikipedia

The rules follow [Wikipedia](https://en.wikipedia.org/wiki/Splendor_(game)). Where it is silent, the game follows the published rulebook. What remains different or was settled here:

- **Token counts by player count.** Wikipedia gives 7 of each color. As in the rulebook, 2 players use 4 of each and 3 players use 5
- **Taking three gems.** Wikipedia says "up to three" gems of different colors. Here a player takes exactly three, and fewer only when fewer than three colors are left in the supply
- **Who goes first.** Wikipedia does not say, and the rulebook picks the youngest player. Here the player in the first seat goes first
- **Paying.** The game pays for you: your colored gems first, and gold only for what you are short. At a table a player may spend gold while holding the colored gem; here they cannot
- **No legal action.** Neither Wikipedia nor the rulebook covers a player who can do nothing. Here that player passes
- **Leaving.** The rules do not cover a player leaving mid-game; see Leaving above
- **The card and noble lists** are not in Wikipedia. They were entered from three independent published lists that agree card for card (see the comment at the top of `cards.ts`)

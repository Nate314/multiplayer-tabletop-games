import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to six players. ' +
      'The game needs at least three, and nobody can join after the first move. Everyone rolls the dice and the highest ' +
      'total places first; players tied for highest roll again.'
  },
  {
    question: 'What changes with five or six players?',
    answer: 'The 5-6 player extension is played: a bigger island of 30 hexes with two deserts, 28 number tokens, 11 ' +
      'harbors, 24 cards of each resource in the bank and 34 development cards. White and green join the other ' +
      'colors. The island is chosen when the lobby resets, so it changes back if a player leaves before the first move.'
  },
  {
    question: 'What is the goal?',
    answer: 'Be the first to reach 10 points on your own turn. A settlement is 1 point, a city 2, each Victory Point card ' +
      '1, and the Longest Road and Largest Army cards 2 each.'
  },
  {
    question: 'How does setup work?',
    answer: 'Each player places a settlement and a road next to it, in turn order, then again in reverse order, so the ' +
      'first player places last. Click a highlighted intersection, then a highlighted path. Your second settlement gives ' +
      'you one card of each resource around it. No settlement may be next to another one, ever.'
  },
  {
    question: 'How does a turn go?',
    answer: 'Click Roll the dice. Every hex with the rolled number produces: each settlement on its corners takes one ' +
      'card and each city two, except on the hex with the robber. Then trade and build in any order, and click End turn. ' +
      'You may play one development card at any time in your turn, even before rolling.'
  },
  {
    question: 'What does building cost?',
    answer: 'Road: 1 wood and 1 brick. Settlement: 1 wood, 1 brick, 1 sheep and 1 wheat. City (upgrading a settlement): ' +
      '2 wheat and 3 ore. Development card: 1 sheep, 1 wheat and 1 ore. Each player has 15 roads, 5 settlements and 4 ' +
      'cities. A road must join your own road, settlement or city, and a new settlement must be next to one of your roads.'
  },
  {
    question: 'What happens on a 7?',
    answer: 'Nobody produces. Everyone holding more than 7 cards picks half of them, rounded down, to give back, in the ' +
      'Discard panel. Then the roller moves the robber to another hex and steals one random card from a player with a ' +
      'settlement or city there. Only the thief and the victim see which card it was.'
  },
  {
    question: 'How do I trade?',
    answer: 'On your turn, after rolling, trade with the bank in the turn panel: 4 of one resource for 1 of another, or ' +
      'better at a port where you have a settlement or city (3:1 at a 3:1 port, 2:1 for that port\'s resource). To trade ' +
      'with players, click Offer a trade, choose a player or Everyone, set what you give and what you want, and send it. ' +
      'The first player to accept makes the trade; you can withdraw it until then. Only the player whose turn it is can offer.'
  },
  {
    question: 'How do development cards work?',
    answer: 'Knight: move the robber and steal, without the discards. Road Building: place two free roads. Year of Plenty: ' +
      'take any two resources from the bank. Monopoly: every other player gives you all their cards of one resource. ' +
      'Victory Point: 1 point, kept secret until the game ends. You can play one card a turn, and not one you bought that turn.'
  },
  {
    question: 'How do Longest Road and Largest Army work?',
    answer: 'The first player with a single line of 5 roads takes Longest Road; another player takes it by building a ' +
      'longer one. Another player\'s settlement on your line breaks it. If a break leaves a tie for longest, the holder ' +
      'keeps the card if they are in the tie, and otherwise nobody holds it until the tie is broken. Largest Army goes to ' +
      'the first player to play 3 Knights, and moves only to a player who has played more.'
  },
  {
    question: 'What if the bank runs out?',
    answer: 'There are 19 cards of each resource. If the bank cannot give everyone the resource a roll owes them, nobody ' +
      'takes any of it that roll; if only one player is owed it, they take what is left.'
  },
  {
    question: 'What can other players see?',
    answer: 'Your resource cards and development cards are yours alone: others see how many you hold. Points shown for ' +
      'other players leave out their Victory Point cards until the game ends. The History dialog shows no hands.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A dismissed player\'s roads, settlements and cities stay on the board but score and produce nothing. Their ' +
      'cards go back to the bank, and any discard or trade waiting on them is dropped. If it was their turn, the next ' +
      'player\'s turn begins. With fewer than three players left, the game ends and the player with the most points wins.'
  },
  {
    question: 'Can we undo a move?',
    answer: 'Click Undo to ask everyone. The move is undone only if every player still in the game approves. Discards and ' +
      'trades are not moves, so an undo goes back past them too, and a roll played again may come up differently.'
  }
];

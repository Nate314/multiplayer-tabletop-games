import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to eight players. ' +
      'The game needs at least two, and nobody can join after the first move. Once two are seated everyone rolls the dice ' +
      'and the highest total goes first; players tied for highest roll again. Turns then go up through the seats.'
  },
  {
    question: 'What is the goal?',
    answer: 'Everyone starts on GO with $1500. Buy properties, charge rent, build houses and hotels, and be the last ' +
      'player left when everyone else is bankrupt.'
  },
  {
    question: 'How does a turn go?',
    answer: 'Click Roll the dice. Your token moves by the total and the space you land on takes effect at once: rent and ' +
      'taxes are paid for you, and a Chance or Community Chest card is drawn and shown in the middle of the board. Passing ' +
      'or landing on GO pays $200. Doubles roll again; three doubles in a row send you straight to Jail. When you are done ' +
      'building or mortgaging, click End turn.'
  },
  {
    question: 'How do buying and auctions work?',
    answer: 'Landing on a property the bank owns lets you buy it at its price, or decline. A declined property is ' +
      'auctioned to every player still in the game, you included. Bid with the quick buttons or type an amount; you can ' +
      'never bid more cash than you hold. A pass is final, and the last bidder left buys at their bid. If nobody bids, ' +
      'the bank keeps it.'
  },
  {
    question: 'How is rent worked out?',
    answer: 'A street charges the rent on its Title Deed, doubled while its owner has the whole color group and it has no ' +
      'houses (even if another street of the group is mortgaged). Houses and hotels raise it. Railroads charge $25, $50, ' +
      '$100 or $200 for one to four owned, and utilities 4 times the dice, or 10 times with both. Mortgaged property ' +
      'charges nothing. Click any property on the board, or a chip in the player list, to see its Title Deed.'
  },
  {
    question: 'How do I build?',
    answer: 'On your turn, with every street of a color group and none of it mortgaged, open a street\'s Title Deed and ' +
      'click Build house. Build evenly: a street may not get a second house before every street of the group has one. ' +
      'After four houses comes a hotel, which gives the four houses back to the bank. The bank has 32 houses and 12 ' +
      'hotels; when they run out nobody can build. Sell buildings back for half their cost, also evenly. A hotel sells ' +
      'back as four houses, or outright when the bank has fewer than four houses.'
  },
  {
    question: 'How do mortgages work?',
    answer: 'Open a property\'s Title Deed and click Mortgage to get its mortgage value, half its price. A street can ' +
      'only be mortgaged when its color group has no buildings. Lifting the mortgage costs the mortgage value plus 10%.'
  },
  {
    question: 'How does Jail work?',
    answer: 'You go to Jail by landing on Go to Jail, drawing a Go to Jail card, or rolling three doubles in a row, and ' +
      'you do not collect $200. At the start of your turn in Jail, pay $50, use a Get Out of Jail Free card, or roll for ' +
      'doubles. Doubles let you out and move you, without another roll. After a third failed roll you pay $50 and move by ' +
      'that roll. In Jail you still collect rent, build, trade and bid.'
  },
  {
    question: 'How do I trade?',
    answer: 'Click Propose a trade, choose a player, and tick what each side gives: properties (none in a color group ' +
      'with buildings), cash and Get Out of Jail Free cards. Any player may trade at any time, one offer at a time. ' +
      'Nothing moves until the other player clicks Accept. Whoever receives a mortgaged property chooses for each one: ' +
      'lift the mortgage now for its value plus 10%, or pay the 10% now and keep it mortgaged. An offer is refused if ' +
      'the receiver could not pay that 10%, and an offer from or to a player who disconnects is dropped.'
  },
  {
    question: 'What if I cannot pay?',
    answer: 'The game waits for you while you owe money: sell buildings, mortgage property or trade for cash, and the ' +
      'debt is paid as soon as you have enough. If you cannot raise it, click Declare bankruptcy. Bankrupt to a player, ' +
      'your buildings are sold to the bank at half price and that player takes your cash, properties and jail cards. ' +
      'Bankrupt to the bank, your properties are auctioned to the others. You may also declare bankruptcy on your turn to ' +
      'leave the game; your properties then go to auction.'
  },
  {
    question: 'Is there Free Parking money?',
    answer: 'No. As in the official rules, Free Parking is just a resting place, and taxes and fees go to the bank.'
  },
  {
    question: 'What do Undo and History do?',
    answer: 'Undo asks everyone to take back the last move; it happens only if every player still in the game approves. ' +
      'Bids, trades and their answers are not moves, so an undo goes back past them too, and a roll played again may ' +
      'come up differently. History, at the top of the page, steps through every move so far.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'A player who is dismissed is out as if bankrupt: to a player they owe money, who takes everything, ' +
      'or otherwise to the bank, and then their properties are auctioned to everyone ' +
      'left, and their open trade or debts are dropped. The last player left wins.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each token shows its color shape in place of its initial: red circle, blue square, green triangle, orange hexagon, purple cross, cyan pentagon. Tokens on the board and in the player list show it. The brown and slate tokens of the seventh and eighth players keep their initial.'
  }
];

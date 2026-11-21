import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Whodunit is for 3 to 6 players. Joining closes after the first move.'
  },
  {
    question: 'What is the goal?',
    answer: 'One suspect, one object and one room were set aside at the start: who did it, with what and where. The other cards are dealt out. Be the first to name all three in an accusation.'
  },
  {
    question: 'How does a turn work?',
    answer: 'Roll the dice, then move exactly the number rolled along the corridors, but you may enter a room early through its door. You cannot pass through another token or the same square twice. If the roll leads nowhere, you stay put. End your turn when you are done.'
  },
  {
    question: 'What are secret passages?',
    answer: 'Two pairs of corner rooms are joined by a secret passage. At the start of your turn in one of them you may use it instead of rolling, and you arrive in the other room.'
  },
  {
    question: 'How do I make a suggestion?',
    answer: 'When you enter a room, you may suggest a suspect and an object. The room is the one you are in. The suspect\'s token and the object move into that room. The other players, in turn order after you, are asked in turn: the first who holds one of the three cards shows you one of them.'
  },
  {
    question: 'Who sees the card that was shown?',
    answer: 'Only you and the player who showed it. Everyone else sees only who showed a card. If the player has just one of the three cards it is shown at once; with more, they choose which one. Your suggestions list names each card you saw or showed.'
  },
  {
    question: 'What if a suggestion moves my token?',
    answer: 'At the start of your next turn you may stay in that room and make a suggestion there without rolling.'
  },
  {
    question: 'How do I accuse?',
    answer: 'At the start of your turn or after moving, you may accuse by naming a suspect, an object and a room, and confirming. If all three are right you win. If not, you are out of turns, but you still show cards when asked. When only one player can still accuse, that player wins.'
  },
  {
    question: 'What is the notes sheet?',
    answer: 'Every card is listed with a mark: blank, yes, no or maybe. Only you see your notes, and they stay when you reload the page. Cards in your hand, and cards turned face up, are labeled.'
  },
  {
    question: 'What happens if a player leaves?',
    answer: 'Going back to the game list or losing the connection holds the seat, and the game waits for that player if they must show a card. Nothing is revealed. Only a player removed by a dismiss vote has their cards turned face up for everyone.'
  },
  {
    question: 'Can a move be undone?',
    answer: 'Yes, by a vote of every connected player, except right after a card was shown or an accusation was made. Notes taken after the undone move are undone with it.'
  }
];

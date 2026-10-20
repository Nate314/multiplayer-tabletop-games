import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'The Crew is cooperative: everyone wins or loses together. Play through the 50 missions of the logbook. Most missions give the crew tasks, and each task is a card that its owner must win in a trick. Completing mission 50 wins the game.'
  },
  {
    question: 'What is in the deck?',
    answer: 'Pink, blue, green and yellow cards from 1 to 9, and four rockets from 1 to 4: 40 cards, all dealt out. With three players one player gets an extra card, which is never played.'
  },
  {
    question: 'Who is the commander?',
    answer: 'Whoever holds the 4 rocket. The commander takes the first task, leads the first trick and makes the decisions some missions ask for.'
  },
  {
    question: 'How are tasks shared out?',
    answer: 'The mission\'s task cards are laid out, and starting with the commander and going left, each player takes one until none are left. Click a task to take it. Some missions let the commander decide who takes the tasks instead.'
  },
  {
    question: 'How do I play a trick?',
    answer: 'The commander leads the first trick and the winner of each trick leads the next. Follow the suit led if you can; otherwise play any card. Rockets are trump: the highest rocket wins, else the highest card of the suit led. Cards you may play are raised and outlined.'
  },
  {
    question: 'When is a task done?',
    answer: 'When its owner wins the trick that holds the task\'s card. If anyone else wins that card, the mission fails at once.'
  },
  {
    question: 'What do the order tokens mean?',
    answer: '1 to 5: the task must be the first, second and so on of all the tasks to be done. Arrows (>, >>, >>>, >>>>) only order the arrow tasks among themselves. Ω: the task must be done last. Tasks with consecutive tokens done in the same trick both count.'
  },
  {
    question: 'How do I communicate?',
    answer: 'Once per mission, between tricks (before the first trick too), click Communicate, pick a color card from your hand and say whether it is your highest, lowest or only card of that color. Only true statements are offered, and rockets cannot be communicated. Talking about your cards is not allowed; the site has no chat.'
  },
  {
    question: 'What are dead spots and disruptions?',
    answer: 'In a dead spot, your communicated card shows no token, so the others must guess what it means (it still has to be your highest, lowest or only card of its color). In a disruption nobody may communicate before the trick the mission names.'
  },
  {
    question: 'What is the distress signal?',
    answer: 'Before the first trick and before anyone communicates, the commander can send it after the crew agrees: everyone passes one card, never a rocket, to the left or to the right. It stays available for every retry of the mission, and the logbook counts one more attempt for the mission.'
  },
  {
    question: 'What happens after a mission?',
    answer: 'Everyone clicks Continue. After a success the next mission is dealt; after a failure the crew tries the same mission again and the attempt count goes up. Between missions anyone can vote to end the game; it ends when everyone connected votes yes, with the whole crew listed as winners.'
  },
  {
    question: 'Can we start at a later mission?',
    answer: 'Yes. Before the first move, any seated player can choose the starting mission, from 1 to 50.'
  },
  {
    question: 'What if a player leaves?',
    answer: 'A disconnected player keeps their seat and the game waits for them. If they are dismissed, the game ends, because the cards depend on the size of the crew.'
  },
  {
    question: 'Can I undo?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every connected player approves. A communication or a passed card is not a move; undoing the move before it takes it back too.'
  }
];

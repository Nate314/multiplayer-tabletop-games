import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How do I turn a shape?',
    answer: 'Tap it. Each tap turns it one eighth of a turn (45 degrees) clockwise. Shapes start turned at random, so most need a few taps before they fit. A round shape fits whichever way it faces.'
  },
  {
    question: 'How do I place a shape?',
    answer: 'Press a shape in the tray, drag it over its hole on your board and let go. It drops in only if it is the shape the hole was cut for and it is turned the right way up, or turned so it looks the same as the hole. With a keyboard, press Enter on a shape to pick it up, R to turn it, the arrow keys to choose a hole and Enter to drop it in. Escape puts it back.'
  },
  {
    question: 'What happens on a wrong drop?',
    answer: 'The shape springs back to the tray and nothing is sent, so a wrong drop costs only the time it took. The same happens if you let go off the board, or if the browser takes the drag away (for example when a phone call or a scroll gesture interrupts it).'
  },
  {
    question: 'How does the timer work?',
    answer: 'The host picks 30, 60 or 90 seconds in the house rules. The clock starts for everyone at once when the last player agrees to the house rules, and the server keeps the time, so a slow phone or connection does not change it. When it runs out the board pops: the shapes spring out and the race is over. A placement that reaches the server after the time is up does not count.'
  },
  {
    question: 'What are Keep racing and First finish?',
    answer: 'With two or more players the host picks how the race ends. Keep racing (the standard): the first to fill their board wins and everyone else keeps going until they finish or the board pops; places go by finish time, then by shapes placed. First finish: the race ends the moment anyone fills their board, and everyone else is ranked by shapes placed. If two players finish at the same moment on the server, they share the place.'
  },
  {
    question: 'Can I play alone?',
    answer: 'Yes. A solo race shows your time when you fill the board, and you win by filling it before the board pops.'
  },
  {
    question: 'Can I see how the others are doing?',
    answer: 'During the race you see only your own board, plus a bar for each other player with their count, such as Ana 12/16, and a check mark once they have finished. Spectators see every board side by side; the table screen shows a bar for every player.'
  }
];

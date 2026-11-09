import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to four ' +
      'players. The game needs at least two players, and nobody can join after the first move.'
  },
  {
    question: 'Who plays which color?',
    answer: 'There are four colors: Blue, Yellow, Red and Green, placed in that order. With four players each ' +
      'plays one color. With two players each plays two colors. With three players each plays one color and ' +
      'Green is shared: the players take turns placing it, and it scores for no one.'
  },
  {
    question: 'What are the two boards?',
    answer: 'The Board house rule picks Squares, a 20 by 20 grid with 21 pieces per color of 1 to 5 squares, or ' +
      'Triangles, a six-sided board of triangles with 22 pieces per color of 1 to 6 triangles.'
  },
  {
    question: 'Where can a piece go?',
    answer: 'Your first piece of a color must cover that color\'s starting corner on Squares, or one of the six ' +
      'starting points on Triangles; the dots on the board mark them. Every later piece must touch a piece of ' +
      'the same color at a corner, and must never touch one along a side. Touching other colors is fine.'
  },
  {
    question: 'How do I place a piece?',
    answer: 'On your turn, pick a piece from your tray. Turn left, Turn right and Flip change its orientation; ' +
      'on a keyboard Q and E turn it, F flips it and Escape puts it back. Outlined cells mark every place it ' +
      'can go. With a mouse, the piece shows under the pointer and a click places it. On a phone, the first tap ' +
      'shows the piece there and a second tap on it places it. Place also places the piece that is showing.'
  },
  {
    question: 'What if I cannot place anything?',
    answer: 'A color with no legal place for any of its pieces passes for the rest of the game, and its turns ' +
      'are skipped. The game ends when no color can place.'
  },
  {
    question: 'How is it scored?',
    answer: 'Each color loses one point for every square or triangle left in its unplayed pieces. A color that ' +
      'places all its pieces scores 15 instead, or 20 if its last piece was the single square or triangle. A ' +
      'player\'s score is the total of their colors, and the highest score wins. A tie for the top is a shared win.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks everyone to take back the last turn; it happens only if every player still in the game ' +
      'approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their pieces stay on the board and their colors stop placing. With three players the shared color ' +
      'keeps going round the players who are left.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and every placed cell also shows its color\'s shape: ' +
      'Blue square, Yellow star, Red circle, Green triangle.'
  }
];

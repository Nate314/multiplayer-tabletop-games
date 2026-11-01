import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How do I pick the picture?',
    answer: 'Before anyone moves a piece, the host clicks one of the 8 built-in pictures beside the table. Everyone sees the chosen picture in the lobby. Once the first piece is picked up, the picture is fixed for the game.'
  },
  {
    question: 'Can I use my own photo?',
    answer: 'Yes. The host presses Upload a photo and chooses a JPEG or PNG. It is made smaller before it is sent, and a photo of any shape is cropped from the middle to the puzzle\'s 3:2 shape. If it cannot be used, the reason is shown under the button.'
  },
  {
    question: 'What are Solo, Together and Race?',
    answer: 'Solo is one player with the whole puzzle. Together shares one table: everyone moves pieces at the same time and the puzzle is done when the last piece is placed. Race gives every player the same puzzle on their own table; you only see your own, plus everyone\'s percentage, and the first to finish wins. The host picks the mode and the number of pieces (24, 48, 96 or 150) in the house rules.'
  },
  {
    question: 'How do I place a piece?',
    answer: 'Press a piece, drag it and let go. Drop it close to its spot on the board and it snaps in and locks there; anywhere else it stays where you left it. Placed pieces cannot be moved again.'
  },
  {
    question: 'Why can I not pick up a piece?',
    answer: 'Someone else is holding it: it has their color around it and their name above it. You can take it once they let go. If you both press the same piece at the same moment, the first one to reach the server gets it and it slips out of the other\'s hand.'
  },
  {
    question: 'How does undo work?',
    answer: 'In Solo, Undo takes back your last placed piece, which goes back to where you picked it up. Loose pieces you moved after placing it go back too; loose moves from before it stay. In Together and Race, Undo my last move takes back only your own last placed piece, which comes loose just beside its spot; nobody else\'s pieces move.'
  },
  {
    question: 'The pieces are tiny on my phone. What can I do?',
    answer: 'Use Zoom in (up to 3 times) and scroll the table with a finger on an empty spot. Show picture guide draws the picture faintly on the board to help you find where pieces go.'
  }
];

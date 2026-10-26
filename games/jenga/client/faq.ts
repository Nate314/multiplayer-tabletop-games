import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Jenga is for 2 to 8 ' +
      'players, and nobody can join after the first block is grabbed. Players take turns in join order.'
  },
  {
    question: 'How do I pull a block?',
    answer: 'On your turn, press on a block and drag it out of the tower. A slow drag slides it gently, a fast one jerks it. ' +
      'Press on empty space to turn the tower, and scroll or pinch to zoom. With the keyboard, click the tower or tab to it, ' +
      'choose a block with the arrow keys, press Enter to grab it, then press Down to pull and Up to push it back; ' +
      'pressing the same way again pulls harder. Escape lets go.'
  },
  {
    question: 'Which blocks can I take?',
    answer: 'Any block below the top level. While the top level has fewer than 3 blocks, the level under it is off limits too. ' +
      'You may slide a block back in, let go and try another as often as you like during your turn.'
  },
  {
    question: 'Why will a block not slide?',
    answer: 'Each block has its own grip, from slick to sticky, and you cannot see it: you find out by pulling. A block with ' +
      'the tower\'s weight on it also holds tighter than one that is loose. If one will not budge, push it back and try another.'
  },
  {
    question: 'How do I place the block?',
    answer: 'Once the block is clear of the tower it is in your hand. When the tower has stopped moving, click Place on top, ' +
      'left, middle or right. A new level starts across the one below once the top level has 3 blocks. Placing the block ends your turn.'
  },
  {
    question: 'What counts as toppling the tower?',
    answer: 'Any block other than the one you are pulling dropping more than half a block height, or tipping more than 30 ' +
      'degrees, from where it was at the start of your turn. Whoever topples the tower loses, and everyone else wins.'
  },
  {
    question: 'What happens if I lose connection mid-pull?',
    answer: 'You let go of the block and the tower settles where it is. If it falls while settling, that still counts as your ' +
      'topple. Your turn waits for you to come back, with any block already in your hand still there.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Click Undo to ask everyone else to undo the last turn. If they all approve, the tower goes back to how it stood ' +
      'at the start of that turn, with nobody holding a block.'
  },
  {
    question: 'What if my device cannot draw the tower?',
    answer: 'You see "This device cannot draw the 3D tower" instead. The keyboard controls, the status line and the Place buttons still work.'
  }
];

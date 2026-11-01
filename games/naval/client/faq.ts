import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Naval Battle ' +
      'needs exactly two players, and nobody can join once a fleet is placed.'
  },
  {
    question: 'How do I place my fleet?',
    answer: 'Your fleet is one ship of each length: 5, 4, 3, 3 and 2. Drag a ship from the tray onto your grid, or ' +
      'tap a ship and then tap a square: its top or left end goes on that square. Ships lie across or down, stay ' +
      'inside the grid and cannot overlap, though they may touch. Tap a placed ship to pick it, then tap an empty ' +
      'square to move it there. Rotate turns the picked ship about its end, or turns the ships still in the tray. ' +
      'Random placement places the whole fleet for you, and Clear starts over. When every ship is placed, press ' +
      'Confirm fleet. A confirmed fleet cannot be changed, and the other player never sees it until the game is over.'
  },
  {
    question: 'How do I fire?',
    answer: 'Once both fleets are ready, the first player fires first, then you take turns. On your turn, tap a ' +
      'square on the Target grid that you have not fired at yet. A hit does not give you another shot.'
  },
  {
    question: 'What do hit and sunk tell me?',
    answer: 'A miss means no ship is on that square. A hit means one of the other fleet\'s ships is there. When ' +
      'your shot hits the last square of a ship, it is sunk, and you learn the ship\'s length: "sank a ship of ' +
      'length 3". Sink every ship in the other fleet to win.'
  },
  {
    question: 'Why are a sunk ship\'s squares not shown?',
    answer: 'You only learn what each of your own shots found, as you would across a pencil and paper grid. A sunk ' +
      'ship\'s length is named, but which of your hits belong to it is left for you to work out. Both fleets are ' +
      'shown in full once the game is over.'
  },
  {
    question: 'What is Salvo?',
    answer: 'Salvo is a house rule the host can turn on before the game starts. Each turn you fire one shot per ship ' +
      'you still have afloat, counted at the start of your turn, but never more than the squares you have not fired ' +
      'at. Tap squares on the Target grid to mark them, tap a marked square again to unmark it, and press Fire when ' +
      'you have marked them all. The result of each shot is shown.'
  },
  {
    question: 'How does undo work?',
    answer: 'Press Undo to ask to undo the last turn\'s shots. They are taken back only if the ' +
      'other player approves. Placing a fleet cannot be undone, and an undo never shows either fleet.'
  },
  {
    question: 'Can I resign or offer a draw?',
    answer: 'Yes, once a fleet is placed. Resign ends the game and the other player wins. Offer draw asks the other ' +
      'player, who can accept or decline; the offer lapses when they decline or fire. If a player disconnects, the game ' +
      'waits for them to rejoin. If they are dismissed, the other player wins.'
  }
];

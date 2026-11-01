import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to six ' +
      'players. Two, three, four or six can play, and nobody can join after the first move. Each player starts in ' +
      'one point of the star and sees it at the bottom of the board.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, the marbles you can move glow. Click one, and the holes it can reach are marked. Click a ' +
      'marked hole to move there. A step to an adjacent hole is sent at once. Click the picked marble again to let ' +
      'it go, or click another of your marbles to choose that one instead. The board is dimmed when it is not your ' +
      'turn.'
  },
  {
    question: 'How do chains of hops and End move work?',
    answer: 'A hop jumps one adjacent marble, yours or anyone\'s, into the empty hole straight beyond. After a hop, ' +
      'the holes the marble can hop to next are marked and a line shows the path so far. Click the next landing to ' +
      'keep going, or click End move to stop where the marble is. When no further hop is possible, the move is sent ' +
      'by itself. A chain may not land on the same hole twice or end where it began, and a step cannot follow a ' +
      'hop. Click the marble again to start the chain over.'
  },
  {
    question: 'Why did a player pass?',
    answer: 'A player whose marbles are all boxed in, with no step or hop anywhere, passes, and the status line says ' +
      'so. If nobody can move, the game ends and the players with the most marbles home win.'
  },
  {
    question: 'Someone left a marble in my target point. Can I still win?',
    answer: 'Yes. You win as soon as every hole of your target point is occupied and at least one of the marbles ' +
      'there is yours. Opponent marbles left there count toward filling it, so nobody can block you by staying put.'
  },
  {
    question: 'Why can five players not start?',
    answer: 'Every player races to the point opposite their own, and with five seated one player would have no ' +
      'opponent opposite. With five at the table the first move is refused until a player joins or leaves. A ' +
      'six-player game that drops to five after it starts plays on.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks everyone to take back the last move, a whole chain of hops at once. It happens only if every ' +
      'player still in the game approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their marbles are taken off the board and play goes on. The last player left wins.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: red circle, blue ' +
      'square, green triangle, yellow star, purple cross, orange hexagon. The marbles and the player list show it.'
  }
];

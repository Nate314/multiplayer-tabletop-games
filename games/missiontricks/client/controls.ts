import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the Starting mission list, Take and the order token picks via Table.tsx, Keep the
// tokens, Choose, Give to, Communicate, the distress signal, Hand over, the hand cards, Undo, Show the mission) and
// MissionSummary.tsx (Continue, Vote to end, Vote to play on, Close)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Choose the starting mission',
    pointer: 'Before the first move, choose the number in Starting mission.'
  },
  {
    action: 'Take a task',
    pointer: 'When it is your turn to take one, click or tap a task card that says Take.'
  },
  {
    action: 'Move or swap an order token',
    pointer: 'In a mission that lets you, click or tap the task whose token moves, then the task it goes to. ' +
      'Click or tap the first task again to unpick it. Or click or tap Keep the tokens.'
  },
  {
    action: 'Choose a player for the crew',
    pointer: 'When a mission asks the commander to decide, click or tap the Choose button with that player\'s name, ' +
      'or the Give to button when handing out a task.'
  },
  {
    action: 'Communicate',
    pointer: 'Between tricks, click or tap Communicate, then a color card in your hand, then the button that says what it is, ' +
      'such as that it is your highest card of its color. Click or tap Cancel to stop.'
  },
  {
    action: 'Send the distress signal',
    pointer: 'As the commander, before the first trick and before anyone communicates, click or tap Distress signal: pass left, ' +
      'or pass right. Then everyone clicks or taps a card, not a rocket, and Pass with that card.'
  },
  {
    action: 'Hand over a task',
    pointer: 'In a mission that lets you, on your turn before the first trick, choose the task in Task to hand over and the player in Hand it to, ' +
      'then click or tap Hand over.'
  },
  {
    action: 'Play a card',
    pointer: 'On your turn, click or tap a card in your hand. The cards you may play are raised and outlined.'
  },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next mission', pointer: 'Click or tap Continue on the mission result.' },
  {
    action: 'Vote on ending the game',
    pointer: 'On the mission result, click or tap Vote to end, or Vote to play on.'
  },
  {
    action: 'Show the mission result again',
    pointer: 'When the game is over, click or tap Close on the result, and Show the mission to open it again.'
  }
];

import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to Spinner.tsx (Spin), ChoicePanel.tsx (the route, fork, career and house buttons, road board only),
// CheckeredBoard.tsx (the highlighted squares), RoadBoard.tsx (the space titles) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  { action: 'Spin', pointer: 'On your turn, click or tap Spin. The spinner counts 1 to 10 on the road, and the teetotum 1 to 6 on the 1860 Checkered board.' },
  { action: 'Choose college or work', pointer: 'On the road, on your first turn, click or tap College or Straight to work.' },
  { action: 'Choose a road at the fork', pointer: 'On the road, when a spin reaches the fork, click or tap Safe road or Fast lane.' },
  { action: 'Choose a career', pointer: 'On the road, click or tap one of the careers offered, or the Keep button for your current career if it is there.' },
  { action: 'Buy a house', pointer: 'On the road, click or tap one of the houses offered, or No house.' },
  { action: 'Move on the 1860 Checkered board', pointer: 'After spinning, click or tap one of the highlighted squares to move there.' },
  { action: 'See what a space does', pointer: 'On the road, hover over a space with a mouse. The legend under the board names each color.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];

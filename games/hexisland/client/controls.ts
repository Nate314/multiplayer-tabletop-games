import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (clickVertex, clickEdge, clickHex, the piece tray and its drag), TurnPanel.tsx (Roll the dice,
// the Build buttons, Buy development card, Bank trade, Done building, End turn), DiscardPanel.tsx, TradePanel.tsx, HandPanel.tsx,
// Board.tsx (the keyboard handlers on intersections, paths and hexes) and src/drag/useDrag.ts (Escape drops a lifted piece)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Place a settlement or road in setup',
    pointer: 'Click or tap a highlighted intersection for the settlement, then a highlighted path for the road next to it.',
    keys: 'Tab to a highlighted intersection or path, then Enter or Space.'
  },
  { action: 'Roll the dice', pointer: 'On your turn, click or tap Roll the dice. You may play a development card first.' },
  {
    action: 'Discard cards after a 7',
    pointer: 'If you hold more than 7 cards, click or tap + and - to choose half of them, rounded down, then Discard.'
  },
  {
    action: 'Move the robber',
    pointer: 'Click or tap a highlighted hex. If more than one player can be robbed there, click or tap the name of the one to steal from.',
    keys: 'Tab to a hex, then Enter or Space.'
  },
  {
    action: 'Build a road, settlement or city',
    pointer: 'Click or tap Build road, Build settlement or Build city, then a highlighted path or intersection. Cancel drops your choice. Or drag the piece from your tray onto a highlighted spot, or tap the piece, then the spot.',
    keys: 'Tab to the Build button or the tray piece and press Enter or Space, then Tab to a highlighted spot and press Enter or Space. Escape drops a piece you are dragging.'
  },
  { action: 'Buy a development card', pointer: 'Click or tap Buy development card.' },
  {
    action: 'Play a development card',
    pointer: 'Click or tap Play beside the card, once a turn and not on the turn you bought it. For Year of Plenty and Monopoly, choose the resources first.'
  },
  { action: 'Trade with the bank', pointer: 'Choose the resource to give and the one to take, then click or tap Trade.' },
  {
    action: 'Offer a trade to other players',
    pointer: 'After rolling, click or tap Offer a trade to other players, choose a player or Everyone, set what you give and what you want with + and -, then click or tap Send offer. Cancel closes the form.'
  },
  { action: 'Answer or withdraw a trade offer', pointer: 'Click or tap Accept or Decline. The player who made the offer can click or tap Withdraw offer.' },
  { action: 'Finish a build chance', pointer: 'With the special build phase, click or tap Done building.' },
  { action: 'End your turn', pointer: 'Click or tap End turn.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];

import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to TurnPanel.tsx (Roll, jail, Buy, Decline, End turn, bankruptcy), AuctionPanel.tsx, PropertyPanel.tsx
// (the deed), TradePanel.tsx, MortgageChoice.tsx, Board.tsx and PlayerList.tsx (the property buttons) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  { action: 'Roll the dice', pointer: 'On your turn, click or tap Roll the dice. After doubles the button says Doubles: roll again.' },
  { action: 'Get out of jail', pointer: 'In Jail, click or tap Roll for doubles, Pay $50 or Use jail card.' },
  {
    action: 'Buy or pass on a property',
    pointer: 'When you land on a property the bank owns, click or tap Buy, or Decline. With auctions on, Decline becomes Decline and auction.'
  },
  {
    action: 'Bid in an auction',
    pointer: 'Click or tap a quick bid button (the high bid plus $1, $10 or $50), or type an amount in the Bid box and click or tap Bid. Click or tap Pass to drop out.'
  },
  {
    action: 'Look at a deed',
    pointer: 'Click or tap a property on the board, or its chip in the player list. Click or tap it again, or the × button on the deed, to close it.'
  },
  {
    action: 'Build or sell a building',
    pointer: 'On your turn, open a street\'s deed and click or tap Build house (Build hotel after four houses) or Sell building.'
  },
  { action: 'Mortgage a property', pointer: 'On your turn, open a property\'s deed and click or tap Mortgage, or Lift mortgage if it is mortgaged.' },
  {
    action: 'Propose a trade',
    pointer: 'At any time, click or tap Propose a trade, choose a player in With, tick the properties each side gives and type any cash or Jail passes, ' +
      'then click or tap Send offer. Cancel closes the form.'
  },
  { action: 'Answer a trade offer', pointer: 'When an offer is for you, click or tap Accept or Decline. Click or tap Withdraw offer to take back your own.' },
  {
    action: 'Lift mortgages you receive',
    pointer: 'When you receive mortgaged property, tick each mortgage to lift now, then click or tap the Pay button. Tick none to keep them all mortgaged.'
  },
  { action: 'End your turn', pointer: 'When you have no roll or purchase pending, click or tap End turn.' },
  { action: 'Declare bankruptcy', pointer: 'Click or tap Declare bankruptcy, then Confirm bankruptcy. Keep playing changes your mind.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' }
];

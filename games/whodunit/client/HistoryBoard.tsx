import Board from './Board';
import Hand from './Hand';
import SuggestionLog from './SuggestionLog';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The hotel right after one move, with the mover's square outlined, and the suggestions so far. Viewed as a player,
// their own hand and the cards they saw or showed appear; viewer null sees neither. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove, positions, suspectOf, hand, faceUp, playerNames } = gameState;
  // a show is made for the suggester, so their token is the one that just acted
  const mover = lastMove?.type === 'show' ? gameState.suggestions.at(-1)!.by : lastMove?.playerNumber;
  const highlight = mover !== undefined ? positions[suspectOf[mover]] ?? null : null;
  return (
    <div className="wd-layout">
      <div className="wd-board-area">
        <Board gameState={gameState} highlight={highlight} />
      </div>
      <div className="wd-side">
        {viewer !== null && <Hand cards={hand} label={`${playerNames[viewer]}'s cards`} />}
        {Object.entries(faceUp).filter(([, cards]) => cards.length > 0).map(([seat, cards]) => (
          <Hand key={seat} cards={cards} label={`${playerNames[Number(seat)]}'s cards, face up`} />
        ))}
        <SuggestionLog gameState={gameState} viewer={viewer} />
      </div>
    </div>
  );
}

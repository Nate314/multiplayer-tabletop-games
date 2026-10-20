import Tile from './Tile';
import { RACK_SIZE } from '../rules.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null;
  // Present on your turn: the piles and rack slots become buttons
  onDraw?: (from: 'deck' | 'discard') => void;
  onPlace?: (slot: number) => void;
  onDiscard?: () => void;
};

const SLOTS = Array.from({ length: RACK_SIZE }, (_, slot) => slot);

// The piles, the card in hand, your rack and everyone else's face-down racks. Used by the live screen and the history.
export default function Table({ gameState, viewer, onDraw, onPlace, onDiscard }: TableProps) {
  const { activePlayers, playerNames, scores, currentPlayer, drawCount, discardTop, discardCount, heldFrom, myHeld, myRack, lastMove } = gameState;
  const holding = heldFrom !== null;
  const lastSlot = lastMove?.type === 'place' ? lastMove.slot : null;
  const others = activePlayers.filter(seat => seat !== viewer);
  const mine = viewer !== null && activePlayers.includes(viewer);
  const canPlace = onPlace !== undefined && myHeld !== null;

  return (
    <div className="racko-table">
      <div className="piles">
        <div className="pile">
          <span className="pile-name">Draw pile</span>
          {drawCount > 0 || discardCount > 1
            ? <Tile label={`Draw pile, ${drawCount} cards`} onClick={onDraw && !holding ? () => onDraw('deck') : undefined} disabled={!onDraw || holding} />
            : <Tile label="Draw pile, empty" disabled />}
          <span className="pile-count">{drawCount} cards</span>
        </div>
        <div className="pile">
          <span className="pile-name">Discard pile</span>
          {discardTop === null
            ? <span className="tile tile-empty" aria-label="Discard pile, empty" />
            : <Tile card={discardTop} label={`Discard pile, top card ${discardTop}`} onClick={onDraw && !holding ? () => onDraw('discard') : undefined} disabled={!onDraw || holding} />}
          <span className="pile-count">{discardCount} cards</span>
        </div>
        {holding && (
          <div className="pile held" aria-label="The card in hand">
            <span className="pile-name">{myHeld !== null ? 'You hold' : `${playerNames[currentPlayer ?? 0] ?? 'A player'} holds`}</span>
            {myHeld !== null ? <Tile card={myHeld} label={`Your card ${myHeld}`} selected /> : <Tile label="A card from the draw pile" />}
            {onDiscard && myHeld !== null && heldFrom === 'deck' && <button type="button" className="discard-button" onClick={onDiscard}>Discard</button>}
          </div>
        )}
      </div>

      {mine && (
        <section className="rack my-rack" aria-label="Your rack">
          <header className="rack-header">{viewer !== null ? `${playerNames[viewer]}'s rack` : ''} ({scores[viewer] ?? 0} pts)</header>
          <div className="rack-slots">
            {SLOTS.map(slot => (
              <div key={slot} className={slot === lastSlot && lastMove?.playerNumber === viewer ? 'slot slot-last' : 'slot'}>
                <span className="slot-number">{slot + 1}</span>
                {myRack[slot] === undefined
                  ? <span className="tile tile-empty" />
                  : canPlace
                    ? <Tile card={myRack[slot]} label={`Place in slot ${slot + 1}, replacing ${myRack[slot]}`} onClick={() => onPlace(slot)} />
                    : <Tile card={myRack[slot]} label={`Slot ${slot + 1}, card ${myRack[slot]}`} />}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="other-racks">
        {others.map(seat => (
          <section
            key={seat}
            className={seat === currentPlayer ? 'rack other-rack rack-turn' : 'rack other-rack'}
            aria-label={`${playerNames[seat]}'s rack`}
          >
            <header className="rack-header">{playerNames[seat]} ({scores[seat] ?? 0} pts)</header>
            <div className="rack-slots">
              {SLOTS.map(slot => (
                <div key={slot} className={slot === lastSlot && lastMove?.playerNumber === seat ? 'slot slot-last' : 'slot'}>
                  <Tile small />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

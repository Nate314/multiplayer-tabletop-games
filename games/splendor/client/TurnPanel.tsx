import { useState } from 'react';
import { GemToken, NobleView } from './pieces';
import { canBuy, canReserve, gemMove, selectedCard } from './selection.ts';
import { CARDS } from '../cards.ts';
import { TOKENS, canAct, emptyTokens, listTokens, payment, tokenTotal } from '../rules.ts';
import type { Selection } from './selection.ts';
import type { Move, PublicGameState, Seat, Token, Tokens } from '../types.ts';

type TurnPanelProps = {
  gameState: PublicGameState;
  seat: Seat;
  selection: Selection | null;
  onMove: (move: Move) => void;
  onClear: () => void;
};

// Choosing which tokens to give back, one click at a time
function ReturnTokens({ gameState, seat, count, onMove }: { gameState: PublicGameState; seat: Seat; count: number; onMove: (move: Move) => void }) {
  const [chosen, setChosen] = useState<Tokens>(emptyTokens);
  const held = gameState.players[seat].tokens;
  const total = tokenTotal(chosen);
  const change = (token: Token, by: number) => setChosen(previous => ({ ...previous, [token]: previous[token] + by }));

  return (
    <div className="turn-panel">
      <p className="turn-panel-title">You have {tokenTotal(held)} tokens. Return {count} to get back to 10.</p>
      <div className="return-tokens">
        {TOKENS.filter(token => held[token] > 0).map(token => (
          <div key={token} className="return-token">
            <GemToken token={token} count={held[token] - chosen[token]} />
            <button type="button" aria-label={`Return one ${token}`} onClick={() => change(token, 1)} disabled={chosen[token] >= held[token] || total >= count}>
              Return 1
            </button>
            <button type="button" aria-label={`Keep one ${token}`} onClick={() => change(token, -1)} disabled={chosen[token] === 0}>
              Keep
            </button>
            {chosen[token] > 0 && <span className="return-count">-{chosen[token]}</span>}
          </div>
        ))}
      </div>
      <button type="button" className="primary-action" onClick={() => onMove({ type: 'returnTokens', tokens: chosen })} disabled={total !== count}>
        Return {listTokens(chosen)}
      </button>
    </div>
  );
}

// What the player can do now: finish a pending step, or confirm what they picked on the table
export default function TurnPanel({ gameState, seat, selection, onMove, onClear }: TurnPanelProps) {
  const { pending, players } = gameState;
  const player = players[seat];

  if (pending?.kind === 'returnTokens') {
    // Keyed by the move count, so an undo or a new return starts from nothing chosen
    return <ReturnTokens key={gameState.moveCount} gameState={gameState} seat={seat} count={pending.count} onMove={onMove} />;
  }
  if (pending?.kind === 'chooseNoble') {
    return (
      <div className="turn-panel">
        <p className="turn-panel-title">Several nobles want to visit. Choose one; the others may visit on a later turn.</p>
        <div className="noble-choice">
          {pending.nobles.map(noble => <NobleView key={noble} noble={noble} onClick={() => onMove({ type: 'chooseNoble', noble })} />)}
        </div>
      </div>
    );
  }

  if (!canAct(gameState, player)) {
    return (
      <div className="turn-panel">
        <p className="turn-panel-title">You cannot take, reserve or buy anything.</p>
        <button type="button" className="primary-action" onClick={() => onMove({ type: 'pass' })}>Pass</button>
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="turn-panel">
        <p className="turn-panel-title">
          Pick gems from the supply, or a card or deck to buy or reserve.
        </p>
      </div>
    );
  }

  if (selection.kind === 'gems') {
    const move = gemMove(selection.colors, gameState);
    const two = selection.colors.length === 2 && selection.colors[0] === selection.colors[1];
    return (
      <div className="turn-panel">
        <p className="turn-panel-title">
          {two ? `Take 2 ${selection.colors[0]}` : `Take ${selection.colors.join(', ')}`}
          {!move && ' (pick three different colors, or click a color twice for two)'}
        </p>
        <div className="turn-actions">
          <button type="button" className="primary-action" onClick={() => move && onMove(move)} disabled={!move}>Take gems</button>
          <button type="button" onClick={onClear}>Cancel</button>
        </div>
      </div>
    );
  }

  if (selection.kind === 'deck') {
    return (
      <div className="turn-panel">
        <p className="turn-panel-title">Reserve the top level {selection.level} card unseen{gameState.supply.gold > 0 ? ' and take a gold' : ''}.</p>
        <div className="turn-actions">
          <button type="button" className="primary-action" disabled={!canReserve(gameState, seat)}
            onClick={() => onMove({ type: 'reserve', source: { kind: 'deck', level: selection.level } })}>
            Reserve
          </button>
          <button type="button" onClick={onClear}>Cancel</button>
        </div>
        {!canReserve(gameState, seat) && <p className="turn-panel-note">You already have 3 reserved cards.</p>}
      </div>
    );
  }

  const card = selectedCard(selection, gameState, seat);
  const { source } = selection;
  const paid = card === null ? null : payment(player, CARDS[card]);
  return (
    <div className="turn-panel">
      <p className="turn-panel-title">
        {paid ? `Buying pays ${listTokens(paid)}.` : 'You cannot afford this card yet.'}
      </p>
      <div className="turn-actions">
        <button type="button" className="primary-action" disabled={!canBuy(gameState, seat, card)} onClick={() => onMove({ type: 'buy', source })}>
          Buy
        </button>
        {source.kind === 'market' && (
          <button type="button" disabled={!canReserve(gameState, seat)} onClick={() => onMove({ type: 'reserve', source })}>
            Reserve{gameState.supply.gold > 0 ? ' and take a gold' : ''}
          </button>
        )}
        <button type="button" onClick={onClear}>Cancel</button>
      </div>
    </div>
  );
}

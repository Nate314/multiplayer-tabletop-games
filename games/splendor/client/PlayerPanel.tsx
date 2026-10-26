import YouTag from '../../../src/components/YouTag.tsx';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { CardView, GemToken, NobleView } from './pieces';
import { bonusKey, nobleKey, reservedKey, tokenKey } from './animateMove.ts';
import { canBuy } from './selection.ts';
import { CARDS, GEMS } from '../cards.ts';
import { TOKENS, bonuses, prestige, tokenTotal } from '../rules.ts';
import type { Selection } from './selection.ts';
import type { PublicGameState, Seat } from '../types.ts';

type PlayerPanelProps = {
  gameState: PublicGameState;
  seat: Seat;
  isMe: boolean;
  selection: Selection | null;
  onReserved?: (index: number) => void;  // only for the viewer's own cards on their turn
};

// One player's prestige, tokens, card bonuses, reserved cards and nobles
export default function PlayerPanel({ gameState, seat, isMe, selection, onReserved }: PlayerPanelProps) {
  const { players, playerNames, currentPlayer, activePlayers, winners, lastMove } = gameState;
  const player = players[seat];
  const owned = bonuses(player);
  const classes = ['player'];
  if (isMe) classes.push('player-me');
  else classes.push('hand-only-hide');
  if (currentPlayer === seat) classes.push('player-current');
  if (!activePlayers.includes(seat)) classes.push('player-left');
  if (winners.includes(seat)) classes.push('player-winner');
  if (lastMove?.seat === seat) classes.push('player-last');
  const status = !activePlayers.includes(seat) ? ' (left)' : winners.includes(seat) ? ' (winner)' : '';
  // The last move's card has left the market: a reserved one is the newest reserved card, a bought one its bonus
  const mine = lastMove?.seat === seat ? lastMove : null;
  const boughtBonus = mine?.type === 'buy' ? CARDS[mine.card].bonus : null;
  const reservedLast = mine?.type === 'reserve' ? player.reserved.length - 1 : -1;

  return (
    <section className={classes.join(' ')} aria-label={playerNames[seat]}>
      <header className="player-header">
        <span className="player-name">{playerNames[seat]}<YouTag when={isMe} />{status}</span>
        <span className="player-prestige" title="Prestige">{prestige(player)} prestige</span>
      </header>
      <div className="player-row">
        <span className="player-row-label">Gems {tokenTotal(player.tokens)}/10</span>
        <span className="player-tokens">
          {TOKENS.map(token => <GemToken key={token} token={token} count={player.tokens[token]} animKey={tokenKey(seat, token)} />)}
        </span>
      </div>
      <div className="player-row">
        <span className="player-row-label">Cards {player.cards.length}</span>
        <span className="player-bonuses">
          {GEMS.map(gem => (
            <span key={gem} className={`bonus gem-${gem}${gem === boughtBonus ? ' bonus-highlighted' : ''}`} data-anim-key={bonusKey(seat, gem)} title={`${owned[gem]} ${gem} bonus`}>
              <ColorSymbol color={gem} />{owned[gem]}
            </span>
          ))}
        </span>
      </div>
      {(player.reserved.length > 0 || player.nobles.length > 0) && (
        <div className="player-extras">
          {player.reserved.length > 0 && (
            <div className="reserved" aria-label="Reserved cards">
              {player.reserved.map((held, index) => {
                const clickable = onReserved && held.card !== null;
                return (
                  <CardView
                    key={reservedKey(seat, index, held)}
                    card={held.card}
                    level={held.level}
                    animKey={reservedKey(seat, index, held)}
                    selected={selection?.kind === 'card' && selection.source.kind === 'reserved' && selection.source.index === index}
                    highlighted={index === reservedLast}
                    affordable={isMe && !gameState.isGameOver && canBuy(gameState, seat, held.card)}
                    onClick={clickable ? () => onReserved(index) : undefined}
                  />
                );
              })}
            </div>
          )}
          {player.nobles.length > 0 && (
            <div className="player-nobles" aria-label="Nobles">
              {player.nobles.map(noble => <NobleView key={noble} noble={noble} animKey={nobleKey(noble)} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

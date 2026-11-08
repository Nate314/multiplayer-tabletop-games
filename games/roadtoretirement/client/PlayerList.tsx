import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOL_COLORS } from '../../../src/components/seatColors.ts';
import YouTag from '../../../src/components/YouTag.tsx';
import { pointsText } from '../../../shared/standings.ts';
import { plural } from '../../../shared/text.ts';
import { careerOf, houseOf } from '../content.ts';
import { money } from '../roadRules.ts';
import type { PublicGameState, RoadPlayer, Seat } from '../types.ts';

function roadDetails(player: RoadPlayer): string[] {
  const career = player.career ? careerOf(player.career)! : null;
  const family = [player.partner ? 'partner' : '', player.children > 0 ? plural(player.children, 'child', 'children') : ''].filter(Boolean);
  return [
    player.retired ? `retired with ${money(player.worth!)}` : `${money(player.cash)} cash`,
    player.loans > 0 ? plural(player.loans, 'loan') : '',
    career ? `${career.name}, ${money(career.salary)}` : 'no career yet',
    player.degree ? 'degree' : '',
    ...player.houses.map(id => houseOf(id)!.name),
    family.join(' and ')
  ].filter(Boolean);
}

// Every player's money, career, houses and family on the road, or points on the 1860 board, in seat order
export default function PlayerList({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, activePlayers, currentPlayer, winners, road, checkered } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <section className="panel player-list" aria-label="Players">
      <div className="panel-title">Players</div>
      {seats.map(seat => {
        const roadPlayer = road?.players[seat];
        const points = checkered?.points[seat];
        const left = !activePlayers.includes(seat);
        const classNames = ['player-row'];
        if (seat === currentPlayer) classNames.push('player-current');
        if (left) classNames.push('player-left');
        let status = '';
        if (winners.includes(seat)) status = 'winner';
        else if (left) status = 'left';
        else if (checkered?.skipNext.includes(seat)) status = 'loses next turn';
        const details = roadPlayer ? roadDetails(roadPlayer) : points === undefined ? [] : [pointsText(points)];
        return (
          <div key={seat} className={classNames.join(' ')} data-seat={seat}>
            <div className="player-line">
              <span className={`player-dot seat${seat}`} aria-hidden="true"><ColorSymbol color={SEAT_SYMBOL_COLORS[seat]} className="dot-symbol" /></span>
              <span className="player-name">
                {playerNames[seat]}
                <YouTag when={seat === viewer} />
              </span>
              {status && <span className="player-status">{status}</span>}
            </div>
            {details.length > 0 && <div className="player-details">{details.join(', ')}</div>}
          </div>
        );
      })}
    </section>
  );
}

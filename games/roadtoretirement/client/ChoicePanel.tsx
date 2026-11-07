import { careerOf, houseOf } from '../content.ts';
import { COLLEGE_COST, money } from '../roadRules.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

type Props = { gameState: PublicGameState; playerNumber: Seat; onMove: (move: Move) => void };

// The choice the road waits on, for the player on turn: route, fork, career or house
export default function ChoicePanel({ gameState, playerNumber, onMove }: Props) {
  const road = gameState.road;
  const player = road?.players[playerNumber];
  if (!road || !player) return null;
  const choice = (label: string, move: Move) => <button key={label} type="button" className="primary" onClick={() => onMove(move)}>{label}</button>;
  const current = player.career ? careerOf(player.career)!.name : null;

  switch (road.phase) {
    case 'route':
      return (
        <section className="panel choice-panel" aria-label="Choose a route">
          <div className="panel-title">College costs {money(COLLEGE_COST)} and leads to better careers</div>
          <div className="choice-buttons">
            {choice('College', { type: 'route', choice: 'college' })}
            {choice('Straight to work', { type: 'route', choice: 'work' })}
          </div>
        </section>
      );
    case 'fork':
      return (
        <section className="panel choice-panel" aria-label="Choose a road">
          <div className="panel-title">The road forks: the fast lane is shorter and full of risk</div>
          <div className="choice-buttons">
            {choice('Safe road', { type: 'fork', road: 'safe' })}
            {choice('Fast lane', { type: 'fork', road: 'fast' })}
          </div>
        </section>
      );
    case 'career':
      return (
        <section className="panel choice-panel" aria-label="Choose a career">
          <div className="panel-title">Choose a career</div>
          <div className="choice-buttons">
            {road.offer.map(id => {
              const career = careerOf(id)!;
              return choice(`${career.name}, ${money(career.salary)}`, { type: 'career', pick: id });
            })}
            {current && choice(`Keep ${current}`, { type: 'career', pick: null })}
          </div>
        </section>
      );
    case 'house':
      return (
        <section className="panel choice-panel" aria-label="Choose a house">
          <div className="panel-title">Buy a house? It sells at retirement</div>
          <div className="choice-buttons">
            {road.offer.map(id => {
              const house = houseOf(id)!;
              return choice(`${house.name}, ${money(house.price)}`, { type: 'buyHouse', pick: id });
            })}
            {choice('No house', { type: 'buyHouse', pick: null })}
          </div>
        </section>
      );
    default:
      return null;
  }
}

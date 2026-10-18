import { useState } from 'react';
import { MAX_ATTACK_DICE } from '../battle.ts';
import { MUST_TRADE_AT } from '../cards.ts';
import { territoryName } from '../map.ts';
import type { Move, Placements, PublicGameState, Seat } from '../types.ts';

export const PLACE_STEPS = [1, 5, 'all'] as const;
export type PlaceStep = typeof PLACE_STEPS[number];

type PhasePanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canMove: boolean; // it is this player's move and no vote is running
  source: string | null;
  target: string | null;
  draft: Placements;
  placeStep: PlaceStep;
  onPlaceStep: (step: PlaceStep) => void;
  onUnplace: (territory: string) => void;
  onClearDraft: () => void;
  onClearSelection: () => void;
  onMove: (move: Move) => void;
};

const WAITING: Record<PublicGameState['phase'], string> = {
  setup: 'to place their starting armies',
  reinforce: 'to place reinforcements',
  attack: 'to attack',
  conquer: 'to move into a captured territory',
  fortify: 'to fortify'
};

// A number between `min` and `max` picked with a slider, shown beside it
function ArmySlider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="army-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} disabled={min === max} onChange={event => onChange(Number(event.target.value))} />
      <output>{value}</output>
    </label>
  );
}

// What the player can do in the current phase: place armies, attack with dice or blitz, move into a capture, fortify, end the turn
export default function PhasePanel(props: PhasePanelProps) {
  const { gameState, playerNumber, canMove, source, target, draft, placeStep, onPlaceStep, onUnplace, onClearDraft, onClearSelection, onMove } = props;
  const { phase, armies, currentPlayer, playerNames, isGameOver, conquest, reinforcements, setupLeft, hand, midTurnTrade } = gameState;
  const [dice, setDice] = useState(MAX_ATTACK_DICE);
  const [moveCount, setMoveCount] = useState<{ key: string; value: number } | null>(null);
  if (isGameOver || currentPlayer === null || gameState.firstPlayer === null) return null;
  if (!canMove) {
    return (
      <section className="panel phase-panel" aria-label="Turn">
        <div className="turn-waiting">Waiting for {playerNames[currentPlayer]} {WAITING[phase]}</div>
      </section>
    );
  }

  // The slider remembers its value only for the same from and to, so a new choice starts at its default
  const sliderFor = (key: string, fallback: number) => (moveCount?.key === key ? moveCount.value : fallback);
  const setSlider = (key: string) => (value: number) => setMoveCount({ key, value });
  let title = '';
  let body;

  if (phase === 'setup' || phase === 'reinforce') {
    const total = phase === 'setup' ? setupLeft[playerNumber] ?? 0 : reinforcements;
    const drafted = Object.values(draft).reduce((sum, count) => sum + count, 0);
    const blocked = phase === 'reinforce' && (hand?.length ?? 0) >= MUST_TRADE_AT;
    title = phase === 'setup' ? 'Place your starting armies' : midTurnTrade ? 'Trade the cards you took' : 'Reinforce';
    const entries = Object.entries(draft);
    body = blocked ? (
      <p className="note">You hold {hand?.length} cards: trade a set below before placing.</p>
    ) : (
      <>
        <div className="armies-left"><strong>{total - drafted}</strong> of {total} armies left to place</div>
        <div className="step-row" role="group" aria-label="Armies per click">
          <span>Each click adds</span>
          {PLACE_STEPS.map(step => (
            <button key={step} type="button" className={step === placeStep ? 'toggle toggle-on' : 'toggle'} aria-pressed={step === placeStep}
              onClick={() => onPlaceStep(step)}>{step === 'all' ? 'All' : step}</button>
          ))}
        </div>
        {entries.length === 0 ? <p className="note">Click your territories on the map to place armies.</p> : (
          <ul className="draft-list">
            {entries.map(([territory, count]) => (
              <li key={territory}>
                <span>{count} on {territoryName(territory)}</span>
                <button type="button" className="small" onClick={() => onUnplace(territory)} aria-label={`Take one back from ${territoryName(territory)}`}>-1</button>
              </li>
            ))}
          </ul>
        )}
        <div className="button-row">
          <button type="button" className="primary" disabled={phase === 'setup' ? drafted !== total : drafted === 0}
            onClick={() => onMove({ type: 'place', placements: draft })}>
            {phase === 'setup' ? 'Place all' : drafted === total ? 'Place and attack' : 'Place'}
          </button>
          <button type="button" onClick={onClearDraft} disabled={drafted === 0}>Clear</button>
        </div>
        {phase === 'reinforce' && (hand?.length ?? 0) >= 3 && !midTurnTrade && <p className="note">Trade cards before you place your last army.</p>}
      </>
    );
  } else if (phase === 'attack') {
    title = 'Attack';
    const most = source ? Math.min(MAX_ATTACK_DICE, armies[source] - 1) : MAX_ATTACK_DICE;
    const chosen = Math.min(dice, most);
    body = (
      <>
        <p className="note">
          {!source ? 'Click one of your territories with 2 or more armies to attack from.'
            : !target ? `From ${territoryName(source)} (${armies[source]}): click a highlighted enemy territory.`
              : `${territoryName(source)} (${armies[source]}) attacks ${territoryName(target)} (${armies[target]}).`}
        </p>
        {source && target && (
          <>
            <div className="step-row" role="group" aria-label="Dice">
              <span>Dice</span>
              {Array.from({ length: most }, (_, index) => index + 1).map(count => (
                <button key={count} type="button" className={count === chosen ? 'toggle toggle-on' : 'toggle'} aria-pressed={count === chosen}
                  onClick={() => setDice(count)}>{count}</button>
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => onMove({ type: 'attack', from: source, to: target, dice: chosen })}>
                Roll {chosen} {chosen === 1 ? 'die' : 'dice'}
              </button>
              <button type="button" onClick={() => onMove({ type: 'blitz', from: source, to: target })}
                title="Attack with the most dice until the territory falls or 1 army is left">Blitz</button>
            </div>
          </>
        )}
        <div className="button-row">
          {source && <button type="button" onClick={onClearSelection}>Clear choice</button>}
          <button type="button" onClick={() => onMove({ type: 'endAttack' })}>Stop attacking and fortify</button>
          <button type="button" onClick={() => onMove({ type: 'endTurn' })}>End turn</button>
        </div>
      </>
    );
  } else if (phase === 'conquer' && conquest) {
    title = `Move into ${territoryName(conquest.to)}`;
    const most = armies[conquest.from] - 1;
    const key = `${conquest.from}-${conquest.to}`;
    const value = Math.min(most, Math.max(conquest.minimum, sliderFor(key, most)));
    body = (
      <>
        <ArmySlider label="Armies to move" min={conquest.minimum} max={most} value={value} onChange={setSlider(key)} />
        <p className="note">At least {conquest.minimum}, the dice you rolled; {armies[conquest.from] - value} stay in {territoryName(conquest.from)}.</p>
        <div className="button-row">
          <button type="button" className="primary" onClick={() => onMove({ type: 'occupy', armies: value })}>Move {value}</button>
        </div>
      </>
    );
  } else if (phase === 'fortify') {
    title = 'Fortify';
    const key = `${source}-${target}`;
    const most = source ? armies[source] - 1 : 1;
    const value = Math.min(most, Math.max(1, sliderFor(key, most)));
    body = (
      <>
        <p className="note">
          {!source ? 'Optionally move armies once: click a territory of yours to move from.'
            : !target ? `From ${territoryName(source)}: click a highlighted territory connected through yours.`
              : `Move from ${territoryName(source)} to ${territoryName(target)}.`}
        </p>
        {source && target && (
          <>
            <ArmySlider label="Armies to move" min={1} max={most} value={value} onChange={setSlider(key)} />
            <div className="button-row">
              <button type="button" className="primary" onClick={() => onMove({ type: 'fortify', from: source, to: target, armies: value })}>
                Move {value} and end turn
              </button>
            </div>
          </>
        )}
        <div className="button-row">
          {source && <button type="button" onClick={onClearSelection}>Clear choice</button>}
          <button type="button" onClick={() => onMove({ type: 'endTurn' })}>End turn</button>
        </div>
      </>
    );
  }

  return (
    <section className="panel phase-panel" aria-label="Your turn">
      <div className="panel-title">{title}</div>
      {body}
    </section>
  );
}

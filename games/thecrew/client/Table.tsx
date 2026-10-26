import YouTag from '../../../src/components/YouTag.tsx';
import Card from './Card';
import { seatKey, trickKey } from '../../../src/animation/animKeys.ts';
import { leftOf, missionRules, tokenName, totalTricks } from '../rules.ts';
import { missionOf } from '../missions.ts';
import type { PublicGameState, PublicTask, Seat } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

type TaskPick = {
  label: string; // the button's verb, e.g. 'Take'
  enabled: (index: number) => boolean;
  selected?: number[];
  onPick: (index: number) => void;
};

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog's table view
  showLastMove?: boolean; // highlights the last card played, for the history dialog
  taskPick?: TaskPick; // makes the open tasks clickable
};

const COMM_WORDS = { highest: 'highest', lowest: 'lowest', only: 'only' } as const;

// What a special rule asks of a seat the commander named, or of the pink 9's left neighbour
function roleOf(state: PublicGameState, seat: Seat): string | null {
  const kind = missionOf(state.mission).rule?.kind;
  const index = state.chosen.indexOf(seat);
  if (index === -1) return null;
  switch (kind) {
    case 'sick': return 'sick: must not win a trick';
    case 'mute': return 'may not communicate';
    case 'exactlyOneTrick': return 'must win exactly 1 trick, not with a rocket';
    case 'firstAndLastOnly': return 'must win only the first and last trick';
    case 'allPink': return 'must win every pink card';
    case 'relay': return index === 0 ? 'must win tricks 1 to 4 only' : 'must win only the last trick';
    default: return null;
  }
}

export function TaskChip({ task, index, pick }: { task: PublicTask; index: number; pick?: TaskPick }) {
  const label = task.card ? `task ${task.card.suit} ${task.card.value}` : 'face-down task';
  const body = (
    <>
      {task.card ? <Card card={task.card} small /> : <span className="crew-card crew-card-small crew-card-back" aria-hidden="true"><ServerSvg url={cardArtUrl('stripes')} className="piece-art" />?</span>}
      {task.token !== null && <span className="task-token" title="Order token">{tokenName(task.token)}</span>}
      {task.done && <span className="task-done">done</span>}
    </>
  );
  const classes = ['task', task.done ? 'task-is-done' : ''].join(' ').trim();
  if (!pick) return <span className={classes} aria-label={label}>{body}</span>;
  const selected = pick.selected?.includes(index) ?? false;
  return (
    <button type="button" className={`${classes} task-pick${selected ? ' task-selected' : ''}`} aria-label={`${pick.label} ${label}`}
      aria-pressed={selected} disabled={!pick.enabled(index)} onClick={() => pick.onPick(index)}>
      {body}
    </button>
  );
}

// The mission and its rules, the crew round the table with their tasks and communications, and the trick
export default function Table({ gameState, viewer, showLastMove = false, taskPick }: TableProps) {
  const {
    playerNames, currentPlayer, handCounts, activePlayers, commander, tasks, communications, trick, lastTrick, trickWinners,
    mission, attempt, phase, lastMove, winners
  } = gameState;
  const seated = Object.keys(handCounts).length >= 3;
  const first = viewer !== null && activePlayers.includes(viewer) ? viewer : activePlayers[0];
  const order: Seat[] = [];
  for (let seat = first; order.length < activePlayers.length; seat = leftOf(gameState, seat)) order.push(seat);
  const shown = trick.length > 0 ? trick : lastTrick?.plays ?? [];
  const takenBy = trick.length === 0 && lastTrick ? lastTrick.winner : null;
  const lastPlayed = showLastMove && lastMove?.type === 'play' ? lastMove.playerNumber : null;
  const open = tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.owner === null);

  return (
    <div className="table">
      <div className="mission-info">
        <span className="mission-number">Mission {mission}</span>
        <span className="mission-attempt">Attempt {attempt}</span>
        {seated && <span>Trick {Math.min(trickWinners.length + 1, totalTricks(activePlayers.length))} of {totalTricks(activePlayers.length)}</span>}
      </div>
      <ul className="mission-rules" aria-label="Mission rules">
        {missionRules(missionOf(mission), activePlayers.length).map(line => <li key={line}>{line}</li>)}
        {missionOf(mission).tasks === 0 && !missionOf(mission).rule && <li>No tasks</li>}
      </ul>
      {open.length > 0 && (
        <div className="task-pool" aria-label="Open tasks">
          {open.map(({ task, index }) => <TaskChip key={index} task={task} index={index} pick={taskPick} />)}
        </div>
      )}
      {seated && (
        <div className="seats">
          {order.map(seat => {
            const classes = ['seat'];
            if (seat !== viewer) classes.push('hand-only-hide');
            if (seat === currentPlayer && phase !== 'missionOver') classes.push('seat-current');
            if (winners.includes(seat)) classes.push('seat-winner');
            const said = communications[seat];
            const role = roleOf(gameState, seat);
            const mine = tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.owner === seat);
            const wins = trickWinners.filter(winner => winner === seat).length;
            return (
              <div key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)} aria-label={`Seat of ${playerNames[seat]}`}>
                <span className="seat-name">
                  {playerNames[seat]}
                  <YouTag when={seat === viewer} />
                </span>
                {seat === commander && <span className="seat-badge">Commander</span>}
                {role && <span className="seat-role">{role}</span>}
                <span className="seat-count">{handCounts[seat] ?? 0} cards, {wins} {wins === 1 ? 'trick' : 'tricks'}</span>
                {mine.length > 0 && (
                  <div className="seat-tasks" aria-label={`${playerNames[seat]}'s tasks`}>
                    {mine.map(({ task, index }) => <TaskChip key={index} task={task} index={index} />)}
                  </div>
                )}
                {said && (
                  <div className={said.held ? 'seat-comm' : 'seat-comm seat-comm-played'} aria-label={`${playerNames[seat]}'s communication`}>
                    <Card card={said.card} small />
                    <span className="comm-token">{said.token ? COMM_WORDS[said.token] : 'no token (dead spot)'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {seated && (
        <div className="trick hand-only-hide" aria-label="The trick">
          {order.map(seat => {
            const play = shown.find(p => p.seat === seat);
            return (
              <div key={seat} className="trick-slot">
                <span className="trick-name">{playerNames[seat]}</span>
                {play
                  ? <Card card={play.card} animKey={trickKey(seat)} highlighted={seat === lastPlayed || seat === takenBy} />
                  : <span className="crew-card crew-card-empty" aria-hidden="true" />}
              </div>
            );
          })}
          <div className="trick-taken">{takenBy !== null ? `${playerNames[takenBy]} won the trick` : ''}</div>
        </div>
      )}
    </div>
  );
}

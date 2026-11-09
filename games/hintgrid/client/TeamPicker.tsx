import gameService from '../../../src/services/gameService';
import YouTag from '../../../src/components/YouTag';
import { TEAM_NAMES } from '../teams.ts';
import type { PublicGameState, Team } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

const TEAMS: Team[] = ['red', 'blue'];
const pick = (team: Team, clueGiver: boolean) => gameService.sendAction({ type: 'pickRole', team, clueGiver });

export default function TeamPicker({ gameState, playerNumber }: { gameState: PublicGameState; playerNumber: Seat }) {
  const { activePlayers, playerNames, roles, gameStatus } = gameState;
  const joined = activePlayers.includes(playerNumber);
  return (
    <section className="team-picker" aria-label="Teams">
      <div className="team-columns">
        {TEAMS.map((team) => (
          <div key={team} className={`team-column team-${team}`}>
            <h3>{TEAM_NAMES[team]}</h3>
            <ul>
              {activePlayers.filter((s) => roles[s]?.team === team).map((s) => (
                <li key={s}>{playerNames[s]}<YouTag when={s === playerNumber} />{roles[s]?.clueGiver && <span className="role-tag"> clue-giver</span>}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="action-buttons">
        {TEAMS.map((team) => (
          <span key={team} className="team-buttons">
            <button type="button" disabled={!joined} onClick={() => pick(team, true)}>Be {TEAM_NAMES[team]}&apos;s clue-giver</button>
            <button type="button" disabled={!joined} onClick={() => pick(team, false)}>Guess for {TEAM_NAMES[team]}</button>
          </span>
        ))}
        <button type="button" disabled={!joined} onClick={() => gameService.sendAction({ type: 'evenOut' })}>Even out</button>
      </div>
      <div className="team-status">{gameStatus}</div>
    </section>
  );
}

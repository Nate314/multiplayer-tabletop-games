import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_INFOS } from '../../games/infos.ts';
import { gameFileName } from '../../shared/gameFile.ts';
import type { StatsGame } from '../../shared/stats.ts';
import { plural } from '../../shared/text.ts';
import ThemeToggle from '../components/ThemeToggle.tsx';
import HistoryDialog, { type History } from '../components/HistoryDialog';
import ClientGameGate from '../games/ClientGameGate.tsx';
import { deviceId, replaceDeviceId } from '../services/device.ts';
import { downloadJson } from '../services/download';
import { filterGames, gameStats, headToHead, peopleStats, type StatsFilter } from './aggregate.ts';
import { postStats } from './api.ts';
import LinkPanel from './LinkPanel.tsx';
import './stats.scss';

type Stats = { games: StatsGame[]; devices: number };
type Answer = Stats | { cleared: true };
type Loaded = { status: 'loading' } | { status: 'failed' } | ({ status: 'loaded' } & Stats);

const RECENT_COUNT = 20;
const NO_GAMES: Stats = { games: [], devices: 0 };
const gameName = (gameType: string) => GAME_INFOS.find(({ id }) => id === gameType)?.name ?? gameType;
const percent = (rate: number) => `${Math.round(rate * 100)}%`;
// A /link/<code> address names the code to redeem
const linkCodeOf = (pathname: string) => pathname.match(/^\/link\/([^/]+)$/)?.[1] ?? null;

// A cleared device starts over with a new ID and no games
function settle(answer: Answer): Stats {
  if ('cleared' in answer) {
    replaceDeviceId();
    return NO_GAMES;
  }
  return answer;
}

// GETs `/api/<route>/<type>/<id>/<n>` for the archived game with this device's ID, which the server checks against the game's players
function fetchArchived(route: 'history' | 'game-file', game: StatsGame): Promise<Response> {
  const n = game.archiveId.slice(game.archiveId.lastIndexOf('#') + 1);
  return fetch(`/api/${route}/${game.gameType}/${encodeURIComponent(game.gameId)}/${n}`, {
    headers: { Authorization: `Bearer ${deviceId()}` }
  });
}

async function fetchArchivedHistory(game: StatsGame): Promise<History> {
  try {
    const response = await fetchArchived('history', game);
    if (!response.ok) return { status: 'failed' };
    return { status: 'loaded', ...(await response.json()) };
  } catch {
    return { status: 'failed' };
  }
}

// The server builds the file; false when it could not be fetched
async function downloadArchived(game: StatsGame): Promise<boolean> {
  try {
    const response = await fetchArchived('game-file', game);
    if (!response.ok) return false;
    downloadJson(gameFileName(game.gameType, game.gameId), await response.json());
    return true;
  } catch {
    return false;
  }
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="stats-table">
      <table>
        <thead><tr>{head.map(cell => <th key={cell}>{cell}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={head[index]}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function HeadToHead({ games, names }: { games: StatsGame[]; names: string[] }) {
  const [a, setA] = useState(names[0]);
  const [b, setB] = useState(names[1]);
  // A filter change can drop a picked name; the two are never the same person
  const first = names.includes(a) ? a : names[0];
  const second = names.includes(b) && b !== first ? b : names.find(name => name !== first)!;
  const { games: together, aWins, bWins, other } = headToHead(games, first, second);
  const pick = (value: string, taken: string, onChange: (name: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      {names.filter(name => name !== taken).map(name => <option key={name} value={name}>{name}</option>)}
    </select>
  );
  return (
    <section className="stats-section">
      <h2 className="lobby-category-heading">Head to head</h2>
      <div className="stats-controls">{pick(first, second, setA, 'First player')} vs {pick(second, first, setB, 'Second player')}</div>
      <p className="stats-head-to-head">
        {together === 0 ? 'No games together' : `${first} ${aWins}, ${second} ${bWins}${other ? `, others ${other}` : ''} in ${plural(together, 'game')}`}
      </p>
    </section>
  );
}

function RecentGames({ games, onHistory }: { games: StatsGame[]; onHistory: (game: StatsGame) => void }) {
  return (
    <section className="stats-section">
      <h2 className="lobby-category-heading">Recent games</h2>
      <ul className="stats-recent">
        {games.slice(0, RECENT_COUNT).map(game => (
          <li key={game.archiveId}>
            <span className="stats-recent-game">{gameName(game.gameType)}</span>
            <span className="stats-recent-date">{new Date(game.finishedAt).toLocaleDateString()}</span>
            <span className="stats-recent-players">
              {[...game.players].sort((x, y) => x.place - y.place).map(player => `${player.place}. ${player.name}`).join(', ')}
            </span>
            {game.historyAvailable && <button type="button" className="lobby-button" onClick={() => onHistory(game)}>History</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClearPanel({ stats, onCleared }: { stats: Stats; onCleared: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set by Cancel, so the trigger takes focus back when it returns
  const refocus = useRef(false);

  async function clear() {
    setFailed(false);
    try {
      await postStats('/clear');
      replaceDeviceId();
      setConfirming(false);
      onCleared();
    } catch {
      setFailed(true);
    }
  }

  return (
    <section className="stats-section">
      {confirming ? (
        <div className="stats-clear" role="group" aria-label="Clear my data">
          <p>{`This removes you from ${plural(stats.games.length, 'game')} on ${plural(stats.devices, 'device')}. It cannot be undone.`}</p>
          <div className="stats-controls">
            <button type="button" className="lobby-button lobby-button-primary" onClick={clear}>Clear my data</button>
            <button type="button" className="lobby-button" autoFocus onClick={() => { refocus.current = true; setConfirming(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="lobby-button"
          ref={button => { if (button && refocus.current) { refocus.current = false; button.focus(); } }}
          onClick={() => setConfirming(true)}
        >
          Clear my data
        </button>
      )}
      {failed && <p className="lobby-error" role="alert">Could not clear your data</p>}
    </section>
  );
}

// Asks before linking, since a code links this device for good
function LinkPrompt({ code, onAnswer }: { code: string; onAnswer: (answer: Answer) => void }) {
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setError(null);
    try {
      const answer = await postStats<{ games: number } | { cleared: true } | { error: string }>('/link', { code });
      if ('error' in answer) setError(answer.error);
      else onAnswer('cleared' in answer ? answer : await postStats<Answer>(''));
    } catch {
      setError('Could not link this device');
    }
  }

  return (
    <section className="stats-section stats-link-prompt">
      <h2>Link this device?</h2>
      <p className="stats-link-code">{code}</p>
      <button type="button" className="lobby-button lobby-button-primary" onClick={link}>Link</button>
      {error && <p className="lobby-error" role="alert">{error}</p>}
    </section>
  );
}

// The /stats page, and /link/<code>, which asks to link this device first
export default function StatsPage() {
  const [code, setCode] = useState(() => linkCodeOf(window.location.pathname));
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [filter, setFilter] = useState<StatsFilter>({ gameType: null, range: 'all' });
  const [shown, setShown] = useState<{ game: StatsGame; history: History } | null>(null);
  const closeHistory = useCallback(() => setShown(null), []);

  useEffect(() => {
    if (code) return;
    let live = true;
    postStats<Answer>('').then(
      answer => { if (live) setLoaded({ status: 'loaded', ...settle(answer) }); },
      () => { if (live) setLoaded({ status: 'failed' }); }
    );
    return () => { live = false; };
  }, [code]);

  function linked(answer: Answer) {
    window.history.replaceState(null, '', '/stats');
    setCode(null);
    setLoaded({ status: 'loaded', ...settle(answer) });
  }

  async function openHistory(game: StatsGame) {
    setShown({ game, history: { status: 'loading' } });
    const history = await fetchArchivedHistory(game);
    // Closed or another game opened while loading: leave that be
    setShown(current => (current?.game === game ? { game, history } : current));
  }

  const all = loaded.status === 'loaded' ? loaded.games : [];
  const games = filterGames(all, filter, Date.now());
  const people = peopleStats(games);
  const gameTypes = [...new Set(all.map(game => game.gameType))];

  let body;
  if (code) body = <LinkPrompt code={code} onAnswer={linked} />;
  else if (loaded.status === 'loading') body = <p className="client-game-loading">Loading your stats...</p>;
  else if (loaded.status === 'failed') body = <p className="lobby-error" role="alert">Could not load your stats</p>;
  else {
    body = (
      <>
        {all.length === 0 ? <p className="stats-empty">No games yet</p> : (
          <>
            <div className="stats-controls">
              <select aria-label="Game" value={filter.gameType ?? ''} onChange={event => setFilter({ ...filter, gameType: event.target.value || null })}>
                <option value="">All games</option>
                {gameTypes.map(gameType => <option key={gameType} value={gameType}>{gameName(gameType)}</option>)}
              </select>
              {(['month', 'all'] as const).map(range => (
                <button key={range} type="button" className="themed-chip" aria-pressed={filter.range === range} onClick={() => setFilter({ ...filter, range })}>
                  {range === 'month' ? 'This month' : 'All time'}
                </button>
              ))}
            </div>
            {games.length === 0 ? <p className="stats-empty">No games in this time</p> : (
              <>
                <section className="stats-section">
                  <h2 className="lobby-category-heading">People</h2>
                  <Table
                    head={['Name', 'Games', 'Wins', 'Win rate', 'Favorite game', 'Streak']}
                    rows={people.map(p => [p.name, p.games, p.wins, percent(p.winRate), gameName(p.favoriteGame), p.streak])}
                  />
                </section>
                <section className="stats-section">
                  <h2 className="lobby-category-heading">Games</h2>
                  <Table
                    head={['Game', 'Played', 'Usual length', 'High score']}
                    rows={gameStats(games).map(g => [gameName(g.gameType), g.played, `${g.usualMinutes} min`, g.highScore ? `${g.highScore.score} (${g.highScore.name})` : ''])}
                  />
                </section>
                {people.length >= 2 && <HeadToHead games={games} names={people.map(p => p.name)} />}
                <RecentGames games={games} onHistory={openHistory} />
              </>
            )}
          </>
        )}
        <LinkPanel />
        <ClearPanel stats={loaded} onCleared={() => setLoaded({ status: 'loaded', ...NO_GAMES })} />
      </>
    );
  }

  return (
    <div className="lobby stats-page">
      <header className="lobby-header">
        <h1>Stats</h1>
        <a className="lobby-button stats-back" href="/">Back to games</a>
        <ThemeToggle />
      </header>
      <main className="lobby-main">{body}</main>
      {shown && (
        <ClientGameGate id={shown.game.gameType} name={gameName(shown.game.gameType)}>
          {client => (
            <div data-game={shown.game.gameType}>
              <HistoryDialog
                client={client}
                history={shown.history}
                title={`${gameName(shown.game.gameType)}: ${shown.game.gameId}`}
                onClose={closeHistory}
                onDownload={() => downloadArchived(shown.game)}
              />
            </div>
          )}
        </ClientGameGate>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { OpenGame } from '../../shared/types.ts';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';
import { describeOpenGame, fetchOpenGames, OPEN_GAMES_REFRESH_MS } from '../services/openGames.ts';

type OpenGamesProps = {
  games: GameInfo[];
  onSelect: (game: OpenGame) => void;
};

export default function OpenGames({ games, onSelect }: OpenGamesProps) {
  const [open, setOpen] = useState<OpenGame[]>([]);
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const result = await fetchOpenGames();
      if (stopped) return;
      if (result === 'off') stopped = true; // the server does not list games, so never ask again
      else if (result !== 'failed') setOpen(result); // a failure keeps the last list
    };
    void poll();
    const timer = setInterval(poll, OPEN_GAMES_REFRESH_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, []);

  const listed = open.flatMap(game => {
    const info = games.find(({ id }) => id === game.gameType);
    return info ? [{ game, info }] : [];
  });
  if (listed.length === 0) return null;
  return (
    <section className="open-games lobby-category" aria-labelledby="open-games-heading">
      <h2 id="open-games-heading" className="lobby-category-heading">Games happening now</h2>
      <ul className="lobby-games">
        {listed.map(({ game, info }) => (
          <li key={`${game.gameType}/${game.gameId}`}>
            <button type="button" className="lobby-game open-game" onClick={() => onSelect(game)}>
              <ServerSvg url={svgUrl('game-icon', info.id)} className="lobby-game-icon" />
              <span className="lobby-game-text">
                <span className="open-game-name">{info.name}</span>
                <span className="open-game-id">ID {game.gameId}</span>
                <span className="lobby-game-description">{describeOpenGame(game, info.name)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

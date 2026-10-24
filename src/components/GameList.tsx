import { useState } from 'react';
import type { PlayableGame } from '../clientGames.ts';
import { loadLandingFilters, saveLandingFilters } from '../services/settings.ts';
import GameFilters from './GameFilters.tsx';
import { arrangeGames } from './gameFilters.ts';
import type { LandingFilters } from './gameFilters.ts';

type GameListProps = {
  games: PlayableGame[];
  onSelect: (gameId: string) => void;
};

export default function GameList({ games, onSelect }: GameListProps) {
  const [filters, setFilters] = useState(loadLandingFilters);
  const change = (next: LandingFilters) => {
    setFilters(next);
    saveLandingFilters(next);
  };
  const sections = arrangeGames(games, filters);
  return (
    <>
      <GameFilters filters={filters} onChange={change} />
      {sections.length === 0 && <p className="lobby-empty">No games match these filters</p>}
      {sections.map(({ key, heading, games: group }) => (
        <section
          key={key}
          className="lobby-category"
          aria-labelledby={heading === null ? undefined : `lobby-category-${key}`}
          aria-label={heading === null ? 'All games' : undefined}
        >
          {heading !== null && <h2 id={`lobby-category-${key}`} className="lobby-category-heading">{heading}</h2>}
          <ul className="lobby-games">
            {group.map(({ info: { id, name, description, minPlayers, maxPlayers }, client }) => (
              <li key={id}>
                <button type="button" className="lobby-game" onClick={() => onSelect(id)}>
                  <span className="lobby-game-icon" aria-hidden="true">{client.icon}</span>
                  <span className="lobby-game-text">
                    <span className="lobby-game-name">{name}</span>
                    <span className="lobby-game-description">{description}</span>
                  </span>
                  <span className="lobby-game-players">{minPlayers === maxPlayers ? `${minPlayers} players` : `${minPlayers} to ${maxPlayers} players`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

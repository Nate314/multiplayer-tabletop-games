import { useState } from 'react';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';
import { loadLandingFilters, saveLandingFilters } from '../services/settings.ts';
import GameFilters from './GameFilters.tsx';
import { arrangeGames, clearFilters, needsHouseRule } from './gameFilters.ts';
import type { LandingFilters } from './gameFilters.ts';

type GameListProps = {
  games: GameInfo[];
  onSelect: (gameId: string) => void;
};

export default function GameList({ games, onSelect }: GameListProps) {
  const [filters, setFilters] = useState(loadLandingFilters);
  const change = (next: LandingFilters) => {
    setFilters(next);
    saveLandingFilters(next);
  };
  const sections = arrangeGames(games.map(info => ({ info })), filters);
  return (
    <>
      <GameFilters filters={filters} onChange={change} />
      {sections.length === 0 && (
        // A filter can hide the whole list while its panel is closed, so the way out sits right here
        <p className="lobby-empty">
          No games match these filters{' '}
          <button type="button" className="lobby-button" onClick={() => change(clearFilters(filters))}>Clear filters</button>
        </p>
      )}
      {sections.map(({ key, heading, games: group }) => (
        <section
          key={key}
          className="lobby-category"
          aria-labelledby={heading === null ? undefined : `lobby-category-${key}`}
          aria-label={heading === null ? 'All games' : undefined}
        >
          {heading !== null && <h2 id={`lobby-category-${key}`} className="lobby-category-heading">{heading}</h2>}
          <ul className="lobby-games">
            {group.map(({ info }) => {
              const { id, name, description, minPlayers, maxPlayers } = info;
              const houseRule = filters.players !== null && needsHouseRule(info, filters.players);
              return (
                <li key={id}>
                  <button type="button" className="lobby-game" onClick={() => onSelect(id)}>
                    <ServerSvg url={svgUrl('game-icon', id)} className="lobby-game-icon" />
                    <span className="lobby-game-text">
                      <span className="lobby-game-name">{name}</span>
                      <span className="lobby-game-description">{description}</span>
                    </span>
                    <span className="lobby-game-players">
                      {minPlayers === maxPlayers ? `${minPlayers} players` : `${minPlayers} to ${maxPlayers} players`}
                      {houseRule && <span className="lobby-game-house-rule">{`${filters.players} with a house rule`}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

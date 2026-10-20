import { groupByCategory } from '../../shared/categories.ts';
import type { PlayableGame } from '../clientGames.ts';

type GameListProps = {
  games: PlayableGame[];
  onSelect: (gameId: string) => void;
};

export default function GameList({ games, onSelect }: GameListProps) {
  return (
    <>
      {groupByCategory(games).map(({ category, name: heading, games: group }) => (
        <section key={category} className="lobby-category" aria-labelledby={`lobby-category-${category}`}>
          <h2 id={`lobby-category-${category}`} className="lobby-category-heading">{heading}</h2>
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

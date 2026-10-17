import type { GameInfo } from '../../shared/gameDefinition.ts';
import { CLIENT_GAMES } from '../clientGames.ts';

type GameListProps = {
  games: GameInfo[];
  onSelect: (gameId: string) => void;
};

export default function GameList({ games, onSelect }: GameListProps) {
  return (
    <ul className="lobby-games">
      {games.map(({ id, name, description, minPlayers, maxPlayers }) => (
        <li key={id}>
          <button type="button" className="lobby-game" onClick={() => onSelect(id)}>
            <span className="lobby-game-icon" aria-hidden="true">{CLIENT_GAMES[id].icon}</span>
            <span className="lobby-game-text">
              <span className="lobby-game-name">{name}</span>
              <span className="lobby-game-description">{description}</span>
            </span>
            <span className="lobby-game-players">{`${minPlayers} to ${maxPlayers} players`}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

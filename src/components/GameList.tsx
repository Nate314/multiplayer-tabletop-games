import type { PlayableGame } from '../clientGames.ts';

type GameListProps = {
  games: PlayableGame[];
  onSelect: (gameId: string) => void;
};

export default function GameList({ games, onSelect }: GameListProps) {
  return (
    <ul className="lobby-games">
      {games.map(({ info: { id, name, description, minPlayers, maxPlayers }, client }) => (
        <li key={id}>
          <button type="button" className="lobby-game" onClick={() => onSelect(id)}>
            <span className="lobby-game-icon" aria-hidden="true">{client.icon}</span>
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

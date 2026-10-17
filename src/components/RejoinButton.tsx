type RejoinButtonProps = {
  gameName: string;
  gameId: string;
  onRejoin: () => void;
};

// Shown on the list after "Back to games" or a lost connection, while the server still holds the seat
export default function RejoinButton({ gameName, gameId, onRejoin }: RejoinButtonProps) {
  return (
    <button type="button" className="lobby-button lobby-button-primary lobby-rejoin" onClick={onRejoin}>
      {`Back to ${gameName} (${gameId})`}
    </button>
  );
}

type PauseButtonProps = {
  disabled: boolean;
  onPause: () => void;
};

// Asks the table to pause; the header shows it, and phones show it in Settings
export default function PauseButton({ disabled, onPause }: PauseButtonProps) {
  return (
    <button type="button" className="pause-button" disabled={disabled} title={disabled ? 'Everyone must be here to pause' : undefined} onClick={onPause}>
      Pause
    </button>
  );
}

type ClaimPromptProps = {
  claim: string; // what the draw would be claimed by, such as 'threefold repetition'
  onPlay: (claimDraw: boolean) => void;
  onCancel: () => void;
};

// Shown over the board when the chosen move would let the mover claim a draw along with it
export default function ClaimPrompt({ claim, onPlay, onCancel }: ClaimPromptProps) {
  return (
    <div className="board-prompt">
      <div className="board-prompt-panel">
        <div className="panel-title">This move allows a draw by {claim}</div>
        <div className="claim-choices">
          <button type="button" onClick={() => onPlay(true)}>Move and claim draw</button>
          <button type="button" onClick={() => onPlay(false)}>Just move</button>
        </div>
        <button type="button" className="board-prompt-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

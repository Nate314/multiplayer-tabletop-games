import ColorSymbol from '../../../src/components/ColorSymbol';
import type { CardKind, PublicGameState } from '../types.ts';

// A visible mark per kind, so color is never the only cue
const MARK: Record<CardKind, string> = { red: 'R', blue: 'B', bystander: '○', trap: '✖' };

// onGuess is set only when the viewer may tap a card now
export default function Grid({ gameState, onGuess }: { gameState: PublicGameState; onGuess?: (index: number) => void }) {
  const { words, key, revealed, lastMove } = gameState;
  return (
    <div className="hint-grid" role="group" aria-label="Words">
      {words.map((word, i) => {
        const kind = key[i];
        const up = revealed[i];
        const lastGuess = lastMove?.type === 'guess' && lastMove.index === i;
        const label = kind ? `${word}, ${kind}` : word;
        const classes = ['hint-card', up ? 'up' : 'down', kind ? `kind-${kind}` : '', lastGuess ? 'last' : ''].filter(Boolean).join(' ');
        return (
          <button key={word} type="button" className={classes} aria-label={up ? `${label}, turned over` : label}
            aria-disabled={up || !onGuess ? true : undefined} onClick={() => { if (!up && onGuess) onGuess(i); }}>
            <span className="hint-word">{word}</span>
            {kind && (
              <span className="hint-mark" aria-hidden="true">
                {(kind === 'red' || kind === 'blue') && <ColorSymbol color={kind} />}{MARK[kind]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

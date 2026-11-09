import { OBJECTS, ROOMS, SUSPECTS } from '../content.ts';
import type { CardId } from '../content.ts';
import type { Action, Mark, PublicGameState } from '../types.ts';

const CYCLE: (Mark | null)[] = [null, 'yes', 'no', 'maybe'];
const GROUPS = [['Suspects', SUSPECTS], ['Objects', OBJECTS], ['Rooms', ROOMS]] as const;

// The viewer's private detective notes: a mark per card, kept by the game. Without onAction the sheet is read only
export default function NotesSheet({ gameState, onAction }: { gameState: PublicGameState; onAction?: (action: Action) => void }) {
  const { notes, hand, faceUp } = gameState;
  const open = new Set<CardId>(Object.values(faceUp).flat());
  return (
    <section className="wd-notes" aria-label="Notes">
      <h3 className="wd-heading">Notes</h3>
      {GROUPS.map(([title, cards]) => (
        <div key={title} className="wd-notes-group">
          <h4>{title}</h4>
          <ul>
            {cards.map(({ id, name }) => {
              const mark = notes[id] ?? null;
              const next = CYCLE[(CYCLE.indexOf(mark) + 1) % CYCLE.length];
              const tag = hand.includes(id) ? 'in your hand' : open.has(id) ? 'face up' : null;
              return (
                <li key={id} className={tag ? 'wd-note wd-note-known' : 'wd-note'}>
                  <span className="wd-note-name">{name}{tag && <span className="wd-note-tag"> ({tag})</span>}</span>
                  <button type="button" className={`wd-mark wd-mark-${mark ?? 'blank'}`} aria-label={`${name}: ${mark ?? 'blank'}`}
                    disabled={!onAction} onClick={() => onAction?.({ type: 'note', card: id, mark: next })}>
                    {mark ?? ''}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

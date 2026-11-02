import type { Mark as MarkName } from '../marks.ts';

// An X or an O drawn in currentColor, sized by its parent
export default function Mark({ mark }: { mark: MarkName }) {
  return (
    <svg className={`mark mark-${mark.toLowerCase()}`} viewBox="0 0 100 100" role="img" aria-label={mark}>
      {mark === 'X'
        ? <path d="M20 20L80 80M80 20L20 80" />
        : <circle cx="50" cy="50" r="31" />}
    </svg>
  );
}

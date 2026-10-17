import { useEffect } from 'react';
import type { FaqItem } from '../clientGames.ts';

type FaqDialogProps = {
  title: string;
  items: FaqItem[];
  onClose: () => void;
};

export default function FaqDialog({ title, items, onClose }: FaqDialogProps) {
  useEffect(() => {
    // Capture phase, so Escape closes only the FAQ and not the join dialog behind it
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal faq" role="dialog" aria-label="Frequently asked questions" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <dl>
          {items.map(({ question, answer }) => (
            <div key={question}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

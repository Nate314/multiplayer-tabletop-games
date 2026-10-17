import useEscapeKey from '../hooks/useEscapeKey';
import type { FaqItem } from '../clientGames.ts';

type FaqDialogProps = {
  title: string;
  items: FaqItem[];
  onClose: () => void;
};

export default function FaqDialog({ title, items, onClose }: FaqDialogProps) {
  useEscapeKey(onClose);

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

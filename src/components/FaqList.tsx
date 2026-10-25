import type { FaqItem } from '../clientGames.ts';

export default function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <dl>
      {items.map(({ question, answer }) => (
        <div key={question}>
          <dt>{question}</dt>
          <dd>{answer}</dd>
        </div>
      ))}
    </dl>
  );
}

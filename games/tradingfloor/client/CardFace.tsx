import { faceOf } from './describeMove.ts';
import type { Card } from '../types.ts';

// One card: its commodity's color band with the value, and the name below
export default function CardFace({ kind }: { kind: Card['kind'] }) {
  const { name, mark } = faceOf(kind);
  return (
    <svg className={`tf-card tf-card-${kind}`} viewBox="0 0 60 84" aria-hidden="true">
      <rect className="tf-card-edge" x="1" y="1" width="58" height="82" rx="6" />
      <rect className="tf-card-band" x="6" y="6" width="48" height="46" rx="4" />
      <text className="tf-card-mark" x="30" y="36" textAnchor="middle">{mark}</text>
      <text className="tf-card-name" x="30" y="70" textAnchor="middle">{name}</text>
    </svg>
  );
}

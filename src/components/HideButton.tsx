import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

export default function HideButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const label = hidden ? 'Show' : 'Hide';
  return (
    <button type="button" className="hide-button" aria-label={label} title={label} onClick={onToggle}>
      <ServerSvg url={svgUrl('icon', hidden ? 'eye' : 'eye-off')} className="header-icon" />
    </button>
  );
}

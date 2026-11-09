import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

export default function HideButton({ hidden, onToggle, withLabel = false }: { hidden: boolean; onToggle: () => void; withLabel?: boolean }) {
  const label = hidden ? 'Show' : 'Hide';
  return (
    <button type="button" className="hide-button" aria-label={label} title={label} onClick={onToggle}>
      <ServerSvg url={svgUrl('icon', hidden ? 'eye' : 'eye-off')} className="header-icon" />
      {withLabel && <span className="menu-label">{label}</span>}
    </button>
  );
}

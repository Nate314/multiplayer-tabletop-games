import type { TableLayout } from '../services/settings.ts';

type LayoutSwitchProps = { layout: TableLayout; onChange: (layout: TableLayout) => void };

export default function LayoutSwitch({ layout, onChange }: LayoutSwitchProps) {
  return (
    <div className="layout-switch">
      <button type="button" aria-pressed={layout === 'board'} onClick={() => onChange('board')}>Board and hand</button>
      <button type="button" aria-pressed={layout === 'handOnly'} onClick={() => onChange('handOnly')}>Hand only</button>
    </div>
  );
}

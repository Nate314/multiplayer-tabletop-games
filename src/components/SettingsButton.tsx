import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import SettingsDialog from './SettingsDialog';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

// `phoneControls` are header buttons that phones show in Settings instead, as the header has no room for them.
// A function gets the dialog's close, for a control whose result shows under the dialog (Pause)
export default function SettingsButton({ phoneControls }: { phoneControls?: ReactNode | ((close: () => void) => ReactNode) }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="settings-button" aria-label="Settings" onClick={() => setOpen(true)}>
        <ServerSvg url={svgUrl('icon', 'gear')} className="header-icon" />
      </button>
      {open && <SettingsDialog onClose={close} phoneControls={typeof phoneControls === 'function' ? phoneControls(close) : phoneControls} />}
    </>
  );
}

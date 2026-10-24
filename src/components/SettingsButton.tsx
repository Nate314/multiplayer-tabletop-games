import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import SettingsDialog from './SettingsDialog';

// `phoneControls` are header buttons that phones show in Settings instead, as the header has no room for them
export default function SettingsButton({ phoneControls }: { phoneControls?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="settings-button" aria-label="Settings" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open && <SettingsDialog onClose={close} phoneControls={phoneControls} />}
    </>
  );
}

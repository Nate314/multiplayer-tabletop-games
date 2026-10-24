import { useCallback, useState } from 'react';
import SettingsDialog from './SettingsDialog';

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="settings-button" aria-label="Settings" onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open && <SettingsDialog onClose={close} />}
    </>
  );
}

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import SettingsDialog from './SettingsDialog';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

// The Settings dialog and what opens it, so the game menu can hold the button while the dialog lives outside the menu
// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its button; fast refresh reloads this file in full
export function useSettingsDialog(): { open: () => void; dialog: ReactNode } {
  const [isOpen, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return { open: () => setOpen(true), dialog: isOpen && <SettingsDialog onClose={close} /> };
}

export function SettingsTrigger({ onOpen, withLabel = false }: { onOpen: () => void; withLabel?: boolean }) {
  return (
    <button type="button" className="settings-button" aria-label="Settings" onClick={onOpen}>
      <ServerSvg url={svgUrl('icon', 'gear')} className="header-icon" />
      {withLabel && <span className="menu-label">Settings</span>}
    </button>
  );
}

// The landing page's gear; the game header puts SettingsTrigger in its menu
export default function SettingsButton() {
  const settings = useSettingsDialog();
  return (
    <>
      <SettingsTrigger onOpen={settings.open} />
      {settings.dialog}
    </>
  );
}

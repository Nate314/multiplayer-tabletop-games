import type { ReactNode } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import usePreferences, { setPreferences } from '../hooks/usePreferences';
import type { SoundName } from '../services/settings.ts';

const SOUND_LABELS: [SoundName, string][] = [
  ['turn', 'Your turn chime'],
  ['move', 'Moves'],
  ['dice', 'Dice'],
  ['gameOver', 'Game over'],
  ['timer', 'Timer warnings']
];

type SettingsDialogProps = {
  onClose: () => void;
  phoneControls?: ReactNode;
};

export default function SettingsDialog({ onClose, phoneControls }: SettingsDialogProps) {
  useEscapeKey(onClose);
  const preferences = usePreferences();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal settings" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        {phoneControls && (
          <section className="settings-phone-controls">
            <h3>Share and theme</h3>
            {phoneControls}
          </section>
        )}
        <section>
          <h3>Sounds</h3>
          <label className="settings-volume">
            Volume
            <input
              type="range"
              className="themed-range"
              min={0}
              max={100}
              step={5}
              value={Math.round(preferences.volume * 100)}
              onChange={(e) => setPreferences({ ...preferences, volume: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="themed-checkbox">
            <input
              type="checkbox"
              checked={preferences.muted}
              onChange={(e) => setPreferences({ ...preferences, muted: e.target.checked })}
            />
            Mute all
          </label>
          {SOUND_LABELS.map(([name, label]) => (
            <label key={name} className="themed-checkbox">
              <input
                type="checkbox"
                checked={preferences.sounds[name]}
                onChange={(e) => setPreferences({ ...preferences, sounds: { ...preferences.sounds, [name]: e.target.checked } })}
              />
              {label}
            </label>
          ))}
        </section>
        <section>
          <h3>Display</h3>
          <label className="themed-checkbox">
            <input
              type="checkbox"
              checked={preferences.colorSymbols}
              onChange={(e) => setPreferences({ ...preferences, colorSymbols: e.target.checked })}
            />
            Color-blind symbols
          </label>
          <label className="themed-checkbox">
            <input
              type="checkbox"
              checked={preferences.highlightDrawn}
              onChange={(e) => setPreferences({ ...preferences, highlightDrawn: e.target.checked })}
            />
            Highlight newly drawn cards
          </label>
        </section>
        {/* House rules: the current game's house rules go here, read only, once the house rules PR is combined; nothing renders when the game has none */}
        <div className="modal-buttons">
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

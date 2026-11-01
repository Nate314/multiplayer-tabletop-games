import type { ReactNode } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import usePreferences, { setPreferences } from '../hooks/usePreferences';
import { SOUNDS } from '../../shared/sounds.ts';
import { alertSupport, currentEnv, requestAlerts, SUPPORT_EXPLANATIONS, unsubscribePush } from '../alerts/support.ts';

// Off and explained wherever this browser or address cannot notify; the game itself drops its seats from the server
function NotificationsSetting() {
  const preferences = usePreferences();
  const support = alertSupport(currentEnv());
  return (
    <section>
      <h3>Notifications</h3>
      <label>
        <input
          type="checkbox"
          disabled={support !== 'ready'}
          checked={support === 'ready' && preferences.notifications}
          onChange={(e) => {
            setPreferences({ ...preferences, notifications: e.target.checked });
            if (e.target.checked) requestAlerts();
            else unsubscribePush();
          }}
        />
        Notify me when it is my turn
      </label>
      {support !== 'ready' && <p className="settings-note">{SUPPORT_EXPLANATIONS[support]}</p>}
    </section>
  );
}

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
          <label>
            <input
              type="checkbox"
              checked={preferences.muted}
              onChange={(e) => setPreferences({ ...preferences, muted: e.target.checked })}
            />
            Mute all
          </label>
          {SOUNDS.map(({ name, label }) => (
            <label key={name}>
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
          <label>
            <input
              type="checkbox"
              checked={preferences.colorSymbols}
              onChange={(e) => setPreferences({ ...preferences, colorSymbols: e.target.checked })}
            />
            Color-blind symbols
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.highlightDrawn}
              onChange={(e) => setPreferences({ ...preferences, highlightDrawn: e.target.checked })}
            />
            Highlight newly drawn cards
          </label>
        </section>
        <NotificationsSetting />
        <div className="modal-buttons">
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { SoundDef } from '../../shared/sounds.ts';
import { playSounds, unlockAudio } from '../sound/synth.ts';
import { plural } from '../../shared/text.ts';
import ThemeToggle from '../components/ThemeToggle.tsx';
import './dev.scss';

// Hidden page at /dev/sounds: each game sound with a Play button (it follows the Settings volume and mute)
export default function SoundGallery() {
  const [sounds, setSounds] = useState<SoundDef[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/sound')
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then(setSounds, () => setError(true));
  }, []);

  return (
    <div className="lobby dev-page">
      <header className="lobby-header">
        <h1>Sounds</h1>
        <ThemeToggle />
      </header>
      {error && <p className="lobby-error">Could not load the list of sounds</p>}
      <ul className="dev-sounds">
        {sounds?.map(({ name, label, notes, noise }) => (
          <li key={name} className="dev-sound">
            <button
              type="button"
              className="primary-button"
              aria-label={`Play ${label}`}
              onClick={() => {
                unlockAudio();
                playSounds([name]);
              }}
            >
              Play
            </button>
            <span className="dev-sound-name">{label}</span>
            <code className="dev-card-url">/api/sound/{name}</code>
            <span className="dev-sound-detail">
              {noise ? `${noise.bursts} noise bursts` : plural(notes.length, 'note')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

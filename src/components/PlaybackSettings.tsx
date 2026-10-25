import { useCallback, useRef, useState } from 'react';
import useDismiss from '../hooks/useDismiss.ts';
import type { Seat } from '../../shared/types.ts';
import { PLAYBACK_SPEEDS } from './playback.ts';
import type { PlaybackSpeed } from './playback.ts';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

type PlaybackSettingsProps = {
  animations: boolean;
  onAnimationsChange: (on: boolean) => void;
  sounds: boolean;
  onSoundsChange: (on: boolean) => void;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  viewAs?: { value: Seat | null; options: { seat: string; name: string }[]; onChange: (seat: Seat | null) => void };
};

// The History dialog's settings: a gear that opens a panel above itself. A press anywhere else, or Escape, closes the panel.
export default function PlaybackSettings({ animations, onAnimationsChange, sounds, onSoundsChange, speed, onSpeedChange, viewAs }: PlaybackSettingsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapperRef, open, close);

  return (
    <div className="history-settings-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="history-settings-button"
        aria-label="Playback settings"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <ServerSvg url={svgUrl('icon', 'gear')} className="header-icon" />
      </button>
      {open && (
        <div className="history-settings" role="group" aria-label="Playback settings">
          <label>
            <input type="checkbox" checked={animations} onChange={(e) => onAnimationsChange(e.target.checked)} /> Animations
          </label>
          <label>
            <input type="checkbox" checked={sounds} onChange={(e) => onSoundsChange(e.target.checked)} /> Sounds
          </label>
          <label>
            Speed{' '}
            <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value) as PlaybackSpeed)}>
              {PLAYBACK_SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
            </select>
          </label>
          {viewAs && (
            <select
              aria-label="View as"
              value={viewAs.value === null ? '' : String(viewAs.value)}
              onChange={(e) => viewAs.onChange(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Table only</option>
              {viewAs.options.map(({ seat, name }) => <option key={seat} value={seat}>{name}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Seat } from '../../shared/types.ts';
import { PLAYBACK_SPEEDS } from './playback.ts';
import type { PlaybackSpeed } from './playback.ts';

type PlaybackSettingsProps = {
  animations: boolean;
  onAnimationsChange: (on: boolean) => void;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  viewAs?: { value: Seat | null; options: { seat: string; name: string }[]; onChange: (seat: Seat | null) => void };
};

// The History dialog's settings: a gear that opens a panel above itself. A press anywhere else closes the panel.
export default function PlaybackSettings({ animations, onAnimationsChange, speed, onSpeedChange, viewAs }: PlaybackSettingsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return (
    <div className="history-settings-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="history-settings-button"
        aria-label="Playback settings"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ⚙
      </button>
      {open && (
        <div className="history-settings" role="group" aria-label="Playback settings">
          <label className="themed-checkbox">
            <input type="checkbox" checked={animations} onChange={(e) => onAnimationsChange(e.target.checked)} /> Animations
          </label>
          {/* The preferences PR adds its Sounds checkbox here */}
          <label>
            Speed{' '}
            <select className="themed-select" value={speed} onChange={(e) => onSpeedChange(Number(e.target.value) as PlaybackSpeed)}>
              {PLAYBACK_SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
            </select>
          </label>
          {viewAs && (
            <select
              className="themed-select"
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

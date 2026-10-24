import { useEffect, useState } from 'react';
import { joinLink, shareGame } from '../services/share';
import type { GameInfo } from '../../shared/gameDefinition.ts';

const COPIED_MS = 2000;

export default function ShareButton({ game, gameId }: { game: GameInfo; gameId: string }) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if (manualUrl) {
      setManualUrl(null);
      return;
    }
    const url = joinLink(location.origin, game.id, gameId);
    const result = await shareGame(navigator, { title: `Join ${game.name}`, url });
    if (result === 'copied') setCopied(true);
    if (result === 'manual') setManualUrl(url);
  };

  return (
    <div className="share-wrapper">
      <button type="button" className="share-button" aria-label="Share" onClick={share}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>
      {copied && <span role="status" className="share-status">Link copied</span>}
      {manualUrl && (
        <div className="share-panel">
          Copy this link
          <input readOnly aria-label="Game link" className="themed-input" value={manualUrl} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}

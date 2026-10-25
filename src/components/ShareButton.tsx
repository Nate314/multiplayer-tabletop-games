import { useCallback, useEffect, useRef, useState } from 'react';
import useDismiss from '../hooks/useDismiss.ts';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';
import { joinLink, shareGame } from '../services/share.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';

const COPIED_MS = 2000;

export default function ShareButton({ game, gameId }: { game: GameInfo; gameId: string }) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setManualUrl(null), []);
  useDismiss(wrapperRef, manualUrl !== null, closePanel);

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
    <div className="share-wrapper" ref={wrapperRef}>
      <button type="button" className="share-button" aria-label="Share" onClick={share}>
        <ServerSvg url={svgUrl('icon', 'share')} className="header-icon" />
      </button>
      <span role="status" className="share-status" hidden={!copied}>{copied ? 'Link copied' : ''}</span>
      {manualUrl && (
        <div className="share-panel">
          Copy this link
          <input readOnly aria-label="Game link" className="themed-input" value={manualUrl} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}

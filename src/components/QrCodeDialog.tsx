import { useId } from 'react';
import JoinQr from './JoinQr';
import useEscapeKey from '../hooks/useEscapeKey';
import type { GameInfo } from '../../shared/gameDefinition.ts';

type QrCodeDialogProps = {
  game: GameInfo;
  gameId: string;
  onClose: () => void;
};

export default function QrCodeDialog({ game, gameId, onClose }: QrCodeDialogProps) {
  useEscapeKey(onClose);
  const titleId = useId();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal qr-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>Scan to join</h2>
        <JoinQr game={game} gameId={gameId} />
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

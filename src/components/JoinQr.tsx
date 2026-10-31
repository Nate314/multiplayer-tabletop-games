import ServerSvg from '../assets/ServerSvg';
import { svgUrl } from '../assets/svgCache.ts';
import { joinLink } from '../services/share.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';

// The join QR code and its link, shown by the table screen lobby and its QR dialog
export default function JoinQr({ game, gameId }: { game: GameInfo; gameId: string }) {
  const link = joinLink(window.location.origin, game.id, gameId);
  return (
    <>
      <ServerSvg url={svgUrl('qr', link)} className="table-screen-qr" title={`QR code to join ${game.name} ${gameId}`} />
      <p className="table-screen-link">{link}</p>
    </>
  );
}

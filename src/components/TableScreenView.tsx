import { useLayoutEffect, useRef } from 'react';
import ServerSvg from '../assets/ServerSvg';
import { svgUrl } from '../assets/svgCache.ts';
import { joinLink } from '../services/share.ts';
import { fitScale } from './fitScale.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type TableScreenViewProps = {
  game: GameInfo;
  client: ClientGame;
  gameState: BasePublicState;
};

// A shared screen: the join code in the lobby, then the board alone, grown to fill the screen. It never shows a hand.
export default function TableScreenView({ game, client, gameState }: TableScreenViewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { HistoryBoard } = client;
  const { started, gameId, activePlayers, playerNames, gameStatus } = gameState;

  // offsetWidth and offsetHeight ignore the scale transform, so growing the board never feeds back into the measure
  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = boardRef.current;
    if (!box || !content) return undefined;
    const observer = new ResizeObserver(() => {
      const scale = fitScale({ width: content.offsetWidth, height: content.offsetHeight }, { width: box.clientWidth, height: box.clientHeight }, 4);
      content.style.setProperty('--fit-scale', String(scale));
      content.dataset.fitScale = String(scale);
    });
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [started]);

  if (!started) {
    const link = joinLink(window.location.origin, game.id, gameId);
    return (
      <div className="table-screen">
        <ServerSvg url={svgUrl('qr', link)} className="table-screen-qr" title={`QR code to join ${game.name} ${gameId}`} />
        <p className="table-screen-link">{link}</p>
        <ul className="table-screen-players">
          {activePlayers.map(seat => <li key={seat}>{playerNames[seat]}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="table-screen">
      <div className="table-screen-status">{gameStatus}</div>
      <div className="table-screen-board" ref={boxRef}>
        <div className="table-screen-board-content" ref={boardRef}>
          <HistoryBoard gameState={gameState} viewer={null} />
        </div>
      </div>
    </div>
  );
}

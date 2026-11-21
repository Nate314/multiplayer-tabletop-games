import { useId } from 'react';
import useEscapeKey from '../hooks/useEscapeKey';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { ControlItem } from '../clientGames.ts';

type ControlsDialogProps = {
  game: GameInfo;
  controls: ControlItem[];
  onClose: () => void;
};

export default function ControlsDialog({ game, controls, onClose }: ControlsDialogProps) {
  useEscapeKey(onClose);
  const titleId = useId();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal controls" role="dialog" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>{`${game.name} controls`}</h2>
        <p>Tab moves between buttons, and Enter or Space presses one.</p>
        <table>
          <thead>
            <tr><th scope="col">To</th><th scope="col">Mouse or touch</th><th scope="col">Keys</th></tr>
          </thead>
          <tbody>
            {controls.map(row => (
              <tr key={row.action}>
                <th scope="row">{row.action}</th>
                <td data-label="Mouse or touch">{row.pointer}</td>
                <td data-label="Keys">{row.keys}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

import gameService from '../../../src/services/gameService';
import { PALETTE, PALETTE_NAMES } from '../clock.ts';
import type { Pen } from './Canvas';

const SIZE_NAMES = ['Small', 'Medium', 'Large'];

type ToolbarProps = { pen: Pen; onChange: (pen: Pen) => void; canUndo: boolean };

// The drawer's colors, brush sizes and tools; picking a color while erasing goes back to the pen
export default function Toolbar({ pen, onChange, canUndo }: ToolbarProps) {
  return (
    <div className="pictionary-toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="tool-group">
        {PALETTE.map((color, index) => (
          <button
            key={color}
            type="button"
            className="tool-swatch"
            style={{ background: color }}
            aria-label={PALETTE_NAMES[index]}
            title={PALETTE_NAMES[index]}
            aria-pressed={pen.tool !== 'eraser' && pen.color === index}
            onClick={() => onChange({ ...pen, color: index, tool: pen.tool === 'eraser' ? 'pen' : pen.tool })}
          />
        ))}
      </div>
      <div className="tool-group">
        {SIZE_NAMES.map((name, size) => (
          <button
            key={name}
            type="button"
            className="tool-size"
            aria-label={name}
            title={name}
            aria-pressed={pen.size === size}
            onClick={() => onChange({ ...pen, size: size as Pen['size'] })}
          >
            <span className="tool-size-dot" style={{ width: 6 + size * 6, height: 6 + size * 6 }} />
          </button>
        ))}
      </div>
      <div className="tool-group">
        <button type="button" aria-pressed={pen.tool === 'eraser'} onClick={() => onChange({ ...pen, tool: pen.tool === 'eraser' ? 'pen' : 'eraser' })}>
          Eraser
        </button>
        <button type="button" aria-pressed={pen.tool === 'fill'} onClick={() => onChange({ ...pen, tool: pen.tool === 'fill' ? 'pen' : 'fill' })}>
          Fill
        </button>
        {/* Not "Undo", which is the vote to take back a move */}
        <button type="button" disabled={!canUndo} onClick={() => gameService.sendAction({ type: 'undoStroke' })}>Take back</button>
        <button type="button" disabled={!canUndo} onClick={() => gameService.sendAction({ type: 'clear' })}>Clear</button>
      </div>
    </div>
  );
}

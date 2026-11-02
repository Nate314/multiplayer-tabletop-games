import { useState } from 'react';
import { useDrag } from '../../../src/drag/useDrag.ts';
import { FLEET, randomFleet, shipCells } from '../fleet.ts';
import Grid from './Grid';
import { complete, emptyDraft, placeAt, rotate, type Draft } from './draft.ts';
import type { Cell, Ship } from '../types.ts';

type PlacementProps = {
  onConfirm: (ships: Ship[]) => void;
};

type Orientation = Ship['orientation'];

const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;

// The draft slot of the ship covering `cell`, or -1
const slotAt = (draft: Draft, cell: Cell) => draft.findIndex(ship => ship !== null && shipCells(ship).some(c => sameCell(c, cell)));

// 'cell-<row>-<col>', a grid square's data-drop target
function targetCell(target: string): Cell | null {
  const match = /^cell-(\d+)-(\d+)$/.exec(target);
  return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
}

// The fleet being placed: tap a ship then a square, or drag a ship onto a square; its top or left end goes there
export default function Placement({ onConfirm }: PlacementProps) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selected, setSelected] = useState<number | null>(null);
  const [trayOrientation, setTrayOrientation] = useState<Orientation>('across');
  const ships = complete(draft);

  const orientationOf = (index: number) => draft[index]?.orientation ?? trayOrientation;
  const tryPlace = (index: number, cell: Cell) => placeAt(draft, index, cell, orientationOf(index));

  const drag = useDrag({
    canLift: id => draft[Number(id)] === null,
    canDrop: (id, target) => {
      const cell = targetCell(target);
      return cell !== null && tryPlace(Number(id), cell) !== draft;
    },
    onLift: id => setSelected(Number(id)),
    onDrop: (id, target) => {
      setDraft(tryPlace(Number(id), targetCell(target)!));
      setSelected(Number(id));
    }
  });

  function onCell(cell: Cell) {
    const under = slotAt(draft, cell);
    if (under !== -1) {
      setSelected(under === selected ? null : under); // a tap on a ship picks it, or puts the picked one down
      return;
    }
    if (selected !== null) setDraft(tryPlace(selected, cell));
  }

  function onRotate() {
    if (selected !== null && draft[selected]) setDraft(rotate(draft, selected));
    else setTrayOrientation(trayOrientation === 'across' ? 'down' : 'across');
  }

  // While a ship is dragged over a square it fits, the squares it would take
  const dropCell = drag.dragging !== null && drag.over !== null ? targetCell(drag.over) : null;
  const preview = dropCell ? tryPlace(Number(drag.dragging), dropCell)[Number(drag.dragging)] : null;
  const picked = selected !== null ? draft[selected] : null;
  const marked = preview ? shipCells(preview) : picked ? shipCells(picked) : [];

  return (
    <div className="naval-placement">
      <Grid label="Your fleet" ships={draft.filter((ship): ship is Ship => ship !== null)} shots={[]} cells={marked} onCell={onCell} dropTarget />
      <div className={`ship-tray ship-tray-${trayOrientation}`}>
        {FLEET.map((length, index) => draft[index] === null && (
          <button
            key={index}
            type="button"
            className={selected === index ? 'tray-ship selected' : 'tray-ship'}
            aria-label={`A ship of length ${length}`}
            aria-pressed={selected === index}
            onClick={() => setSelected(selected === index ? null : index)}
            {...drag.source(String(index))}
          >
            {Array.from({ length }, (_, i) => <span key={i} className="tray-segment" />)}
          </button>
        ))}
      </div>
      <div className="placement-buttons">
        <button type="button" onClick={onRotate}>Rotate</button>
        <button type="button" onClick={() => { setDraft(randomFleet(Math.random)); setSelected(null); }}>Random placement</button>
        <button type="button" onClick={() => { setDraft(emptyDraft()); setSelected(null); }}>Clear</button>
        <button type="button" disabled={!ships} onClick={() => ships && onConfirm(ships)}>Confirm fleet</button>
      </div>
    </div>
  );
}

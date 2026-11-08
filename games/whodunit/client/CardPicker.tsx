import { useState } from 'react';
import { OBJECTS, ROOMS, SUSPECTS, nameOf } from '../content.ts';
import type { ObjectId, RoomId, SuspectId } from '../content.ts';
import type { Move } from '../types.ts';
import { trio } from './describeMove.ts';

type PickerProps = {
  room?: RoomId; // a suggestion names the room the suggester is in; an accusation picks one
  onMove: (move: Move) => void;
  onCancel: () => void;
};

type PickProps<T extends string> = { label: string; items: readonly { id: T; name: string }[]; value: T; onChange: (id: T) => void };

function Pick<T extends string>({ label, items, value, onChange }: PickProps<T>) {
  return (
    <label className="wd-pick">
      {label}
      <select value={value} onChange={event => onChange(event.target.value as T)}>
        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  );
}

// Suggest (room fixed) or accuse (three pickers, then a confirm, since a wrong accusation ends the player's turns)
export default function CardPicker({ room, onMove, onCancel }: PickerProps) {
  const [suspect, setSuspect] = useState<SuspectId>(SUSPECTS[0].id);
  const [object, setObject] = useState<ObjectId>(OBJECTS[0].id);
  const [where, setWhere] = useState<RoomId>(ROOMS[0].id);
  const [confirming, setConfirming] = useState(false);
  const accusing = room === undefined;

  if (confirming) {
    return (
      <div className="wd-picker" role="group" aria-label="Confirm accusation">
        <p>Accuse {trio({ suspect, object, room: where })}?</p>
        <div className="wd-buttons">
          <button type="button" className="wd-button" onClick={() => onMove({ type: 'accuse', suspect, object, room: where })}>Yes, accuse</button>
          <button type="button" className="wd-button wd-quiet" onClick={() => setConfirming(false)}>Back</button>
        </div>
      </div>
    );
  }
  return (
    <div className="wd-picker" role="group" aria-label={accusing ? 'Accusation' : 'Suggestion'}>
      <Pick label="Suspect" items={SUSPECTS} value={suspect} onChange={setSuspect} />
      <Pick label="Object" items={OBJECTS} value={object} onChange={setObject} />
      {accusing ? <Pick label="Room" items={ROOMS} value={where} onChange={setWhere} /> : <p className="wd-pick">Room: {nameOf(room)}</p>}
      <div className="wd-buttons">
        <button type="button" className="wd-button" onClick={() => (accusing ? setConfirming(true) : onMove({ type: 'suggest', suspect, object }))}>
          {accusing ? 'Make accusation' : 'Make suggestion'}
        </button>
        <button type="button" className="wd-button wd-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

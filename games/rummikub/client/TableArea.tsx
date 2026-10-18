import type { DragEvent } from 'react';
import Tile from './Tile';
import { allowDrop } from './dragDrop.ts';
import { analyzeGroup, tileName } from '../rules.ts';
import type { GroupInfo } from '../rules.ts';
import type { Held, Target } from './draft.ts';
import type { Table } from '../types.ts';

// What the player can do with the table during their turn
export type TableEditing = {
  held: Held | null;
  onTile: (id: number) => void;
  onTarget: (target: Target) => void;
  onPickGroup: (index: number) => void;
  onSplit: (index: number, at: number) => void;
  onDragStart: (event: DragEvent, held: Held) => void;
  onDrop: (event: DragEvent, target: Target) => void;
};

type TableAreaProps = {
  table: Table;
  highlighted: number[];
  edit?: TableEditing;
};

// What a joker stands for, from its place in the group: 'red 5' in a run, '7' in a set
function standsFor(group: GroupInfo | null, index: number): string | undefined {
  if (!group) return undefined;
  return group.kind === 'run' ? `${group.colors[index][0]} ${group.values[index]}` : `${group.values[index]}`;
}

// The table as rows of groups. While editing, tiles and groups can be picked up and put down,
// a group can be split between two tiles, and a group that is not a valid set or run is marked.
export default function TableArea({ table, highlighted, edit }: TableAreaProps) {
  const holding = edit?.held != null;
  return (
    <section className="rk-table" aria-label="Table">
      {table.length === 0 && !edit && <div className="rk-table-empty">No tiles on the table yet</div>}
      {table.map((ids, index) => {
        const group = analyzeGroup(ids);
        const classes = ['rk-group', group ? '' : 'rk-group-invalid', edit?.held?.kind === 'group' && edit.held.index === index ? 'rk-held' : ''];
        const label = `Group ${index + 1}`;
        return (
          <div
            key={index}
            className={classes.filter(Boolean).join(' ')}
            aria-label={group ? label : `${label} (not a valid set or run)`}
            role="group"
            onDragOver={edit && allowDrop}
            onDrop={edit && (event => edit.onDrop(event, { kind: 'groupEnd', index }))}
          >
            {edit && (
              <button
                type="button"
                className="rk-group-handle"
                aria-label={`Pick up ${label.toLowerCase()}`}
                title="Pick up the whole group"
                draggable
                onDragStart={event => edit.onDragStart(event, { kind: 'group', index })}
                onClick={() => edit.onPickGroup(index)}
              >
                ⠿
              </button>
            )}
            {ids.map((id, at) => {
              const face = <Tile id={id} standsFor={standsFor(group, at)} highlighted={highlighted.includes(id)} />;
              return (
                <span key={id} className="rk-slot">
                  {edit && at > 0 && !holding && (
                    <button
                      type="button"
                      className="rk-split"
                      aria-label={`Split ${label.toLowerCase()} before ${tileName(id)}`}
                      title="Split the group here"
                      onClick={() => edit.onSplit(index, at)}
                    />
                  )}
                  {edit ? (
                    <button
                      type="button"
                      className={edit.held?.kind === 'tile' && edit.held.id === id ? 'rk-tile-button rk-held' : 'rk-tile-button'}
                      aria-label={tileName(id)}
                      draggable
                      onDragStart={event => edit.onDragStart(event, { kind: 'tile', id })}
                      onDragOver={allowDrop}
                      onDrop={event => edit.onDrop(event, { kind: 'before', id })}
                      onClick={() => edit.onTile(id)}
                    >
                      {face}
                    </button>
                  ) : face}
                </span>
              );
            })}
            {edit && holding && (
              <button
                type="button"
                className="rk-group-end"
                aria-label={`Put at the end of ${label.toLowerCase()}`}
                onClick={() => edit.onTarget({ kind: 'groupEnd', index })}
              >
                +
              </button>
            )}
          </div>
        );
      })}
      {edit && (
        <button
          type="button"
          className={holding ? 'rk-new-group rk-new-group-ready' : 'rk-new-group'}
          disabled={!holding}
          onDragOver={allowDrop}
          onDrop={event => edit.onDrop(event, { kind: 'newGroup' })}
          onClick={() => edit.onTarget({ kind: 'newGroup' })}
        >
          New group
        </button>
      )}
    </section>
  );
}

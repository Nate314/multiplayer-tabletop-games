import Pickable from './Pickable';
import Tile from './Tile';
import { analyzeGroup, tileName } from '../rules.ts';
import type { GroupInfo } from '../rules.ts';
import type { Held, Target } from './draft.ts';
import type { Table } from '../types.ts';
import type { Drag } from '../../../src/drag/useDrag.ts';

// What the player can do with the table during their turn
export type TableEditing = {
  held: Held | null;
  onTile: (id: number) => void;
  onTarget: (target: Target) => void;
  onPickGroup: (index: number) => void;
  onSplit: (index: number, at: number) => void;
  drag: Drag; // sources "tile-<id>" and "group-<index>"; targets "before-<id>", "end-<index>" and "new"
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

// Hidden but still taking its space, so picking something up never moves anything on screen, even under a drag
function shown(visible: boolean): string {
  return visible ? '' : ' rk-hidden';
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
        const label = `group ${index + 1}`;
        return (
          <div
            key={index}
            className={classes.filter(Boolean).join(' ')}
            aria-label={group ? `Group ${index + 1}` : `Group ${index + 1} (not a valid set or run)`}
            role="group"
            data-drop={edit && `end-${index}`}
          >
            {edit && (
              <Pickable
                label={`Pick up ${label}`}
                title="Pick up the whole group"
                className="rk-group-handle"
                onActivate={() => edit.onPickGroup(index)}
                dragProps={edit.drag.source(`group-${index}`)}
              >
                ⠿
              </Pickable>
            )}
            {ids.map((id, at) => {
              const face = <Tile id={id} standsFor={standsFor(group, at)} highlighted={highlighted.includes(id)} />;
              return (
                <span key={id} className="rk-slot">
                  {edit && at > 0 && (
                    <button
                      type="button"
                      className={`rk-split${shown(!holding)}`}
                      aria-label={`Split ${label} before ${tileName(id)}`}
                      title="Split the group here"
                      onClick={() => edit.onSplit(index, at)}
                    />
                  )}
                  {edit ? (
                    <Pickable
                      label={tileName(id)}
                      className={edit.held?.kind === 'tile' && edit.held.id === id ? 'rk-tile-button rk-held' : 'rk-tile-button'}
                      onActivate={() => edit.onTile(id)}
                      dragProps={edit.drag.source(`tile-${id}`)}
                      dropId={`before-${id}`}
                    >
                      {face}
                    </Pickable>
                  ) : face}
                </span>
              );
            })}
            {edit && (
              <button
                type="button"
                className={`rk-group-end${shown(holding)}`}
                aria-label={`Put at the end of ${label}`}
                data-drop={`end-${index}`}
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
          aria-disabled={!holding}
          data-drop="new"
          onClick={() => edit.onTarget({ kind: 'newGroup' })}
        >
          New group
        </button>
      )}
    </section>
  );
}

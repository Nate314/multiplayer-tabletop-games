import { useCallback, useRef, useState } from 'react';
import useDismiss from '../hooks/useDismiss.ts';
import { CATEGORIES } from '../../shared/categories.ts';
import { activeFilterCount, clearFilters, hasActiveFilters, parsePlayers } from './gameFilters.ts';
import type { GameSort, LandingFilters } from './gameFilters.ts';

type GameFiltersProps = {
  filters: LandingFilters;
  onChange: (filters: LandingFilters) => void;
};

// The search box, and a Filter button whose panel holds sort, categories, Players and Clear filters.
// A press anywhere else, or Escape, closes the panel; changing a filter leaves it open.
export default function GameFilters({ filters, onChange }: GameFiltersProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    // Escape from inside the panel hands focus back to the button rather than dropping it on the page
    if (wrapperRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    setOpen(false);
  }, []);
  useDismiss(wrapperRef, open, close);
  const toggle = (id: LandingFilters['categories'][number]) =>
    onChange({ ...filters, categories: filters.categories.includes(id) ? filters.categories.filter(c => c !== id) : [...filters.categories, id] });
  const count = activeFilterCount(filters);
  return (
    <div className="lobby-filters" ref={wrapperRef}>
      <input
        type="search"
        className="themed-input"
        aria-label="Search games"
        placeholder="Search games"
        value={filters.search}
        onChange={event => onChange({ ...filters, search: event.target.value })}
      />
      <button
        ref={buttonRef}
        type="button"
        className="lobby-button"
        aria-expanded={open}
        aria-controls="lobby-filter-panel"
        onClick={() => setOpen(o => !o)}
      >
        {count === 0 ? 'Filter' : `Filter (${count})`}
      </button>
      {open && (
        <div id="lobby-filter-panel" className="lobby-filter-panel" role="group" aria-label="Filters">
          <select
            autoFocus
            className="themed-select"
            aria-label="Sort"
            value={filters.sort}
            onChange={event => onChange({ ...filters, sort: event.target.value as GameSort })}
          >
            <option value="category">By category</option>
            <option value="name">A to Z</option>
          </select>
          <div role="group" aria-label="Categories" className="lobby-chips">
            {CATEGORIES.map(({ id, name }) => (
              <button key={id} type="button" className="themed-chip" aria-pressed={filters.categories.includes(id)} onClick={() => toggle(id)}>{name}</button>
            ))}
          </div>
          <label className="lobby-players">
            Players
            <input
              type="number"
              className="themed-input"
              min={1}
              max={99}
              inputMode="numeric"
              placeholder="Any"
              value={filters.players ?? ''}
              onChange={event => {
                const text = event.target.value;
                if (text === '' || parsePlayers(text) !== null) onChange({ ...filters, players: parsePlayers(text) });
              }}
            />
          </label>
          {hasActiveFilters(filters) && (
            <button type="button" className="lobby-button" onClick={() => onChange(clearFilters(filters))}>Clear filters</button>
          )}
        </div>
      )}
    </div>
  );
}

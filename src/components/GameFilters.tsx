import { CATEGORIES } from '../../shared/categories.ts';
import { DEFAULT_FILTERS, hasActiveFilters, parsePlayers } from './gameFilters.ts';
import type { GameSort, LandingFilters } from './gameFilters.ts';

type GameFiltersProps = {
  filters: LandingFilters;
  onChange: (filters: LandingFilters) => void;
};

export default function GameFilters({ filters, onChange }: GameFiltersProps) {
  const toggle = (id: LandingFilters['categories'][number]) =>
    onChange({ ...filters, categories: filters.categories.includes(id) ? filters.categories.filter(c => c !== id) : [...filters.categories, id] });
  return (
    <div className="lobby-filters">
      <input
        type="search"
        className="themed-input"
        aria-label="Search games"
        placeholder="Search games"
        value={filters.search}
        onChange={event => onChange({ ...filters, search: event.target.value })}
      />
      <select className="themed-select" aria-label="Sort" value={filters.sort} onChange={event => onChange({ ...filters, sort: event.target.value as GameSort })}>
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
          onChange={event => onChange({ ...filters, players: parsePlayers(event.target.value) })}
        />
      </label>
      {hasActiveFilters(filters) && (
        <button type="button" className="lobby-button" onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}>Clear filters</button>
      )}
    </div>
  );
}

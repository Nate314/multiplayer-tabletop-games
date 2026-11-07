import { useState } from 'react';
import gameService from '../../../src/services/gameService';

const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function ClueForm({ error }: { error: string | null }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  return (
    <form className="clue-form" onSubmit={(e) => { e.preventDefault(); gameService.makeMove({ type: 'clue', word, count }); }}>
      <label>Clue <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={30} autoComplete="off" /></label>
      <label>Number
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button type="submit" disabled={word.trim() === ''}>Give clue</button>
      {error && <div className="game-status game-status-error" role="alert">{error}</div>}
    </form>
  );
}

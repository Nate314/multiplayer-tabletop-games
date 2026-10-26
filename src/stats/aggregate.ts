import type { StatsGame } from '../../shared/stats.ts';

export type StatsFilter = { gameType: string | null; range: 'month' | 'all' };

export const FORMER_PLAYER = 'Former player';
const MINUTE = 60_000;

const keyOf = (name: string) => name.trim().toLowerCase();
const newestFirst = (games: StatsGame[]) => [...games].sort((a, b) => b.finishedAt - a.finishedAt);
// The number a score starts with, e.g. 301 from '301 points'; null when it has none
const leadingNumber = (score: string | undefined) => {
  const match = score?.match(/^\s*-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

// `month`: since the first of this calendar month, local time
export function filterGames(games: StatsGame[], { gameType, range }: StatsFilter, now: number): StatsGame[] {
  const today = new Date(now);
  const since = range === 'month' ? new Date(today.getFullYear(), today.getMonth(), 1).getTime() : -Infinity;
  return games.filter(game => (gameType === null || game.gameType === gameType) && game.finishedAt >= since);
}

// One row per name (ignoring case), in the spelling of its most recent game; a win is place 1
export function peopleStats(games: StatsGame[]) {
  const people = new Map<string, { name: string; games: number; wins: number; streak: number; streakOver: boolean; played: Map<string, number> }>();
  for (const game of newestFirst(games)) {
    for (const player of game.players) {
      if (player.name === FORMER_PLAYER) continue;
      const key = keyOf(player.name);
      const person = people.get(key) ?? { name: player.name, games: 0, wins: 0, streak: 0, streakOver: false, played: new Map() };
      people.set(key, person);
      const won = player.place === 1;
      person.games++;
      if (won) person.wins++;
      if (won && !person.streakOver) person.streak++;
      else person.streakOver = true;
      person.played.set(game.gameType, (person.played.get(game.gameType) ?? 0) + 1);
    }
  }
  // The map keeps the newest game first, so the first most played type wins a tie
  return [...people.values()].map(({ name, games, wins, streak, played }) => ({
    name, games, wins, winRate: wins / games, streak,
    favoriteGame: [...played].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]
  }));
}

export function gameStats(games: StatsGame[]) {
  const byType = new Map<string, StatsGame[]>();
  for (const game of newestFirst(games)) byType.set(game.gameType, [...(byType.get(game.gameType) ?? []), game]);
  return [...byType].map(([gameType, played]) => {
    const lengths = played.map(game => game.finishedAt - game.startedAt).sort((a, b) => a - b);
    const middle = lengths.length / 2;
    const median = lengths.length % 2 ? lengths[Math.floor(middle)] : (lengths[middle - 1] + lengths[middle]) / 2;
    // A high score means something only where the winner always holds the largest score (not Hearts)
    let highScore: { score: number; name: string } | undefined;
    const winnerLeadsEvery = played.every(game => {
      const scores = game.players.map(player => leadingNumber(player.score));
      if (scores.some(score => score === null)) return false;
      const top = Math.max(...(scores as number[]));
      game.players.forEach((player, index) => {
        if (scores[index] === top && (!highScore || top > highScore.score)) highScore = { score: top, name: player.name };
      });
      return game.players.some((player, index) => player.place === 1 && scores[index] === top);
    });
    return { gameType, played: played.length, usualMinutes: Math.round(median / MINUTE), ...(winnerLeadsEvery && highScore ? { highScore } : {}) };
  });
}

// Over the games both names played; `other` counts games neither of the two won
export function headToHead(games: StatsGame[], a: string, b: string) {
  const result = { games: 0, aWins: 0, bWins: 0, other: 0 };
  for (const game of games) {
    const placeOf = (name: string) => game.players.find(player => keyOf(player.name) === keyOf(name))?.place;
    const aPlace = placeOf(a);
    const bPlace = placeOf(b);
    if (aPlace === undefined || bPlace === undefined) continue;
    result.games++;
    // A shared first place is a win for neither
    if (aPlace === 1 && bPlace !== 1) result.aWins++;
    else if (bPlace === 1 && aPlace !== 1) result.bWins++;
    else result.other++;
  }
  return result;
}

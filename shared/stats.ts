// One finished game as a device's stats page lists it; `you` marks the seats of that device's person
export type StatsGame = {
  archiveId: string; gameType: string; gameId: string; startedAt: number; finishedAt: number; moveCount: number;
  historyAvailable: boolean;
  players: { name: string; place: number; score?: string; you: boolean }[];
};

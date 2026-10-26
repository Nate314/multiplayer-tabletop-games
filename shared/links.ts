// serveClient answers 404 for any path with an extension, so a "." in the ID is written as %2E
export function joinLink(origin: string, gameType: string, gameId: string): string {
  return `${origin}/join/${encodeURIComponent(gameType)}/${encodeURIComponent(gameId).replaceAll('.', '%2E')}`;
}

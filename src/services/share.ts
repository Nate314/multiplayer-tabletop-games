export type JoinLink = { gameType: string; gameId: string };
export type ShareTarget = { share?: (data: ShareData) => Promise<void>; clipboard?: { writeText(text: string): Promise<void> } };
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual';

// serveClient answers 404 for any path with an extension, so a "." in the ID is written as %2E
export function joinLink(origin: string, gameType: string, gameId: string): string {
  return `${origin}/join/${encodeURIComponent(gameType)}/${encodeURIComponent(gameId).replaceAll('.', '%2E')}`;
}

export function parseJoinLink(pathname: string, gameTypes: readonly string[]): JoinLink | null {
  const match = /^\/join\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    const gameType = decodeURIComponent(match[1]);
    const gameId = decodeURIComponent(match[2]);
    return gameTypes.includes(gameType) && gameId ? { gameType, gameId } : null;
  } catch {
    return null; // malformed % escape
  }
}

// The share sheet first, then the clipboard; 'manual' means the caller should show the link to copy by hand
export async function shareGame(target: ShareTarget, data: { title: string; url: string }): Promise<ShareResult> {
  if (target.share) {
    try {
      await target.share(data);
      return 'shared';
    } catch (error) {
      // AbortError: dismissed. InvalidStateError: tapped again while the sheet was already open.
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError' || name === 'InvalidStateError') return 'cancelled';
    }
  }
  try {
    await target.clipboard?.writeText(data.url);
    return target.clipboard ? 'copied' : 'manual';
  } catch {
    return 'manual';
  }
}

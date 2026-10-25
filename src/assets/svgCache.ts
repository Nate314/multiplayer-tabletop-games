// The markup of every server SVG this page has loaded, by URL. A URL's drawing never changes, so it is kept for the
// life of the page; a failure is not kept, so the next piece that asks tries again
const loaded = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();

// For useSyncExternalStore: every ServerSvg on the page re-reads its URL when any drawing arrives
export function subscribeSvgs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function svgUrl(name: string, ...params: (string | number)[]): string {
  return ['/api/svg', name, ...params.map(param => encodeURIComponent(String(param)))].join('/');
}

export function cachedSvg(url: string): string | undefined {
  return loaded.get(url);
}

export function loadSvg(url: string): Promise<string> {
  const done = loaded.get(url);
  if (done !== undefined) return Promise.resolve(done);
  let promise = pending.get(url);
  if (!promise) {
    promise = fetch(url)
      .then(async response => {
        if (!response.ok) throw new Error(`${url} answered ${response.status}`);
        const markup = await response.text();
        loaded.set(url, markup);
        listeners.forEach(listener => listener());
        return markup;
      })
      .finally(() => pending.delete(url));
    pending.set(url, promise);
  }
  return promise;
}

// A game screen calls this on mount with every piece it may show, so none of them shows up blank mid-game
export async function preloadSvgs(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map(loadSvg));
}

export function clearSvgCache(): void {
  loaded.clear();
  pending.clear();
}

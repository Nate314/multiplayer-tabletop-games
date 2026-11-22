import { useCallback, useState } from 'react';

// Text for a polite live region, and a way to say something. Every other message gets a trailing non-breaking space,
// so the same message twice still changes the region and is read out again
export default function useAnnouncer(): [string, (text: string) => void] {
  const [said, setSaid] = useState({ text: '', count: 0 });
  const say = useCallback((text: string) => setSaid(({ count }) => ({ text, count: count + 1 })), []);
  return [said.count % 2 ? `${said.text}\u00a0` : said.text, say];
}

import { useContext } from 'react';
import { WatchingContext } from './WatchingContext.ts';

export default function YouTag({ when, className }: { when: boolean; className?: string }) {
  const watching = useContext(WatchingContext);
  if (!when || watching) return null;
  return className ? <> <span className={className}>(you)</span></> : <> (you)</>;
}

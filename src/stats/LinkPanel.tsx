import { useEffect, useState } from 'react';
import ServerSvg from '../assets/ServerSvg';
import { svgUrl } from '../assets/svgCache.ts';
import { postStats } from './api.ts';

type Issued = { code: string; expiresAt: number };

const countdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// A one-use code another device opens to join this device's stats; it goes back to the button once it expires
export default function LinkPanel() {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!issued) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= issued.expiresAt) setIssued(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [issued]);

  async function issue() {
    setFailed(false);
    try {
      const answer = await postStats<Issued>('/link-code');
      setNow(Date.now());
      setIssued(answer);
    } catch {
      setFailed(true);
    }
  }

  if (!issued) {
    return (
      <section className="stats-section">
        <button type="button" className="lobby-button" onClick={issue}>Link another device</button>
        {failed && <p className="lobby-error" role="alert">Could not get a code</p>}
      </section>
    );
  }

  const link = `${window.location.origin}/link/${issued.code}`;
  return (
    <section className="stats-section stats-link">
      <h2 className="lobby-category-heading">Link another device</h2>
      <p>Open this link or enter the code on the other device. It works once, for 10 minutes.</p>
      <p className="stats-link-code">{issued.code}</p>
      <a className="stats-link-url" href={link}>{link}</a>
      <ServerSvg url={svgUrl('qr', link)} className="stats-link-qr" title={`QR code to link a device with ${issued.code}`} />
      <p className="stats-link-countdown">{`Expires in ${countdown(issued.expiresAt - now)}`}</p>
    </section>
  );
}

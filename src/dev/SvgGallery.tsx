import { useEffect, useState } from 'react';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';
import ThemeToggle from '../components/ThemeToggle.tsx';
import './dev.scss';

type Listing = { name: string; params: string[]; samples: string[][] }[];

// Hidden page at /dev/svgs: every drawing the server offers, each sample side by side, to compare them in both themes
export default function SvgGallery() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/svg')
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then(setListing, () => setError(true));
  }, []);

  return (
    <div className="lobby dev-page">
      <header className="lobby-header">
        <h1>Server SVGs</h1>
        <ThemeToggle />
      </header>
      {error && <p className="lobby-error">Could not load the list of SVGs</p>}
      {listing?.map(({ name, params, samples }) => (
        <section key={name} className="dev-section">
          <h2>{name}{params.length > 0 && <span className="dev-params"> / {params.join(' / ')}</span>}</h2>
          {/* A game's pieces read its variables, so each card sits inside that game's scope */}
          <div className="dev-grid" data-game={name.split('-')[0]}>
            {(samples.length ? samples : [[]]).map(sample => {
              const url = svgUrl(name, ...sample);
              return (
                <figure key={url} className="dev-card">
                  <ServerSvg url={url} className="dev-card-svg" />
                  <figcaption className="dev-card-url">{url}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

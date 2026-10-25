import { useEffect, useState, useSyncExternalStore, type SVGProps } from 'react';
import { cachedSvg, loadSvg, subscribeSvgs } from './svgCache.ts';

type ServerSvgProps = {
  url: string;
  className?: string;
  title?: string; // the piece's name: its accessible label, and the text shown if the drawing fails to load
  inSvg?: boolean; // inside an <svg> board: renders a nested <svg>, placed and sized through svgProps
  svgProps?: SVGProps<SVGSVGElement>;
};

// Shows a drawing from /api/svg inline, so the page's CSS variables, theme and currentColor still paint it.
// Before it loads the element is already there, empty, at the size the caller's class gives it, so nothing jumps.
export default function ServerSvg({ url, className, title, inSvg, svgProps }: ServerSvgProps) {
  const markup = useSyncExternalStore(subscribeSvgs, () => cachedSvg(url));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (cachedSvg(url) !== undefined) return undefined;
    let live = true;
    loadSvg(url).catch(() => {
      if (live) setFailedUrl(url);
    });
    return () => {
      live = false;
    };
  }, [url]);

  const classes = ['server-svg', className].filter(Boolean).join(' ');
  const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const };
  // Safe to inline: the markup only ever comes from this site's own /api/svg, drawn by server code that escapes
  // every attribute and text it writes
  const inner = markup === undefined ? undefined : { __html: markup };
  const failed = markup === undefined && failedUrl === url && title;

  if (inSvg) {
    return (
      <svg {...svgProps} className={classes} {...label} dangerouslySetInnerHTML={inner}>
        {failed ? <title>{title}</title> : undefined}
      </svg>
    );
  }
  return (
    <span className={classes} {...label} dangerouslySetInnerHTML={inner}>
      {failed ? <span className="server-svg-fallback">{title}</span> : undefined}
    </span>
  );
}

import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';

export const REPO_URL = 'https://github.com/Nate314/multiplayer-tabletop-games';

export default function GitHubLink() {
  return (
    <a
      className="github-link"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View source on GitHub"
    >
      <ServerSvg url={svgUrl('icon', 'github')} className="header-icon" />
    </a>
  );
}

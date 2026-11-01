import { el, type SvgAsset } from './svg.ts';
import { lineIcon, rocketIcon, solid } from './icons.ts';

const pip = (cx: number, cy: number, r = 1.1) => solid('circle', { cx, cy, r });
const label = (text: string, x: number, y: number, size: number) =>
  el('text', { x, y, 'font-size': size, 'font-weight': 700, 'font-family': 'sans-serif', 'text-anchor': 'middle', fill: 'currentColor', stroke: 'none' }, text);

// One outline drawing per game for the landing page, in currentColor
const GAME_ICONS: Record<string, () => string> = {
  azul: () => lineIcon(el('path', { d: 'M12 3l9 9-9 9-9-9z' }), solid('path', { d: 'M12 8l4 4-4 4-4-4z' })),
  backgammon: () => lineIcon(el('rect', { x: 3, y: 4, width: 18, height: 16, rx: 1.5 }),
    el('path', { d: 'M5.5 4l2 6.5 2-6.5M14.5 4l2 6.5 2-6.5M5.5 20l2-6.5 2 6.5M14.5 20l2-6.5 2 6.5' })),
  carcassonne: () => lineIcon(el('path', { d: 'M4 21V6h3v3h3V6h4v3h3V6h3v15z' }), el('path', { d: 'M10 21v-4a2 2 0 0 1 4 0v4' })),
  catan: () => lineIcon(el('path', { d: 'M12 2l8.7 5v10L12 22l-8.7-5V7z' }), el('circle', { cx: 12, cy: 12, r: 3.5 })),
  checkers: () => lineIcon(el('ellipse', { cx: 12, cy: 8, rx: 8, ry: 3 }), el('path', { d: 'M4 8v4a8 3 0 0 0 16 0V8M4 12v4a8 3 0 0 0 16 0v-4' })),
  chinesecheckers: () => lineIcon(el('path', { d: 'M12 2l2.9 5h5.8l-2.9 5 2.9 5h-5.8L12 22l-2.9-5H3.3l2.9-5-2.9-5h5.8z' }), pip(12, 12, 1.6)),
  chess: () => lineIcon(el('path', { d: 'M12 2v5M9.5 4.5h5M8 10h8l-1.5 8h-5zM6 21h12v-3H6zM8 10a4 3 0 0 1 8 0' })),
  // A row of four pegs over two small answer pegs
  codebreaker: () => lineIcon(...[4.5, 9.5, 14.5, 19.5].map(x => el('circle', { cx: x, cy: 9, r: 2.2 })), pip(9.5, 16.5, 1.4), el('circle', { cx: 14.5, cy: 16.5, r: 1.4 })),
  connectfour: () => lineIcon(el('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
    ...[7.5, 12, 16.5].flatMap(x => [el('circle', { cx: x, cy: 9.5, r: 1.6 }), x === 12 ? solid('circle', { cx: x, cy: 14.5, r: 1.6 }) : el('circle', { cx: x, cy: 14.5, r: 1.6 })])),
  dominoes: () => lineIcon(el('rect', { x: 7, y: 2, width: 10, height: 20, rx: 2 }), el('path', { d: 'M7 12h10' }),
    pip(10, 5.5), pip(14, 8.5), pip(10, 15), pip(12, 17), pip(14, 19)),
  euchre: () => lineIcon(el('rect', { x: 3.5, y: 5, width: 10, height: 14, rx: 1.5, transform: 'rotate(-12 8.5 12)' }),
    el('rect', { x: 10, y: 4, width: 10, height: 14, rx: 1.5, transform: 'rotate(10 15 11)' }), label('J', 15, 14, 7)),
  farkle: () => lineIcon(el('path', { d: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z' })),
  go: () => lineIcon(el('path', { d: 'M4 8h16M4 16h16M8 4v16M16 4v16' }), solid('circle', { cx: 8, cy: 8, r: 2.5 }), el('circle', { cx: 16, cy: 16, r: 2.5 })),
  gofish: () => lineIcon(el('path', { d: 'M6 12c2.5-3.5 6-5 9-5s6 2.5 7 5c-1 2.5-4 5-7 5s-6.5-1.5-9-5zM6 12L2 8v8z' }), pip(17, 11, 0.9)),
  hearts: () => lineIcon(solid('path', { d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z' })),
  holdem: () => lineIcon(el('circle', { cx: 12, cy: 12, r: 9 }), el('circle', { cx: 12, cy: 12, r: 5 }), el('path', { d: 'M12 3v4M12 17v4M3 12h4M17 12h4' })),
  // Three courses of bricks, the middle one pulled halfway out to the right
  jenga: () => lineIcon(el('path', { d: 'M3 3h14v6H3zM7.7 3v6M12.3 3v6M7 9h14v6H7zM3 15h14v6H3zM7.7 15v6M12.3 15v6' })),
  // One piece with a tab on top and on the right
  jigsaw: () => lineIcon(el('path', { d: 'M4 8h4a2.2 2.2 0 1 1 4 0h4v4a2.2 2.2 0 1 1 0 4v4H4z' })),
  mancala: () => lineIcon(el('rect', { x: 2, y: 7, width: 20, height: 10, rx: 5 }),
    ...[8.5, 12, 15.5].flatMap(x => [el('circle', { cx: x, cy: 10.2, r: 1.2 }), el('circle', { cx: x, cy: 13.8, r: 1.2 })])),
  monopoly: () => lineIcon(el('path', { d: 'M3 18c0 1.5 4 2.5 9 2.5s9-1 9-2.5M6 18.5V6c0-1 2.7-2 6-2s6 1 6 2v12.5M6 14c2 .7 4 1 6 1s4-.3 6-1' })),
  naval: () => lineIcon(el('path', { d: 'M2 15h20l-3 5H5z' }), el('path', { d: 'M12 15V3l6 9h-6' })),
  parchisi: () => lineIcon(el('path', { d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' }), el('path', { d: 'M12 9l3 3-3 3-3-3z' })),
  phase10: () => lineIcon(el('rect', { x: 5, y: 3, width: 14, height: 18, rx: 2 }), label('10', 12, 15.5, 9)),
  pictionary: () => lineIcon(el('path', { d: 'M3 21l3.5-1 11-11-2.5-2.5-11 11zM14 5.5l2.5 2.5M3 15c2-3 4 1 6-2' })),
  quoridor: () => lineIcon(el('circle', { cx: 12, cy: 6, r: 3 }), el('path', { d: 'M9.5 11h5l1.5 7H8zM6 21h12v-3H6z' })),
  racko: () => lineIcon(el('path', { d: 'M4 21v-5M9 21v-9M14 21v-13M19 21V3' })),
  risk: () => lineIcon(el('circle', { cx: 12, cy: 12, r: 9 }), el('ellipse', { cx: 12, cy: 12, rx: 4, ry: 9 }), el('path', { d: 'M3 12h18' })),
  rook: () => lineIcon(el('path', { d: 'M3 16c4 0 6-2 7-5s3-6 7-6c2 0 3 1 3.5 2l2 1-2 1c0 6-4 10-10 10H7l2-3c-2.5 0-4.5-.5-6-1z' }), pip(17, 7, 0.8)),
  rummikub: () => lineIcon(el('rect', { x: 6, y: 3, width: 12, height: 18, rx: 2 }), label('7', 12, 14, 9), el('circle', { cx: 12, cy: 17.5, r: 1 })),
  scrabble: () => lineIcon(el('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }), label('A', 11, 16.5, 12), label('1', 17.5, 19, 5)),
  skipbo: () => lineIcon(el('rect', { x: 8, y: 3, width: 12, height: 16, rx: 1.5 }), el('path', { d: 'M5 6v13a2 2 0 0 0 2 2h9' })),
  snakesladders: () => lineIcon(el('path', { d: 'M5 21V3M10 21V3M5 8h5M5 13h5M5 18h5' }), el('path', { d: 'M20 3c-4 2 0 5-3 8s1 6-3 10' })),
  spades: () => lineIcon(solid('path', { d: 'M12 2C9 6 4 9 4 13a4 4 0 0 0 7 2.6L10 21h4l-1-5.4A4 4 0 0 0 20 13c0-4-5-7-8-11z' })),
  splendor: () => lineIcon(el('path', { d: 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 6 3-6M8 9l4 12 4-12' })),
  sudoku: () => lineIcon(el('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }), el('path', { d: 'M9 3v18M15 3v18M3 9h18M3 15h18' }), label('5', 12, 14.5, 6)),
  thecrew: rocketIcon,
  tickettoride: () => lineIcon(el('rect', { x: 5, y: 3, width: 14, height: 14, rx: 3 }), el('rect', { x: 7.5, y: 6, width: 9, height: 4.5, rx: 1 }),
    pip(9, 14), pip(15, 14), el('path', { d: 'M8 17l-2 4M16 17l2 4' })),
  tictactoe: () => lineIcon(el('path', { d: 'M9 3v18M15 3v18M3 9h18M3 15h18M10.5 10.5l3 3M13.5 10.5l-3 3' })),
  // A # grid with a small, thinner # in each of its nine boards
  ultimatetictactoe: () => lineIcon(el('path', { d: 'M9 3v18M15 3v18M3 9h18M3 15h18' }), el('path', { 'stroke-width': 0.8,
    d: [6, 12, 18].flatMap(x => [6, 12, 18].map(y => `M${x - 1} ${y - 2}v4M${x + 1} ${y - 2}v4M${x - 2} ${y - 1}h4M${x - 2} ${y + 1}h4`)).join('') })),
  uno: () => lineIcon(el('rect', { x: 6, y: 3, width: 12, height: 18, rx: 2 }), el('ellipse', { cx: 12, cy: 12, rx: 3.5, ry: 6.5, transform: 'rotate(30 12 12)' })),
  war: () => lineIcon(el('path', { d: 'M4 4l11 11M20 4L9 15M12.5 17.5l5-5M6.5 12.5l5 5M16 16l4 4M8 16l-4 4' })),
  yahtzee: () => lineIcon(el('rect', { x: 3, y: 10, width: 10, height: 10, rx: 2 }), pip(6, 13), pip(10, 17),
    el('rect', { x: 12, y: 3, width: 9, height: 9, rx: 2 }), pip(14.5, 5.5), pip(16.5, 7.5), pip(18.5, 9.5)),
};

export function gameIconSvg(game: string): string | null {
  return Object.hasOwn(GAME_ICONS, game) ? GAME_ICONS[game]() : null;
}

export const GAME_ICON_GAMES = Object.keys(GAME_ICONS);

export const GAME_ICON_ASSETS: SvgAsset[] = [
  { name: 'game-icon', params: ['game'], samples: GAME_ICON_GAMES.map(game => [game]), render: ([game]) => gameIconSvg(game) },
];

import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';
import { PICTURE_H, PICTURE_W, PICTURES } from './pictures.ts';

// The eight built-in pictures, drawn on the server in a flat style with fixed colors (never CSS variables or
// currentColor: pieces show them through an SVG <image>, where page CSS does not reach). Every picture keeps detail
// across the whole frame so each piece of a 150 piece grid has something to match. Only the server imports this file

const W = PICTURE_W, H = PICTURE_H;

// Small deterministic generator so each picture is the same on every request
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Extra = Record<string, string | number>;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Extra = {}) => el('rect', { x, y, width: w, height: h, fill, ...extra });
const circle = (cx: number, cy: number, r: number, fill: string, extra: Extra = {}) => el('circle', { cx, cy, r, fill, ...extra });
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra: Extra = {}) => el('ellipse', { cx, cy, rx, ry, fill, ...extra });
const path = (d: string, fill: string, extra: Extra = {}) => el('path', { d, fill, ...extra });
const poly = (points: number[][], fill: string, extra: Extra = {}) => el('polygon', { points: points.map(p => p.join(',')).join(' '), fill, ...extra });
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width: number, extra: Extra = {}) =>
  el('line', { x1, y1, x2, y2, stroke, 'stroke-width': width, 'stroke-linecap': 'round', ...extra });
const stroked = (d: string, stroke: string, width: number, extra: Extra = {}) => path(d, 'none', { stroke, 'stroke-width': width, 'stroke-linecap': 'round', ...extra });
const group = (attrs: Extra, ...children: string[]) => el('g', attrs, ...children);

// A gradient definition; the frame is filled with `url(#id)`
const gradient = (id: string, colors: string[], x2 = 0, y2 = 1) =>
  el('defs', {}, el('linearGradient', { id, x1: 0, y1: 0, x2, y2 },
    ...colors.map((stop, i) => el('stop', { offset: `${Math.round((i / (colors.length - 1)) * 100)}%`, 'stop-color': stop }))));

const cloud = (x: number, y: number, s: number, fill: string) => group({ transform: `translate(${x} ${y}) scale(${s})` },
  ellipse(0, 0, 90, 28, fill), ellipse(-40, -16, 44, 30, fill), ellipse(18, -28, 52, 38, fill), ellipse(60, -8, 38, 24, fill));

const clouds = (seed: number, count: number, yMin: number, yMax: number, fill: string) => {
  const r = rng(seed);
  return range(count).map(i => cloud(((i + r() * 0.6) / count) * (W + 200) - 100, yMin + r() * (yMax - yMin), 0.6 + r() * 0.9, fill)).join('');
};

const pine = (x: number, base: number, h: number, fill: string, trunk: string, opacity = 1) => group({ opacity },
  rect(x - h * 0.04, base - h * 0.15, h * 0.08, h * 0.15, trunk),
  poly([[x, base - h], [x - h * 0.28, base - h * 0.5], [x + h * 0.28, base - h * 0.5]], fill),
  poly([[x, base - h * 0.75], [x - h * 0.36, base - h * 0.25], [x + h * 0.36, base - h * 0.25]], fill),
  poly([[x, base - h * 0.5], [x - h * 0.44, base - h * 0.1], [x + h * 0.44, base - h * 0.1]], fill));

const flower = (x: number, y: number, r: number, petal: string, heart: string) => group({},
  ...range(5).map(i => circle(x + Math.cos((i * Math.PI * 2) / 5) * r, y + Math.sin((i * Math.PI * 2) / 5) * r, r * 0.8, petal)), circle(x, y, r * 0.7, heart));

// Fruit and pizza sit on the same red check tablecloth
const checkCloth = (dark: string) => range(12).map(row => range(18).map(col => ((row + col) % 2 ? rect(col * 80, row * 80, 80, 80, dark) : '')).join('')).join('');

const snowCap = (x: number, y: number) => poly([[x, y], [x - 50, y + 70], [x - 15, y + 58], [x + 10, y + 85], [x + 40, y + 55], [x + 60, y + 72]], '#f4f8ff');

function mountains(): string {
  const r = rng(11);
  const ripples = range(26).map(i => {
    const x = r() * W;
    return line(x, 650 + i * 7, x + 60 + r() * 220, 650 + i * 7, i % 2 ? '#a9d6e5' : '#e8f4f8', 4 + r() * 4);
  }).join('');
  const firs = range(36).map(i => pine(20 + i * 41 + r() * 14, 640, 90 + r() * 70, i % 2 ? '#1f5f3d' : '#2d7a4f', '#4a3424')).join('');
  const meadow = range(40).map(() => flower(r() * W, 800 + r() * 150, 7 + r() * 4, r() < 0.5 ? '#fff4d6' : '#ffd166', '#e76f51')).join('');
  const rocks = range(9).map(i => ellipse(60 + i * 170 + r() * 60, 770 + r() * 30, 40 + r() * 30, 18 + r() * 8, i % 2 ? '#8d99ae' : '#6b7a8f')).join('');
  return svgDoc(`0 0 ${W} ${H}`, {},
    gradient('sky', ['#4a90d9', '#8fc4ee', '#fde9c9']), rect(0, 0, W, 660, 'url(#sky)'),
    circle(1130, 190, 80, '#fff1b8'), circle(1130, 190, 52, '#ffd95a'),
    clouds(3, 9, 70, 330, '#ffffff'),
    poly([[0, 560], [160, 330], [260, 440], [430, 250], [600, 470], [780, 300], [960, 480], [1150, 280], [1300, 430], [1440, 340], [1440, 660], [0, 660]], '#7b8fb8'),
    snowCap(430, 250), snowCap(1150, 280), snowCap(780, 300), snowCap(160, 330),
    poly([[0, 640], [200, 470], [380, 600], [560, 450], [760, 620], [980, 480], [1180, 610], [1440, 450], [1440, 700], [0, 700]], '#4e6a94'),
    rect(0, 620, W, 30, '#2d7a4f'), firs,
    gradient('lake', ['#5aa9c9', '#2f7fa6', '#1d5c82']), rect(0, 640, W, 190, 'url(#lake)'), ripples,
    path(`M0,820 Q360,770 720,805 T1440,790 L1440,${H} L0,${H} Z`, '#6aa84f'),
    path(`M0,880 Q420,840 800,875 T1440,860 L1440,${H} L0,${H} Z`, '#4f8a3c'),
    meadow, rocks);
}

function beach(): string {
  const r = rng(23);
  const waves = range(14).map(row => range(11).map(col => {
    const x = col * 140 + (row % 2) * 70 + r() * 30, y = 360 + row * 16;
    return stroked(`M${x},${y} q20,-14 40,0 t40,0`, row % 2 ? '#c8f0f5' : '#ffffff', 3, { opacity: 0.85 });
  }).join('')).join('');
  const sandDots = range(180).map(() => circle(r() * W, 600 + r() * 360, 2 + r() * 2.5, r() < 0.5 ? '#e0b76a' : '#fff0c4')).join('');
  const shells = range(7).map(i => {
    const x = 90 + i * 200 + r() * 70, y = 780 + r() * 140;
    return group({ transform: `translate(${x} ${y}) rotate(${Math.round(r() * 60 - 30)})` },
      path('M-16,10 Q-20,-14 0,-16 Q20,-14 16,10 Z', i % 2 ? '#f8c8c4' : '#fbe3d0'), line(0, 8, 0, -12, '#d99a8f', 2), line(-8, 8, -10, -8, '#d99a8f', 2), line(8, 8, 10, -8, '#d99a8f', 2));
  }).join('');
  const umbrella = group({ transform: 'translate(360 560)' },
    line(0, 0, 18, 330, '#8a5a3c', 9),
    path('M-230,10 Q0,-190 230,10 Z', '#e63946'),
    path('M-230,10 Q-150,-140 0,-170 Q-60,-70 -80,10 Z', '#ffffff'),
    path('M80,10 Q60,-80 0,-170 Q150,-140 230,10 Z', '#ffffff'),
    path('M-230,10 q38,26 76,0 q38,26 76,0 q38,26 76,0 q38,26 76,0 q38,26 76,0 q38,26 76,0', '#e63946'));
  const palm = group({ transform: 'translate(1180 840)' },
    path('M-14,0 Q-30,-200 -10,-380 L16,-380 Q6,-200 26,0 Z', '#9c6b3f'),
    ...range(6).map(i => line(-18 + i * 2, -40 - i * 55, 18 + i * 2, -40 - i * 55, '#7c5330', 3)),
    ...[-80, -40, 0, 40, 80, 120, 160].map((a, i) => group({ transform: `translate(2 -380) rotate(${a})` },
      path('M0,0 Q70,-60 190,-10 Q90,-24 0,10 Z', i % 2 ? '#2d8a4e' : '#3aa35f'))),
    circle(-8, -362, 14, '#5b3a22'), circle(14, -358, 14, '#5b3a22'));
  const boat = group({ transform: 'translate(900 330)' },
    poly([[-8, -150], [-8, -5], [-110, -5]], '#ffffff'), poly([[8, -170], [8, -5], [90, -5]], '#ffd166'),
    line(0, -170, 0, 0, '#6b4e31', 5), path('M-120,0 L120,0 L90,36 L-90,36 Z', '#1d3557'));
  const towel = group({ transform: 'translate(760 700) rotate(-8)' },
    rect(0, 0, 360, 190, '#2a9d8f'), ...range(6).map(i => rect(i * 60, 0, 6, 190, '#e9c46a', { opacity: 0.8 })),
    ...range(6).map(i => rect(0, i * 32, 360, 14, '#ffffff', { opacity: 0.9 })));
  const star = group({ transform: 'translate(1290 920)' }, poly(range(10).map(i => {
    const a = (i * Math.PI) / 5 - Math.PI / 2, d = i % 2 ? 14 : 36;
    return [Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d)];
  }), '#f4845f'), circle(0, 0, 6, '#ffd6c4'));
  return svgDoc(`0 0 ${W} ${H}`, {},
    gradient('sky', ['#3d9be0', '#8ed0f5', '#e9f8ff']), rect(0, 0, W, 360, 'url(#sky)'),
    circle(240, 130, 90, '#fff6c2'), circle(240, 130, 58, '#ffd23f'), clouds(5, 8, 60, 280, '#ffffff'),
    gradient('sea', ['#6fd3e6', '#1eaed0', '#0b7fb0']), rect(0, 340, W, 280, 'url(#sea)'), waves,
    rect(0, 340, W, 8, '#d9f4f8'),
    path(`M0,580 Q300,540 700,580 T1440,570 L1440,${H} L0,${H} Z`, '#f3d79a'),
    path('M0,600 Q300,560 700,600 T1440,590 L1440,620 Q1000,660 700,630 T0,640 Z', '#fbeccb', { opacity: 0.9 }),
    path(`M0,650 Q400,640 900,665 T1440,650 L1440,${H} L0,${H} Z`, '#ecc67f'),
    sandDots, boat, palm, umbrella, towel, shells, star);
}

function fox(): string {
  const r = rng(37);
  const trunks = range(9).map(i => {
    const x = 40 + i * 165 + r() * 40;
    return group({}, rect(x, 0, 38 + r() * 24, 700, i % 2 ? '#5b4636' : '#6e5543'), rect(x + 8, 0, 6, 700, '#43332a', { opacity: 0.6 }));
  }).join('');
  const back = range(24).map(i => pine(i * 62 + r() * 30, 640, 260 + r() * 120, i % 2 ? '#2d5a45' : '#3b6e55', '#3e3028')).join('');
  const front = range(10).map(i => pine(i * 160 + r() * 80, 960, 480 + r() * 160, i % 2 ? '#1c4332' : '#255641', '#3e3028', 0.55)).join('');
  const leaves = range(120).map(() => {
    const x = r() * W, y = r() * H, c = ['#e9a23b', '#d9632b', '#b8412a', '#f3c969', '#8a9a3b'][Math.floor(r() * 5)];
    return ellipse(x, y, 7 + r() * 6, 4 + r() * 3, c, { transform: `rotate(${Math.round(r() * 180)} ${x} ${y})` });
  }).join('');
  const fireflies = range(40).map(() => circle(r() * W, 60 + r() * 500, 3 + r() * 2.5, '#fff7a8', { opacity: 0.8 })).join('');
  const mushrooms = [200, 520, 1010, 1290].map((x, i) => group({ transform: `translate(${x} ${840 + (i % 2) * 40})` },
    rect(-8, -10, 16, 32, '#f4ead8'), path('M-30,-8 Q0,-56 30,-8 Z', '#d62828'), circle(-10, -22, 4, '#ffffff'), circle(8, -28, 5, '#ffffff'), circle(14, -16, 3, '#ffffff'))).join('');
  const grass = range(200).map(() => { const x = r() * W, y = 640 + r() * 320; return line(x, y, x + (r() * 10 - 5), y - 14 - r() * 14, r() < 0.5 ? '#4f8a3c' : '#6aa84f', 3); }).join('');
  const foxFigure = group({ transform: 'translate(720 560)' },
    path('M-160,120 Q-420,60 -380,-130 Q-330,-40 -200,10 Z', '#e8731c'), path('M-380,-130 Q-340,-110 -300,-70 Q-340,-30 -360,-30 Q-390,-70 -380,-130 Z', '#fff7ea'),
    path('M-200,200 Q-210,-60 0,-90 Q200,-60 190,200 Z', '#e8731c'), path('M-70,200 Q-60,0 0,-40 Q60,0 70,200 Z', '#fff7ea'),
    rect(-130, 120, 52, 100, '#3a2418', { rx: 22 }), rect(80, 120, 52, 100, '#3a2418', { rx: 22 }),
    path('M-100,-150 L-90,-250 L-30,-190 Z', '#e8731c'), path('M100,-150 L90,-250 L30,-190 Z', '#e8731c'),
    path('M-86,-190 L-84,-236 L-52,-196 Z', '#3a2418'), path('M86,-190 L84,-236 L52,-196 Z', '#3a2418'),
    path('M-120,-130 Q0,-230 120,-130 Q130,-60 0,-10 Q-130,-60 -120,-130 Z', '#e8731c'),
    path('M-120,-110 Q-60,-70 0,-10 Q-80,-40 -125,-80 Z', '#fff7ea'), path('M120,-110 Q60,-70 0,-10 Q80,-40 125,-80 Z', '#fff7ea'),
    ellipse(-44, -112, 11, 9, '#2a1a10'), ellipse(44, -112, 11, 9, '#2a1a10'), circle(-41, -115, 3, '#ffffff'), circle(47, -115, 3, '#ffffff'),
    ellipse(0, -36, 14, 10, '#2a1a10'));
  return svgDoc(`0 0 ${W} ${H}`, {},
    gradient('sky', ['#b7d8c9', '#e8f1d6', '#f7ecc4']), rect(0, 0, W, 700, 'url(#sky)'),
    back, trunks, rect(0, 640, W, 320, '#5c7a3a'),
    path(`M0,700 Q400,660 800,700 T1440,690 L1440,${H} L0,${H} Z`, '#6b8c44'),
    path(`M0,820 Q500,780 900,830 T1440,810 L1440,${H} L0,${H} Z`, '#7a5c3c'),
    grass, front, leaves, mushrooms, foxFigure, fireflies);
}

function koi(): string {
  const r = rng(41);
  const ripples = range(34).map(() => circle(r() * W, r() * H, 20 + r() * 70, 'none', { stroke: '#8fd5d9', 'stroke-width': 2, opacity: 0.35 })).join('');
  const pebbles = range(70).map(() => ellipse(r() * W, r() * H, 6 + r() * 10, 4 + r() * 6, r() < 0.5 ? '#2b7a85' : '#1c5e6c', { opacity: 0.7 })).join('');
  const pad = (x: number, y: number, s: number) => group({ transform: `translate(${x} ${y}) rotate(${Math.round(r() * 360)}) scale(${s})` },
    circle(0, 0, 60, '#3f9d52'), poly([[0, 0], [70, -14], [70, 14]], '#1f7f9b'), circle(0, 0, 60, 'none', { stroke: '#2d7a40', 'stroke-width': 3 }),
    ...range(6).map(i => line(0, 0, Math.cos(i * 1.05) * 56, Math.sin(i * 1.05) * 56, '#2d7a40', 2)));
  const lotus = (x: number, y: number) => group({ transform: `translate(${x} ${y})` },
    ...range(8).map(i => ellipse(0, -28, 14, 34, i % 2 ? '#ff9ec4' : '#ffc2db', { transform: `rotate(${i * 45})` })), circle(0, 0, 14, '#ffe27a'));
  const fish = (x: number, y: number, rot: number, s: number, body: string, spot: string) => group({ transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` },
    path('M-140,0 Q-210,-60 -250,-30 Q-220,0 -250,30 Q-210,60 -140,0 Z', body, { opacity: 0.9 }),
    path('M-20,-34 Q10,-110 60,-60 Z', body, { opacity: 0.85 }), path('M-20,34 Q10,110 60,60 Z', body, { opacity: 0.85 }),
    path('M-150,0 Q-60,-62 60,-42 Q150,-26 170,0 Q150,26 60,42 Q-60,62 -150,0 Z', body),
    path('M-80,-40 Q-20,-52 20,-24 Q-30,-14 -80,-40 Z', spot), path('M20,20 Q70,30 110,14 Q80,42 20,20 Z', spot), circle(-30, 22, 16, spot),
    circle(128, -10, 7, '#1a1a1a'), circle(130, -12, 2, '#ffffff'));
  return svgDoc(`0 0 ${W} ${H}`, {},
    gradient('water', ['#1f8a99', '#16687a', '#0f4a5e'], 1, 1), rect(0, 0, W, H, 'url(#water)'), pebbles, ripples,
    fish(420, 330, -15, 1.1, '#f4f1ea', '#e63946'), fish(1000, 640, 160, 1.2, '#f77f00', '#fff3e0'), fish(560, 780, 40, 0.8, '#ffb703', '#d62828'), fish(1180, 210, 200, 0.7, '#e63946', '#fff3e0'),
    pad(120, 140, 1), pad(760, 90, 0.8), pad(1330, 420, 1.1), pad(160, 560, 1.2), pad(840, 470, 0.9), pad(1300, 860, 1), pad(300, 900, 0.9), pad(680, 900, 0.7),
    lotus(130, 150), lotus(1320, 420), lotus(170, 560), lotus(1290, 860));
}

function fruit(): string {
  const r = rng(53);
  const clothLines = range(18).map(c => rect(c * 80 + 38, 0, 4, H, '#d97b7b', { opacity: 0.5 })).join('');
  const shine = (x: number, y: number, rr: number) => ellipse(x - rr * 0.35, y - rr * 0.4, rr * 0.22, rr * 0.13, '#ffffff', { opacity: 0.55, transform: `rotate(-35 ${x - rr * 0.35} ${y - rr * 0.4})` });
  const apple = (x: number, y: number, rr: number, c: string) => group({}, circle(x - rr * 0.25, y, rr * 0.8, c), circle(x + rr * 0.25, y, rr * 0.8, c), circle(x, y + rr * 0.1, rr * 0.85, c),
    line(x, y - rr * 0.7, x + 6, y - rr * 1.2, '#5b3a22', 5), path(`M${x + 6},${y - rr} q30,-30 50,-6 q-20,24 -50,6 Z`, '#4f9d3a'), shine(x, y, rr));
  const orange = (x: number, y: number, rr: number) => group({}, circle(x, y, rr, '#f78c1f'), ...range(10).map(() => circle(x + (r() - 0.5) * rr, y + (r() - 0.5) * rr, 1.8, '#d86b00')), circle(x, y - rr + 4, 4, '#4f9d3a'), shine(x, y, rr));
  const pear = (x: number, y: number, rr: number) => group({}, circle(x, y + rr * 0.35, rr * 0.9, '#c8d63f'), circle(x, y - rr * 0.45, rr * 0.55, '#c8d63f'),
    line(x, y - rr, x + 4, y - rr * 1.4, '#5b3a22', 5), shine(x, y + rr * 0.2, rr));
  const grapes = (x: number, y: number) => {
    const spots = range(15).map(i => {
      const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - (row * (row + 1)) / 2;
      return { cx: x + (col - row / 2) * 34, cy: y + row * 30 };
    });
    return group({}, ...spots.map(s => circle(s.cx, s.cy, 18, '#6a3d9a')), ...spots.map(s => circle(s.cx - 5, s.cy - 6, 4, '#c9a7e8')));
  };
  const banana = (x: number, y: number, s: number) => group({ transform: `translate(${x} ${y}) scale(${s})` }, path('M-130,-20 Q0,90 140,-60 Q150,-30 130,0 Q0,130 -140,10 Z', '#ffd83d'), path('M-130,-20 Q0,80 140,-60 L135,-50 Q0,60 -128,-6 Z', '#f0b90b'), circle(-136, -6, 9, '#5b3a22'));
  const strawberry = (x: number, y: number) => group({}, path(`M${x - 26},${y - 14} Q${x},${y - 30} ${x + 26},${y - 14} Q${x + 18},${y + 30} ${x},${y + 34} Q${x - 18},${y + 30} ${x - 26},${y - 14} Z`, '#e63946'),
    ...range(8).map(i => circle(x - 14 + (i % 3) * 14, y - 2 + Math.floor(i / 3) * 12, 2, '#ffe9a8')), poly([[x - 16, y - 18], [x, y - 28], [x + 16, y - 18], [x, y - 12]], '#4f9d3a'));
  const bowl = group({}, path('M300,540 L1140,540 Q1100,800 720,820 Q340,800 300,540 Z', '#3a7ca5'), ellipse(720, 540, 420, 40, '#2c6285'),
    path('M330,600 Q720,640 1110,600 L1100,640 Q720,690 340,640 Z', '#ffffff', { opacity: 0.35 }),
    ...range(5).map(i => circle(400 + i * 160, 680 + (i % 2) * 18, 9, '#ffffff', { opacity: 0.6 })), rect(620, 810, 200, 36, '#2c6285', { rx: 10 }));
  const loose = group({}, apple(150, 800, 70, '#d62828'), orange(1290, 820, 66), pear(120, 180, 66), apple(1300, 190, 62, '#6aa84f'), orange(230, 330, 54),
    strawberry(1210, 350), strawberry(70, 560), strawberry(1380, 600), banana(1190, 90, 0.7));
  return svgDoc(`0 0 ${W} ${H}`, {}, rect(0, 0, W, H, '#fbeaea'), checkCloth('#e9b9b9'), clothLines,
    apple(560, 400, 110, '#d62828'), pear(920, 340, 100), orange(720, 330, 90),
    banana(720, 470, 1), grapes(430, 440), apple(1010, 470, 90, '#e8c32e'), orange(600, 500, 70), orange(860, 510, 66), bowl, loose);
}

function pizza(): string {
  const r = rng(67);
  const grain = range(46).map(i => line(150, 70 + i * 17, 1290, 70 + i * 17 + (r() * 8 - 4), i % 3 ? '#b9824f' : '#a06a3c', 2.5, { opacity: 0.7 })).join('');
  const scatter = (n: number, fn: (x: number, y: number) => string) => range(n).map(() => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 330;
    return fn(720 + Math.cos(a) * d, 480 + Math.sin(a) * d);
  }).join('');
  const pepperoni = scatter(14, (x, y) => group({}, circle(x, y, 38, '#b3261e'), circle(x, y, 38, 'none', { stroke: '#8c1a14', 'stroke-width': 4 }), circle(x - 12, y - 8, 5, '#d9534f'), circle(x + 10, y + 12, 6, '#d9534f'), circle(x + 14, y - 14, 4, '#d9534f')));
  const olives = scatter(16, (x, y) => group({}, circle(x, y, 15, '#2b2b2b'), circle(x, y, 6, '#f6d79b')));
  const mushrooms = scatter(7, (x, y) => group({}, path(`M${x - 30},${y} Q${x},${y - 38} ${x + 30},${y} Z`, '#f2e6d0'), rect(x - 8, y, 16, 22, '#e3d3b5')));
  const basil = scatter(12, (x, y) => path(`M${x},${y} q24,-34 54,0 q-24,34 -54,0 Z`, '#2f8f3a', { transform: `rotate(${Math.round(r() * 360)} ${x} ${y})` }));
  const cheese = scatter(60, (x, y) => ellipse(x, y, 20 + r() * 20, 12 + r() * 10, r() < 0.5 ? '#ffe28a' : '#fff0b0', { opacity: 0.8 }));
  const tomato = (x: number, y: number) => group({ transform: `translate(${x} ${y})` }, circle(0, 0, 36, '#e63946'), stroked('M-4,-34 q10,-26 30,-24', '#2f8f3a', 6));
  return svgDoc(`0 0 ${W} ${H}`, {}, rect(0, 0, W, H, '#fbe7e7'), checkCloth('#ef8c8c'),
    rect(120, 40, 1200, 880, '#c8935c', { rx: 70 }), grain, rect(120, 40, 1200, 880, 'none', { rx: 70, stroke: '#8d5f34', 'stroke-width': 8 }),
    circle(740, 500, 420, '#000000', { opacity: 0.2 }), circle(720, 480, 420, '#d99a45'), circle(720, 480, 392, '#e8b765'),
    circle(720, 480, 360, '#c8321d'), circle(720, 480, 340, '#f4c542'), cheese,
    ...range(8).map(i => line(720, 480, 720 + Math.cos((i * Math.PI) / 4 + 0.39) * 360, 480 + Math.sin((i * Math.PI) / 4 + 0.39) * 360, '#c98a30', 3, { opacity: 0.8 })),
    pepperoni, olives, mushrooms, basil, tomato(1180, 120), tomato(210, 820), tomato(1240, 840), tomato(200, 130));
}

function quilt(): string {
  const r = rng(79);
  const palette = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#8ecae6', '#b56576', '#f1faee', '#6d597a', '#90be6d'];
  const pick = () => palette[Math.floor(r() * palette.length)];
  const S = 120;
  const block = (col: number, row: number) => {
    const x = col * S, y = row * S, a = pick(), c = pick();
    let b = pick();
    while (b === a) b = pick();
    const parts = [
      [poly([[x, y], [x + S, y], [x, y + S]], b), circle(x + S / 2, y + S / 2, 22, c)],
      [poly([[x + S / 2, y + 8], [x + S - 8, y + S / 2], [x + S / 2, y + S - 8], [x + 8, y + S / 2]], b), circle(x + S / 2, y + S / 2, 12, c)],
      [rect(x + 16, y + 16, S - 32, S - 32, b), rect(x + 36, y + 36, S - 72, S - 72, c)],
      [poly([[x, y + S], [x + S / 2, y], [x + S, y + S]], b), poly([[x + S / 2, y + S * 0.4], [x + S * 0.7, y + S], [x + S * 0.3, y + S]], c)],
      [rect(x, y, S / 2, S / 2, b), rect(x + S / 2, y + S / 2, S / 2, S / 2, b), circle(x + S / 2, y + S / 2, 16, c)],
    ][(col * 3 + row * 5 + Math.floor(r() * 3)) % 5];
    return group({}, rect(x, y, S, S, a), ...parts, rect(x + 4, y + 4, S - 8, S - 8, 'none', { stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0.7 }));
  };
  const blocks = range(8).map(row => range(12).map(col => block(col, row)).join('')).join('');
  const seams = range(13).map(c => rect(c * S - 3, 0, 6, H, '#3b2f2f', { opacity: 0.8 })).join('') + range(9).map(rw => rect(0, rw * S - 3, W, 6, '#3b2f2f', { opacity: 0.8 })).join('');
  const knots = range(13).map(c => range(9).map(rw => circle(c * S, rw * S, 5, '#fff8e7')).join('')).join('');
  return svgDoc(`0 0 ${W} ${H}`, {}, blocks, seams, knots);
}

function balloons(): string {
  const r = rng(97);
  const balloon = (x: number, y: number, s: number, colors: string[]) => group({ transform: `translate(${x} ${y}) scale(${s})` },
    line(-60, 180, -26, 270, '#5b3a22', 3), line(60, 180, 26, 270, '#5b3a22', 3), line(-30, 196, -20, 270, '#5b3a22', 3), line(30, 196, 20, 270, '#5b3a22', 3),
    path('M0,-200 C150,-200 190,-60 100,70 C70,120 60,150 40,180 L-40,180 C-60,150 -70,120 -100,70 C-190,-60 -150,-200 0,-200 Z', colors[0]),
    path('M0,-200 C70,-190 100,-90 60,40 C45,100 30,150 20,180 L-20,180 C-30,150 -45,100 -60,40 C-100,-90 -70,-190 0,-200 Z', colors[1]),
    path('M0,-200 C20,-190 28,-90 18,40 L12,180 L-12,180 L-18,40 C-28,-90 -20,-190 0,-200 Z', colors[2]),
    path('M-100,70 Q0,98 100,70 L80,100 Q0,124 -80,100 Z', colors[1]),
    rect(-34, 270, 68, 44, '#a0693a', { rx: 6 }), rect(-34, 270, 68, 10, '#7c4f2a'), ellipse(-60, -90, 18, 46, '#ffffff', { opacity: 0.3, transform: 'rotate(18 -60 -90)' }));
  const hills = [{ y: 700, c: '#6aa84f', a: 70 }, { y: 780, c: '#4f8a3c', a: 60 }, { y: 860, c: '#7cb85a', a: 50 }].map((h, i) =>
    path(`M0,${h.y} ${range(6).map(k => `Q${k * 240 + 120},${h.y - h.a * (k % 2 ? -0.4 : 1) + i * 10} ${(k + 1) * 240},${h.y}`).join(' ')} L${W},${H} L0,${H} Z`, h.c)).join('');
  const fields = range(26).map(i => {
    const x = (i % 13) * 112 - 20 + r() * 20, y = 780 + Math.floor(i / 13) * 100 + r() * 30;
    return poly([[x, y], [x + 100, y - 10], [x + 120, y + 50], [x + 10, y + 60]], ['#e9c46a', '#8fbf5a', '#c9d86a', '#f0d98c'][i % 4], { opacity: 0.75 });
  }).join('');
  const birds = range(10).map(() => { const x = r() * W, y = 60 + r() * 400; return stroked(`M${x},${y} q12,-14 24,0 q12,-14 24,0`, '#33415c', 3); }).join('');
  const far = range(8).map(i => ellipse(120 + i * 190 + r() * 40, 560 + r() * 80, 18, 24, ['#e76f51', '#2a9d8f', '#e9c46a', '#8e6bbf'][i % 4], { opacity: 0.6 })).join('');
  return svgDoc(`0 0 ${W} ${H}`, {},
    gradient('sky', ['#3a86d6', '#7fb8ee', '#ffe3c4', '#ffd0a0']), rect(0, 0, W, H, 'url(#sky)'),
    circle(1240, 640, 70, '#fff1c1', { opacity: 0.8 }), clouds(7, 10, 80, 560, '#ffffff'), clouds(8, 6, 300, 620, '#ffe9d6'),
    far, birds, hills, fields,
    balloon(320, 330, 1.05, ['#e63946', '#ffd166', '#ffffff']), balloon(780, 210, 0.85, ['#2a9d8f', '#e9c46a', '#264653']),
    balloon(1150, 380, 1, ['#6d597a', '#f4a261', '#ffffff']), balloon(560, 520, 0.5, ['#118ab2', '#ef476f', '#ffffff']), balloon(1340, 150, 0.45, ['#f77f00', '#ffffff', '#d62828']));
}

const DRAW: Record<string, () => string> = { mountains, beach, fox, koi, fruit, pizza, quilt, balloons };

export function pictureSvg(name: string): string | null {
  return Object.hasOwn(DRAW, name) ? DRAW[name]() : null;
}

export const JIGSAW_ASSETS: SvgAsset[] = [
  { name: 'jigsaw-picture', params: ['name'], samples: PICTURES.map(picture => [picture.name]), render: ([name]) => pictureSvg(name) },
];

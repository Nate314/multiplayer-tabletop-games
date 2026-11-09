import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';
import { MAP_HEIGHT, MAP_LEFT, MAP_WIDTH } from './map.ts';

// The map's sea and land, drawn on the server; routes and cities on top stay in the client, where they can be
// clicked. The classes are the ones client/railroutes.scss colors; the fills are only its defaults, for the gallery

// Esterra, a fictional continent, with its inland lake and three islands, in map coordinates (this site's own drawing)
const MAINLAND =
  '30,70 90,38 200,26 300,44 380,22 470,30 540,58 590,110 640,150 690,118 730,70 800,40 900,34 985,56 1040,104 1035,180 ' +
  '1000,222 1030,280 1015,350 970,392 985,450 935,512 870,548 820,530 790,575 765,615 720,612 705,560 650,520 580,532 ' +
  '510,590 450,585 415,530 345,505 275,545 205,528 150,478 92,440 58,368 26,300 38,220 12,150';
const ISLANDS = ['70,548 112,538 138,556 128,584 92,592 64,574', '612,36 652,28 684,44 668,66 628,68', '1018,410 1046,402 1056,430 1040,462 1016,450'];
const LAKE = '430,250 480,228 540,240 560,280 530,318 470,322 428,292';

export function landSvg(): string {
  return svgDoc(`${MAP_LEFT} 0 ${MAP_WIDTH - MAP_LEFT} ${MAP_HEIGHT}`, {},
    el('rect', { class: 'sea', x: MAP_LEFT, y: 0, width: MAP_WIDTH - MAP_LEFT, height: MAP_HEIGHT, fill: '#b9d3dd' }),
    ...[MAINLAND, ...ISLANDS].map(points => el('polygon', { class: 'land', points, fill: '#efe3c2' })),
    el('polygon', { class: 'lake', points: LAKE, fill: '#b9d3dd' }));
}

export const RAILROUTES_ASSETS: SvgAsset[] = [{ name: 'railroutes-land', params: [], samples: [], render: landSvg }];

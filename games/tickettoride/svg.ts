import { el, svgDoc, type SvgAsset } from '../../shared/svg/svg.ts';
import { MAP_HEIGHT, MAP_LEFT, MAP_WIDTH } from './map.ts';

// The map's sea and land, drawn on the server; routes and cities on top stay in the client, where they can be
// clicked. The classes are the ones client/tickettoride.scss colors; the fills are only its defaults, for the gallery

// A rough outline of the United States and the southern edge of Canada, in map coordinates (this site's own drawing)
const LAND_OUTLINE =
  '28,100 58,87 550,87 647,109 730,142 770,169 772,219 832,213 876,193 902,175 964,175 990,142 1029,129 1043,175 987,206 ' +
  '980,228 990,248 959,257 920,274 916,294 894,320 880,351 890,386 851,419 799,461 790,496 813,573 807,611 783,591 767,549 ' +
  '749,507 721,512 700,496 645,501 649,527 621,523 568,514 512,554 508,595 476,582 438,510 410,527 380,507 348,466 318,477 ' +
  '267,477 202,450 161,450 139,422 100,404 77,360 66,334 44,290 35,241 40,149 28,100';

// Canada: the top of the map down to the northern border of the outline above, from Maine back to the Pacific
const NORTHERN_BORDER = LAND_OUTLINE.split(' ').slice(0, 13).reverse().join(' ');
const CANADA_OUTLINE = `${MAP_LEFT},0 ${MAP_WIDTH},0 ${MAP_WIDTH},125 ${NORTHERN_BORDER} ${MAP_LEFT},92`;

export function landSvg(): string {
  return svgDoc(`${MAP_LEFT} 0 ${MAP_WIDTH - MAP_LEFT} ${MAP_HEIGHT}`, {},
    el('rect', { class: 'sea', x: MAP_LEFT, y: 0, width: MAP_WIDTH - MAP_LEFT, height: MAP_HEIGHT, fill: '#b9d3dd' }),
    el('polygon', { class: 'land canada', points: CANADA_OUTLINE, fill: '#e2dcc4' }),
    el('polygon', { class: 'land usa', points: LAND_OUTLINE, fill: '#efe3c2' }));
}

export const TICKETTORIDE_ASSETS: SvgAsset[] = [{ name: 'tickettoride-land', params: [], samples: [], render: landSvg }];

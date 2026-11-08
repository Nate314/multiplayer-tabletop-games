// The robot repair bay: ten parts in slots. Easier slots are short and wide, harder ones long and narrow, and
// value follows length over width. Slots keep apart, so even the Easy walls never let a part cut a corner.
import type { Part } from './types.ts';

export const PART_RADIUS = 10;
export const EXIT_RADIUS = 14;

export const PARTS: Part[] = [
  { id: 0, name: 'Bolt', value: 8, width: 56, path: [[50, 250], [50, 150], [150, 150], [150, 24]] },
  { id: 1, name: 'Gear', value: 15, width: 52, path: [[240, 260], [360, 260], [360, 170], [240, 170], [240, 24]] },
  { id: 2, name: 'Lens', value: 26, width: 44, path: [[560, 260], [560, 90], [500, 90], [500, 260], [440, 260], [440, 24]] },
  { id: 3, name: 'Spring', value: 20, width: 48, path: [[640, 260], [760, 260], [760, 180], [640, 180], [640, 100], [760, 100], [760, 24]] },
  {
    id: 4, name: 'Coil', value: 40, width: 38,
    path: [[840, 270], [960, 270], [960, 210], [840, 210], [840, 150], [960, 150], [960, 90], [840, 90], [840, 24]]
  },
  { id: 5, name: 'Fuse', value: 5, width: 58, path: [[150, 390], [150, 520], [50, 520], [50, 616]] },
  { id: 6, name: 'Servo', value: 12, width: 50, path: [[260, 490], [260, 380], [350, 380], [350, 616]] },
  { id: 7, name: 'Valve', value: 22, width: 46, path: [[560, 380], [440, 380], [440, 460], [560, 460], [560, 540], [440, 540], [440, 616]] },
  {
    id: 8, name: 'Chip', value: 32, width: 40,
    path: [[760, 370], [640, 370], [640, 430], [760, 430], [760, 490], [640, 490], [640, 550], [760, 550], [760, 616]]
  },
  { id: 9, name: 'Sensor', value: 35, width: 42, path: [[840, 370], [840, 580], [900, 580], [900, 370], [960, 370], [960, 616]] }
];

// The board as data. Coordinates for drawing live in the client.
export type SpaceKind = 'start' | 'payday' | 'job' | 'event' | 'house' | 'family' | 'risk' | 'graduation' | 'marriage' | 'houseStop' | 'retirement' | 'fork';
export type Space = { kind: SpaceKind; text?: string; amount?: number; fullOnly?: true; next: number[] }; // next has 2 entries at a fork

const STOPS: readonly SpaceKind[] = ['graduation', 'marriage', 'houseStop', 'retirement', 'fork'];
export const isStop = (kind: SpaceKind): boolean => STOPS.includes(kind);

const GAINS: readonly [string, number][] = [
  ['A neighbor pays you to repaint the fence.', 800], ['You win a raffle at the county fair.', 2500],
  ['Your old bicycle sells at a yard sale.', 300], ['A tax refund arrives early.', 1200],
  ['You find a forgotten savings bond in a drawer.', 1500], ['Your vegetable stand does well this summer.', 600],
  ['A relative repays an old loan.', 2000], ['You are paid to tutor a student.', 900],
  ['Your photo wins a local contest.', 750], ['You sell a few handmade chairs.', 1100],
  ['A company bonus lands in your account.', 3000], ['You return a lost wallet and get a reward.', 500]
];
const LOSSES: readonly [string, number][] = [
  ['The car needs a new transmission.', -1800], ['A storm damages your garden shed.', -900],
  ['You pay for a long overdue dental visit.', -700], ['A pipe bursts in the kitchen.', -1500],
  ['Your phone falls into the lake.', -400], ['You buy a very expensive pair of boots.', -350],
  ['A parking fine arrives in the mail.', -150], ['The roof starts to leak.', -2200],
  ['You lend money to a friend who never repays it.', -1000], ['The furnace stops working in January.', -1300],
  ['A bad investment tip costs you a bundle.', -2500], ['Your suitcase is lost on a trip.', -600]
];

// Index order: 0 start; 1-14 college branch (ends at graduation); 15-26 work branch;
// then the shared stretch (marriage stop, mid fork); the safe branch, the fast branch;
// the last shared stretch (house stop) to retirement at the end.
// Codes: p payday, j job, e gain, l loss, h house, f family, r risk, G graduation, M marriage,
// H houseStop, X mid fork, R retirement; a leading * marks a fullOnly space.
const SEGMENTS = {
  college: 'p e *l j *p e *r p *e h *f l p G',
  work: 'j p e *l p *r l *p f *e p e',
  shared1: 'p l *e h *f p r *l p *e j *p e *l f p *e r M p e *l',
  safe: 'p e *e p *f e p *e h p *e p f e *p e p',
  fast: 'r l *r p r *l r p *r e',
  shared2: 'p e *l h *f p r *e p *l f *p e r *e p *l e p *e h p l *f p e H p *e l p r *e p *l f p e R'
};

const KIND: Record<string, SpaceKind> = {
  p: 'payday', j: 'job', e: 'event', l: 'event', h: 'house', f: 'family', r: 'risk',
  G: 'graduation', M: 'marriage', H: 'houseStop', X: 'fork', R: 'retirement'
};

const spaces: Space[] = [{ kind: 'start', next: [] }];
let gain = 0;
let loss = 0;
const segment = (codes: string): { first: number; last: number } => {
  const first = spaces.length;
  for (const token of codes.split(' ')) {
    const code = token.replace('*', '');
    const space: Space = { kind: KIND[code], next: [] };
    if (token.startsWith('*')) space.fullOnly = true;
    if (code === 'e') [space.text, space.amount] = GAINS[gain++ % GAINS.length];
    if (code === 'l') [space.text, space.amount] = LOSSES[loss++ % LOSSES.length];
    spaces.push(space);
  }
  for (let i = first; i < spaces.length - 1; i++) spaces[i].next = [i + 1];
  return { first, last: spaces.length - 1 };
};

const college = segment(SEGMENTS.college);
const work = segment(SEGMENTS.work);
const shared1 = segment(SEGMENTS.shared1);
const fork = segment('X');
const safe = segment(SEGMENTS.safe);
const fast = segment(SEGMENTS.fast);
const shared2 = segment(SEGMENTS.shared2);
spaces[0].next = [college.first, work.first];
spaces[college.last].next = [shared1.first];
spaces[work.last].next = [shared1.first];
spaces[shared1.last].next = [fork.first];
spaces[fork.first].next = [safe.first, fast.first];
spaces[safe.last].next = [shared2.first];
spaces[fast.last].next = [shared2.first];

export const ROAD: readonly Space[] = spaces;
export const START_FORK = { college: college.first, work: work.first };
export const MID_FORK = { space: fork.first, safe: safe.first, fast: fast.first };

// Follows next[0], skipping fullOnly spaces on the short road; never called at a fork or at retirement.
export const nextSpace = (from: number, length: 'short' | 'full'): number => {
  let at = ROAD[from].next[0];
  while (length === 'short' && ROAD[at].fullOnly) at = ROAD[at].next[0];
  return at;
};

// Spaces walked from start to retirement, both inclusive.
export const pathLength = (route: 'college' | 'work', road: 'safe' | 'fast', length: 'short' | 'full'): number => {
  let at = route === 'college' ? START_FORK.college : START_FORK.work;
  let count = 2; // start and the branch's first space
  while (ROAD[at].kind !== 'retirement') {
    at = at === MID_FORK.space ? MID_FORK[road] : nextSpace(at, length);
    count++;
  }
  return count;
};

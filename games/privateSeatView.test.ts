import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GAMES } from './registry.ts';
import { addPlayer } from '../shared/seating.ts';
import { spectatorView } from '../shared/spectators.ts';
import type { BaseGameState, Random } from '../shared/types.ts';

// The cases patch private fields directly, so they read the state loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = BaseGameState & Record<string, any>;

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOUR_SEATS = ['hearts', 'spades', 'euchre', 'rook', 'thecrew'];
const NAMES = ['Alice', 'Bob', 'Cara', 'Dan'];
const EVE = { id: 's1', name: 'Eve', tableScreen: false, allowedSeats: [] };

function dealt(game: (typeof GAMES)[number]): Loose {
  let state: Loose = game.createGameState('g');
  const seats = FOUR_SEATS.includes(game.info.id) ? 4 : Math.max(game.info.minPlayers, 2);
  for (const name of NAMES.slice(0, seats)) {
    const result = addPlayer(game, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// One crafted state per conditional private field, built from the dealt state
const CASES: Record<string, (s: Loose) => Loose[]> = {
  hearts: s => [{ ...s, passes: { 1: s.hands[1].slice(0, 3) } }],
  euchre: s => [{ ...s, dealer: 1, discard: s.hands[1][0] }],
  rook: s => [{ ...s, bidder: 2, phase: 'play', nest: s.hands[2].slice(0, 2) }],
  thecrew: s => [{ ...s, distress: { direction: 'left', passes: { 1: s.hands[1][0] } } }],
  uno: s => [
    { ...s, currentPlayer: 1, drawnCard: s.hands[1][0] },
    { ...s, revealed: { to: 2, of: 1, hand: s.hands[1] } }
  ],
  gofish: s => [{ ...s, lastMove: { asker: 1, fished: 'other' }, fishedCard: s.hands[1][0] }],
  racko: s => [{ ...s, held: { by: 1, card: 5, from: 'discard' } }]
};

// Games whose hooks a later commit adds
const PENDING: string[] = ['catan', 'risk', 'splendor', 'tickettoride'];

for (const game of GAMES.filter(g => !PENDING.includes(g.info.id))) {
  const id = game.info.id;
  const seatsOf = () => [dealt(game), ...(CASES[id]?.(dealt(game)) ?? [])]
    .flatMap(s => s.activePlayers.map((seat: number) => [s, seat] as const));

  describe(id, () => {
    if (game.privateSeatView) {
      it("the table view plus privateSeatView is the seat's own view", () => {
        for (const [s, seat] of seatsOf()) {
          assert.deepEqual(
            { ...game.toPublicState(s, false, null), ...(game.privateSeatView!(s, seat) as object) },
            game.toPublicState(s, false, seat)
          );
        }
      });
    } else {
      it('hides nothing per seat', () => {
        for (const [s, seat] of seatsOf()) {
          assert.deepEqual(game.toPublicState(s, false, seat), game.toPublicState(s, false, null));
        }
      });
    }

    it('a spectator with no permissions sees the history view', () => {
      const s = dealt(game);
      const { seatViews: _seatViews, ...view } = spectatorView(game, s, EVE) as Record<string, unknown>;
      assert.deepEqual(view, game.toPublicState(s, false, null));
    });

    it('keeps spectator fields through its own hooks', () => {
      const carried = { spectators: [EVE], spectatorKeys: { s1: 'k' }, handRequests: [{ spectator: 's1', seat: 1 }] };
      const added = addPlayer(game, { ...game.createGameState('g'), ...carried }, 'Zed', seeded(7));
      assert.ok(!('error' in added));
      for (const state of [added.state, game.resetLobby({ ...dealt(game), ...carried }, seeded(7))]) {
        assert.deepEqual({ spectators: state.spectators, spectatorKeys: state.spectatorKeys, handRequests: state.handRequests }, carried);
      }
    });
  });
}

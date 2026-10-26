import crypto from 'node:crypto';
import express, { type Express } from 'express';
import { alertFor, alertText } from '../shared/alerts.ts';
import type { GameInfo } from '../shared/gameDefinition.ts';
import { joinLink } from '../shared/links.ts';
import { asRecord } from '../shared/messages.ts';
import type { BasePublicState, Seat } from '../shared/types.ts';
import type { PushStore } from './pushStore.ts';
import { sendPush, vapidHeaders, type VapidKeys } from './vapid.ts';

export type PendingAlert = { title: string; body: string; tag: string; url: string };
export type Alerts = ReturnType<typeof createAlerts>;

export function createAlerts(deps: {
  store: PushStore; keys: VapidKeys; subject: string; games: GameInfo[]; send?: typeof sendPush; now?: () => number;
}) {
  const { store, keys, subject, games, send = sendPush, now = Date.now } = deps;
  const lastKeys = new Map<string, Map<Seat, string | null>>(); // by room: each seat's alert key at the last change
  // shortcut: an endpoint whose worker never fetches keeps one entry per room until the room goes; cap it if that grows
  const waiting = new Map<string, Map<string, PendingAlert>>(); // by endpoint, then room: the alert its worker will fetch

  function push(roomId: string, endpoint: string, alert: PendingAlert): void {
    const rooms = waiting.get(endpoint) ?? new Map<string, PendingAlert>();
    rooms.set(roomId, alert);
    waiting.set(endpoint, rooms);
    // The push service keeps only the newest push per Topic, so one game never stacks up
    const topic = crypto.createHash('sha256').update(roomId).digest('base64url').slice(0, 32);
    void (async () => {
      const result = await send(endpoint, { ...vapidHeaders(keys, endpoint, subject, now()), Topic: topic });
      if (result === 'gone') {
        store.removeEndpoint(endpoint);
        waiting.delete(endpoint);
      }
    })().catch(error => console.error('push failed', error));
  }

  function forget(roomId: string): void {
    store.removeRoom(roomId);
    lastKeys.delete(roomId);
    for (const rooms of waiting.values()) rooms.delete(roomId);
  }

  return {
    publicKey: keys.publicKey,

    // views: each active seat's own view, or null once the room is gone
    roomChanged(roomId: string, views: Map<Seat, BasePublicState> | null, visibleSeats: Set<Seat>): void {
      const [state] = views?.values() ?? [];
      const info = games.find(game => roomId.startsWith(`${game.id}/`));
      if (!views || !state || !info) {
        forget(roomId);
        return;
      }
      const previous = lastKeys.get(roomId);
      // A freed seat's subscriptions go with it, so whoever takes the seat next never gets them
      const known = previous ? [...previous.keys()] : Array.from({ length: info.stretchedPlayers?.max ?? info.maxPlayers }, (_, i) => i + 1);
      for (const seat of known) if (!state.activePlayers.includes(seat)) store.removeSeat(roomId, seat);

      const current = new Map<Seat, string | null>();
      for (const [seat, view] of views) {
        const alert = alertFor(info, view, seat);
        current.set(seat, alert?.key ?? null);
        // The first look after a restart only records, so alerts that were already true are not sent again
        if (!previous || !alert || previous.get(seat) === alert.key || visibleSeats.has(seat)) continue;
        for (const endpoint of store.endpoints(roomId, seat)) {
          const shared = state.activePlayers.some(other => other !== seat && store.endpoints(roomId, other).includes(endpoint));
          const text = alertText(info, view, alert.kind, shared ? view.playerNames[seat] : undefined);
          push(roomId, endpoint, { ...text, tag: roomId, url: joinLink('', info.id, view.gameId) });
        }
      }
      lastKeys.set(roomId, current);
      // Each client subscribes again for the next game, so a reseated player never gets this game's pushes
      if (state.isGameOver) store.removeRoom(roomId);
    },

    // The worker fetches what to show, since pushes carry no payload
    pending(endpoint: string): PendingAlert[] {
      const alerts = [...(waiting.get(endpoint)?.values() ?? [])];
      waiting.delete(endpoint);
      return alerts;
    }
  };
}

export function mountPushRoutes(app: Express, alerts: Alerts): void {
  app.get('/api/push/key', (_req, res) => {
    res.json({ publicKey: alerts.publicKey });
  });
  app.post('/api/push/alerts', express.json({ limit: '2kb' }), (req, res) => {
    const endpoint = asRecord(req.body)?.endpoint;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ alerts: typeof endpoint === 'string' ? alerts.pending(endpoint) : [] });
  });
}

import { MESSAGE_TYPES, type ClientMessage, type ServerMessage } from '../../shared/messages.ts';
import type { HouseRulesProposal } from '../../shared/houseRules.ts';
import type { Reaction } from '../../shared/reactions.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import { deviceId } from './device.ts';

type GameJoined = Extract<ServerMessage, { type: typeof MESSAGE_TYPES.GAME_JOINED }>['payload'];
type Join = Extract<ClientMessage, { type: typeof MESSAGE_TYPES.JOIN_GAME }>;
// Distributes over the join variants so each keeps its own fields
export type JoinRequest = Join extends infer J ? (J extends Join ? Omit<J, 'type'> : never) : never;

class GameService {
  ws: WebSocket | null;
  onGameState: ((state: BasePublicState) => void) | null;
  onGameJoined: ((data: GameJoined) => void) | null;
  onError: ((message: string) => void) | null;
  onReaction: ((reaction: Reaction) => void) | null;
  onLeftGame: ((message: string) => void) | null;
  onDisconnect: (() => void) | null;

  constructor() {
    this.ws = null;
    this.onGameState = null;
    this.onGameJoined = null;
    this.onError = null;
    this.onReaction = null;
    this.onLeftGame = null;
    this.onDisconnect = null;
  }

  // `rejoin` only takes back a held seat, so it never starts a new game; taking one back needs its `seatKey`
  connect(request: JoinRequest, serverUrl = window.location.host): void {
    // Drop any earlier socket, e.g. after a refused join, without reporting a disconnect
    this.disconnect();

    // Use wss:// for https, ws:// for http
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${serverUrl}`);
    this.ws = ws;

    ws.onopen = () => {
      this.send({ type: MESSAGE_TYPES.JOIN_GAME, ...request, deviceId: deviceId() });
    };

    ws.onmessage = (event) => {
      // Our own server only sends ServerMessage shapes
      this.handleMessage(JSON.parse(event.data) as ServerMessage);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onDisconnect?.();
    };
  }

  handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case MESSAGE_TYPES.GAME_JOINED:
        this.onGameJoined?.(message.payload);
        break;
      case MESSAGE_TYPES.GAME_STATE:
        this.onGameState?.(message.payload);
        break;
      case MESSAGE_TYPES.GAME_ERROR:
        this.onError?.(message.payload.message);
        break;
      case MESSAGE_TYPES.LEFT_GAME:
        this.onLeftGame?.(message.payload.message);
        break;
      case MESSAGE_TYPES.REACTION:
        this.onReaction?.(message.payload);
        break;
    }
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Each game validates its own moves and actions on the server
  // `moveCount` is only sent for an out-of-turn move, so the server can tell whether someone else moved first
  makeMove(move: unknown, moveCount?: number): void {
    this.send({ type: MESSAGE_TYPES.MAKE_MOVE, payload: { move, moveCount } });
  }

  setHouseRules(proposal: HouseRulesProposal): void {
    this.send({ type: MESSAGE_TYPES.SET_HOUSE_RULES, payload: { proposal } });
  }

  agreeHouseRules(revision: number): void {
    this.send({ type: MESSAGE_TYPES.AGREE_HOUSE_RULES, payload: { revision } });
  }

  sendAction(action: unknown): void {
    this.send({ type: MESSAGE_TYPES.GAME_ACTION, payload: { action } });
  }

  requestUndo(): void {
    this.send({ type: MESSAGE_TYPES.REQUEST_UNDO });
  }

  voteUndo(approve: boolean): void {
    this.send({ type: MESSAGE_TYPES.VOTE_UNDO, payload: { approve } });
  }

  requestDismiss(seat: Seat): void {
    this.send({ type: MESSAGE_TYPES.REQUEST_DISMISS, payload: { seat } });
  }

  voteDismiss(approve: boolean): void {
    this.send({ type: MESSAGE_TYPES.VOTE_DISMISS, payload: { approve } });
  }

  requestRematch(): void {
    this.send({ type: MESSAGE_TYPES.REQUEST_REMATCH });
  }

  voteRematch(join: boolean): void {
    this.send({ type: MESSAGE_TYPES.VOTE_REMATCH, payload: { join } });
  }

  requestHand(seat: Seat): void {
    this.send({ type: MESSAGE_TYPES.REQUEST_HAND, payload: { seat } });
  }

  answerHand(spectator: string, allow: boolean): void {
    this.send({ type: MESSAGE_TYPES.ANSWER_HAND, payload: { spectator, allow } });
  }

  switchToPlayer(): void {
    this.send({ type: MESSAGE_TYPES.SWITCH_TO_PLAYER, payload: { deviceId: deviceId() } });
  }

  react(target: Seat, emoji: string): void {
    this.send({ type: MESSAGE_TYPES.REACT, payload: { target, emoji } });
  }

  showSeat(seat: Seat | null): void {
    this.send({ type: MESSAGE_TYPES.SHOW_SEAT, payload: { seat } });
  }

  pushSubscribe(endpoint: string): void {
    this.send({ type: MESSAGE_TYPES.PUSH_SUBSCRIBE, payload: { endpoint } });
  }

  pushUnsubscribe(): void {
    this.send({ type: MESSAGE_TYPES.PUSH_UNSUBSCRIBE });
  }

  setVisible(visible: boolean): void {
    this.send({ type: MESSAGE_TYPES.SET_VISIBLE, payload: { visible } });
  }

  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}

export default new GameService();

import { MESSAGE_TYPES, type ClientMessage, type ServerMessage } from '../../shared/messages.ts';
import type { HouseRulesProposal } from '../../shared/houseRules.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type GameJoined = Extract<ServerMessage, { type: typeof MESSAGE_TYPES.GAME_JOINED }>['payload'];

class GameService {
  ws: WebSocket | null;
  onGameState: ((state: BasePublicState) => void) | null;
  onGameJoined: ((data: GameJoined) => void) | null;
  onError: ((message: string) => void) | null;
  onDisconnect: (() => void) | null;

  constructor() {
    this.ws = null;
    this.onGameState = null;
    this.onGameJoined = null;
    this.onError = null;
    this.onDisconnect = null;
  }

  // `rejoin` only takes back a held seat, so it never starts a new game; taking one back needs its `seatKey`
  connect(
    gameType: string, gameId: string, playerName: string, rejoin = false, seatKey?: string, serverUrl = window.location.host
  ): void {
    // Drop any earlier socket, e.g. after a refused join, without reporting a disconnect
    this.disconnect();

    // Use wss:// for https, ws:// for http
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${serverUrl}`);
    this.ws = ws;

    ws.onopen = () => {
      this.send({ type: MESSAGE_TYPES.JOIN_GAME, gameType, gameId, playerName, rejoin, seatKey });
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

  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}

export default new GameService();

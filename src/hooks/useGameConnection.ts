import { useState, useEffect, useCallback, useRef } from 'react';
import gameService from '../services/gameService';
import { loadSession, saveSession, clearSession, type Session } from '../services/session';
import type { JoinLink } from '../services/share.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

// After a refresh the old socket can still hold the seat for a moment, so a rejoin tries again a few times
const REJOIN_RETRIES = 5;
const REJOIN_RETRY_DELAY_MS = 1000;
const STILL_CONNECTED = ' is already in this game';

type Rejoining = { retriesLeft: number; timer?: ReturnType<typeof setTimeout> };

export default function useGameConnection(joinLink: JoinLink | null = null) {
  const [playerNumber, setPlayerNumber] = useState<Seat | null>(null);
  const [gameState, setGameState] = useState<BasePublicState | null>(null);
  const [gameType, setGameType] = useState<string | null>(null); // the game being played, remembered or not
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(loadSession);

  // The service handlers are set once, so they read the latest values from refs
  const sessionRef = useRef(session);
  const joiningGameType = useRef<string | null>(null); // the game a pending or current join is for
  const rejoining = useRef<Rejoining | null>(null); // set until a rejoin succeeds or gives up
  const seatKey = useRef<string | undefined>(undefined); // the key of the seat joined last

  const updateSession = useCallback((next: Session | null) => {
    const previous = sessionRef.current;
    sessionRef.current = next;
    setSession(next);
    if (next) {
      saveSession(next);
    } else if (previous) {
      clearSession(previous);
    }
  }, []);

  // Only a started game holds seats, so a lobby is never offered for rejoining.
  // Uses the server's spelling of the name and ID, so a rejoin matches exactly what was seated.
  const rememberIfStarted = useCallback((state: BasePublicState, seat: Seat) => {
    const type = joiningGameType.current;
    if (!type || !state.started) return;
    const next = { gameType: type, gameId: state.gameId, playerName: state.playerNames[seat], seatKey: seatKey.current, inGame: true };
    const current = sessionRef.current;
    const unchanged = current?.inGame && current.gameType === next.gameType &&
      current.gameId === next.gameId && current.playerName === next.playerName && current.seatKey === next.seatKey;
    if (!unchanged) updateSession(next);
  }, [updateSession]);

  const stopRejoining = useCallback(() => {
    clearTimeout(rejoining.current?.timer);
    rejoining.current = null;
  }, []);

  const connect = useCallback((type: string, gameId: string, playerName: string, rejoin: boolean) => {
    joiningGameType.current = type;
    // The remembered game's key, sent with any join to that game so a held seat can be taken back
    const remembered = sessionRef.current;
    const key = remembered?.gameType === type && remembered.gameId === gameId ? remembered.seatKey : undefined;
    gameService.connect(type, gameId, playerName, rejoin, key);
  }, []);

  const rejoin = useCallback(() => {
    const remembered = sessionRef.current;
    if (!remembered) return;
    stopRejoining();
    rejoining.current = { retriesLeft: REJOIN_RETRIES };
    setError(null);
    connect(remembered.gameType, remembered.gameId, remembered.playerName, true);
  }, [connect, stopRejoining]);

  useEffect(() => {
    // Read as each message arrives, since the handlers outlive any render
    let seat: Seat | null = null;

    gameService.onGameJoined = (data) => {
      stopRejoining();
      seat = data.playerNumber;
      seatKey.current = data.seatKey;
      setPlayerNumber(data.playerNumber);
      setGameState(data.gameState);
      setGameType(joiningGameType.current);
      setError(null);
      if (seat !== null) rememberIfStarted(data.gameState, seat);
    };

    gameService.onGameState = (newGameState) => {
      setGameState(newGameState);
      setError(null);
      // The first move turns a lobby into a game worth coming back to
      if (seat !== null) rememberIfStarted(newGameState, seat);
    };

    gameService.onError = (message) => {
      const attempt = rejoining.current;
      if (!attempt) {
        setError(message);
        return;
      }
      const stillConnected = message.endsWith(STILL_CONNECTED);
      if (sessionRef.current && stillConnected && attempt.retriesLeft > 0) {
        attempt.retriesLeft -= 1;
        attempt.timer = setTimeout(() => {
          const remembered = sessionRef.current;
          if (remembered) connect(remembered.gameType, remembered.gameId, remembered.playerName, true);
        }, REJOIN_RETRY_DELAY_MS);
        return;
      }
      stopRejoining();
      gameService.disconnect();
      const remembered = sessionRef.current;
      if (stillConnected && remembered) {
        // The seat is still held, by another tab or device, so the list keeps offering it
        updateSession({ ...remembered, inGame: false });
      } else {
        // The game is gone or the player was dismissed: forget it
        updateSession(null);
      }
      setError(message);
    };

    gameService.onDisconnect = () => {
      stopRejoining();
      seat = null;
      setPlayerNumber(null);
      setGameState(null);
      setError('Disconnected from server');
      // The seat is held on the server, so the list offers it again
      const remembered = sessionRef.current;
      if (remembered?.inGame) updateSession({ ...remembered, inGame: false });
    };

    // A page kept in the back/forward cache would keep its socket, and so its seat, while nobody sees it.
    // Closing it without onDisconnect leaves the session in the game, so coming back rejoins.
    const handlePageHide = () => {
      stopRejoining();
      gameService.disconnect();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      seat = null;
      setPlayerNumber(null);
      setGameState(null);
      if (sessionRef.current?.inGame) rejoin();
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    // A page that went away mid-game (refresh, closed tab) takes its seat back
    const remembered = sessionRef.current;
    if (remembered?.inGame) {
      // A share link to another game wins, and the old one stays one click away
      if (joinLink && (joinLink.gameType !== remembered.gameType || joinLink.gameId !== remembered.gameId)) {
        updateSession({ ...remembered, inGame: false });
      } else {
        rejoin();
      }
    }

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      stopRejoining();
      gameService.disconnect();
    };
  }, [connect, joinLink, rejoin, rememberIfStarted, stopRejoining, updateSession]);

  const join = useCallback((type: string, gameId: string, playerName: string) => {
    const trimmedGameId = gameId.trim();
    const trimmedName = playerName.trim();
    if (!trimmedGameId) {
      setError('Please enter a game ID');
      return;
    }
    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }
    stopRejoining();
    setError(null);
    connect(type, trimmedGameId, trimmedName, false);
  }, [connect, stopRejoining]);

  // Leaving on purpose is not a lost connection, so no "Disconnected" message.
  // The remembered game is untouched, except that a rejoin cut short is offered again as the rejoin button.
  const leave = useCallback(() => {
    const remembered = sessionRef.current;
    if (rejoining.current && remembered?.inGame) updateSession({ ...remembered, inGame: false });
    stopRejoining();
    gameService.disconnect();
    setPlayerNumber(null);
    setGameState(null);
    setError(null);
  }, [stopRejoining, updateSession]);

  // The server holds the seat, so the list offers a one-click rejoin
  const backToGames = useCallback(() => {
    leave();
    const remembered = sessionRef.current;
    if (remembered?.inGame) updateSession({ ...remembered, inGame: false });
  }, [leave, updateSession]);

  return { playerNumber, gameState, gameType, error, session, join, leave, backToGames, rejoin };
}

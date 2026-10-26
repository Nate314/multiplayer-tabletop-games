import { useState, useEffect, useCallback, useRef } from 'react';
import gameService from '../services/gameService';
import { loadSession, saveSession, clearSession, type Session } from '../services/session';
import type { JoinLink } from '../services/share.ts';
import type { BasePublicState, JoinRole, Seat } from '../../shared/types.ts';

// After a refresh the old socket can still hold the seat for a moment, so a rejoin tries again a few times
const REJOIN_RETRIES = 5;
const REJOIN_RETRY_DELAY_MS = 1000;
const STILL_CONNECTED = ' is already in this game';

type Rejoining = { retriesLeft: number; timer?: ReturnType<typeof setTimeout> };

export default function useGameConnection(joinLink: JoinLink | null = null) {
  const [playerNumber, setPlayerNumber] = useState<Seat | null>(null);
  const [spectatorId, setSpectatorId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<BasePublicState | null>(null);
  const [gameType, setGameType] = useState<string | null>(null); // the game being played, remembered or not
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(loadSession);

  // The service handlers are set once, so they read the latest values from refs
  const sessionRef = useRef(session);
  const joiningGameType = useRef<string | null>(null); // the game a pending or current join is for
  const rejoining = useRef<Rejoining | null>(null); // set until a rejoin succeeds or gives up
  const seatKey = useRef<string | undefined>(undefined); // the key of the seat joined last
  const joinedAs = useRef<{ name: string; role: JoinRole }>({ name: '', role: 'player' }); // a spectator has no seat to take its name from

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
  const rememberIfStarted = useCallback((state: BasePublicState, seat: Seat | null) => {
    const type = joiningGameType.current;
    if (!type || !state.started) return;
    const { name, role } = joinedAs.current;
    const next: Session = {
      gameType: type, gameId: state.gameId, playerName: seat === null ? name : state.playerNames[seat],
      seatKey: seatKey.current, role: role === 'spectator' || role === 'tableScreen' ? role : undefined, inGame: true
    };
    const current = sessionRef.current;
    const unchanged = current?.inGame && current.gameType === next.gameType && current.gameId === next.gameId &&
      current.playerName === next.playerName && current.seatKey === next.seatKey && current.role === next.role;
    if (!unchanged) updateSession(next);
  }, [updateSession]);

  const stopRejoining = useCallback(() => {
    clearTimeout(rejoining.current?.timer);
    rejoining.current = null;
  }, []);

  const connect = useCallback((type: string, gameId: string, playerName: string, rejoin: boolean, role: JoinRole = 'player') => {
    joiningGameType.current = type;
    joinedAs.current = { name: playerName, role };
    // The remembered game's key, sent with any join to that game so a held seat can be taken back
    const remembered = sessionRef.current;
    const key = remembered?.gameType === type && remembered.gameId === gameId ? remembered.seatKey : undefined;
    gameService.connect(type, gameId, playerName, rejoin, key, role);
  }, []);

  const rejoin = useCallback(() => {
    const remembered = sessionRef.current;
    if (!remembered) return;
    stopRejoining();
    rejoining.current = { retriesLeft: REJOIN_RETRIES };
    setError(null);
    connect(remembered.gameType, remembered.gameId, remembered.playerName, true, remembered.role);
  }, [connect, stopRejoining]);

  useEffect(() => {
    // Read as each message arrives, since the handlers outlive any render
    let seat: Seat | null = null;
    let joined = false; // a spectator is joined with no seat

    gameService.onGameJoined = (data) => {
      stopRejoining();
      seat = data.playerNumber;
      joined = true;
      seatKey.current = data.seatKey;
      // After switching to a player the same socket is seated, so the role is no longer a spectator's
      if (data.playerNumber !== null) joinedAs.current = { ...joinedAs.current, role: 'player' };
      setPlayerNumber(data.playerNumber);
      setSpectatorId(data.spectatorId ?? null);
      setGameState(data.gameState);
      setGameType(joiningGameType.current);
      setError(null);
      rememberIfStarted(data.gameState, seat);
    };

    gameService.onGameState = (newGameState) => {
      setGameState(newGameState);
      setError(null);
      // The first move turns a lobby into a game worth coming back to
      if (joined) rememberIfStarted(newGameState, seat);
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
          if (remembered) connect(remembered.gameType, remembered.gameId, remembered.playerName, true, remembered.role);
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
      joined = false;
      setSpectatorId(null);
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
      joined = false;
      setSpectatorId(null);
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

  const join = useCallback((type: string, gameId: string, playerName: string, role: JoinRole = 'player') => {
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
    connect(type, trimmedGameId, trimmedName, false, role);
  }, [connect, stopRejoining]);

  // Leaving on purpose is not a lost connection, so no "Disconnected" message.
  // The remembered game is untouched, except that a rejoin cut short is offered again as the rejoin button.
  const leave = useCallback(() => {
    const remembered = sessionRef.current;
    if (rejoining.current && remembered?.inGame) updateSession({ ...remembered, inGame: false });
    stopRejoining();
    gameService.disconnect();
    setPlayerNumber(null);
    setSpectatorId(null);
    setGameState(null);
    setError(null);
  }, [stopRejoining, updateSession]);

  // The server holds the seat, so the list offers a one-click rejoin
  const backToGames = useCallback(() => {
    leave();
    const remembered = sessionRef.current;
    if (remembered?.inGame) updateSession({ ...remembered, inGame: false });
  }, [leave, updateSession]);

  return { playerNumber, spectatorId, gameState, gameType, error, session, join, leave, backToGames, rejoin };
}

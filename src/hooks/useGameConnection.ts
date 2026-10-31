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
  const [localSeatNumbers, setLocalSeatNumbers] = useState<Seat[] | null>(null); // a pass-and-play device's seats, null for any other join
  const [spectatorId, setSpectatorId] = useState<string | null>(null);
  const [credential, setCredential] = useState<string | undefined>(undefined); // the seat key, or for a spectator the spectator key; opens the history
  const [gameState, setGameState] = useState<BasePublicState | null>(null);
  const [gameType, setGameType] = useState<string | null>(null); // the game being played, remembered or not
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(loadSession);

  // The service handlers are set once, so they read the latest values from refs
  const sessionRef = useRef(session);
  const joiningGameType = useRef<string | null>(null); // the game a pending or current join is for
  const rejoining = useRef<Rejoining | null>(null); // set until a rejoin succeeds or gives up
  const seatKey = useRef<string | undefined>(undefined); // the key of the seat joined last
  const localKeys = useRef<{ seat: Seat; seatKey: string }[] | null>(null); // the keys of a pass-and-play device's seats
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
    const localSeats = localKeys.current?.map(({ seat: local, seatKey: key }) => ({ playerName: state.playerNames[local], seatKey: key }));
    const next: Session = {
      gameType: type, gameId: state.gameId, playerName: localSeats ? localSeats[0].playerName : seat === null ? name : state.playerNames[seat],
      seatKey: seatKey.current, role: role === 'spectator' || role === 'tableScreen' || localSeats ? role : undefined, localSeats, inGame: true
    };
    const current = sessionRef.current;
    const unchanged = current?.inGame && current.gameType === next.gameType && current.gameId === next.gameId &&
      current.playerName === next.playerName && current.seatKey === next.seatKey && current.role === next.role &&
      JSON.stringify(current.localSeats) === JSON.stringify(next.localSeats);
    if (!unchanged) updateSession(next);
  }, [updateSession]);

  const stopRejoining = useCallback(() => {
    clearTimeout(rejoining.current?.timer);
    rejoining.current = null;
  }, []);

  const connect = useCallback((
    type: string, gameId: string, playerName: string, rejoin: boolean, role: JoinRole = 'player', localNames?: string[]
  ) => {
    joiningGameType.current = type;
    joinedAs.current = { name: playerName, role };
    // The remembered game's key, sent with any join to that game so a held seat can be taken back
    const remembered = sessionRef.current;
    const sameGame = remembered?.gameType === type && remembered.gameId === gameId;
    if (role === 'passAndPlay') {
      // The keys follow the names, as remembered
      const seatKeys = rejoin && sameGame ? remembered.localSeats?.map(local => local.seatKey) : undefined;
      gameService.connect({ gameType: type, gameId, playerNames: localNames ?? [], rejoin, seatKeys, role });
      return;
    }
    gameService.connect({ gameType: type, gameId, playerName, rejoin, seatKey: sameGame ? remembered.seatKey : undefined, role });
  }, []);

  const connectRemembered = useCallback((remembered: Session) => {
    const names = remembered.localSeats?.map(local => local.playerName);
    connect(remembered.gameType, remembered.gameId, remembered.playerName, true, remembered.role, names);
  }, [connect]);

  const rejoin = useCallback(() => {
    const remembered = sessionRef.current;
    if (!remembered) return;
    stopRejoining();
    rejoining.current = { retriesLeft: REJOIN_RETRIES };
    setError(null);
    connectRemembered(remembered);
  }, [connectRemembered, stopRejoining]);

  useEffect(() => {
    // Read as each message arrives, since the handlers outlive any render
    let seat: Seat | null = null;
    let joined = false; // a spectator is joined with no seat

    gameService.onGameJoined = (data) => {
      stopRejoining();
      seat = data.playerNumber;
      joined = true;
      seatKey.current = data.seatKey;
      // Any of a shared device's seat keys opens the history
      setCredential(data.seatKey ?? data.localSeats?.[0]?.seatKey);
      localKeys.current = data.localSeats ?? null;
      setLocalSeatNumbers(data.localSeats?.map(local => local.seat) ?? null);
      // After switching to a player the same socket is seated, so the role is no longer a spectator's
      if (data.playerNumber !== null) joinedAs.current = { ...joinedAs.current, role: 'player' };
      // A shared device shows whichever seat the server says; no seat until the handoff is passed
      setPlayerNumber(data.localSeats ? data.gameState.shownSeat ?? null : data.playerNumber);
      setSpectatorId(data.spectatorId ?? null);
      setGameState(data.gameState);
      setGameType(joiningGameType.current);
      setError(null);
      // A rematch reseats into a lobby at the same ID; like any lobby it is not offered for rejoining, so the old game is forgotten
      const remembered = sessionRef.current;
      if (!data.gameState.started && remembered?.inGame && remembered.gameType === joiningGameType.current &&
        remembered.gameId === data.gameState.gameId) updateSession(null);
      rememberIfStarted(data.gameState, seat);
    };

    gameService.onGameState = (newGameState) => {
      setGameState(newGameState);
      if (localKeys.current) setPlayerNumber(newGameState.shownSeat ?? null);
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
          if (remembered) connectRemembered(remembered);
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

    // Told after a rematch that the seat is gone: forgotten like a dismissal, back to the list with the message
    gameService.onLeftGame = (message) => {
      stopRejoining();
      gameService.disconnect();
      seat = null;
      joined = false;
      setSpectatorId(null);
      setPlayerNumber(null);
      localKeys.current = null;
      setLocalSeatNumbers(null);
      setGameState(null);
      updateSession(null);
      setError(message);
    };

    gameService.onDisconnect = () => {
      stopRejoining();
      seat = null;
      joined = false;
      setSpectatorId(null);
      setPlayerNumber(null);
      localKeys.current = null;
      setLocalSeatNumbers(null);
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
      localKeys.current = null;
      setLocalSeatNumbers(null);
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
  }, [connectRemembered, joinLink, rejoin, rememberIfStarted, stopRejoining, updateSession]);

  const join = useCallback((type: string, gameId: string, playerName: string, role: JoinRole = 'player', localNames?: string[]) => {
    const trimmedGameId = gameId.trim();
    const trimmedName = playerName.trim();
    if (!trimmedGameId) {
      setError('Please enter a game ID');
      return;
    }
    if (!trimmedName && role !== 'passAndPlay') { // a shared device names its players in localNames
      setError('Please enter your name');
      return;
    }
    stopRejoining();
    setError(null);
    connect(type, trimmedGameId, trimmedName, false, role, localNames);
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

  // Dropping out of a rematch gives the seat up, so the list has nothing to rejoin
  const dropGame = useCallback(() => {
    leave();
    updateSession(null);
  }, [leave, updateSession]);

  // A game brought back from pause files: its new keys take the seats like any remembered game
  const resume = useCallback((next: Session) => {
    updateSession(next);
    rejoin();
  }, [rejoin, updateSession]);

  const showSeat = useCallback((seat: Seat | null) => gameService.showSeat(seat), []);

  // Only seats still in the game, named as the game state names them
  const localSeats = localSeatNumbers && gameState
    ? localSeatNumbers.filter(seat => gameState.activePlayers.includes(seat)).map(seat => ({ seat, name: gameState.playerNames[seat] }))
    : null;

  return { playerNumber, spectatorId, credential, gameState, gameType, error, session, localSeats, join, showSeat, leave, backToGames, dropGame, rejoin, resume };
}

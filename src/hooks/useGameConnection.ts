import { useState, useEffect, useCallback, useRef } from 'react';
import gameService from '../services/gameService';
import { loadSession, saveSession, clearSession, type Session } from '../services/session';
import type { BasePublicState, Seat } from '../../shared/types.ts';

// After a refresh the old socket can still hold the seat for a moment, so a rejoin tries again a few times
const REJOIN_RETRIES = 5;
const REJOIN_RETRY_DELAY_MS = 1000;
const STILL_CONNECTED = ' is already in this game';

type Rejoining = { retriesLeft: number; timer?: ReturnType<typeof setTimeout> };

export default function useGameConnection() {
  const [playerNumber, setPlayerNumber] = useState<Seat | null>(null);
  const [gameState, setGameState] = useState<BasePublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(loadSession);

  // The service handlers are set once, so they read the latest values from refs
  const sessionRef = useRef(session);
  const joiningGameType = useRef<string | null>(null); // the game a pending join is for
  const rejoining = useRef<Rejoining | null>(null); // set until a rejoin succeeds or gives up

  const updateSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) {
      saveSession(next);
    } else {
      clearSession();
    }
  }, []);

  const stopRejoining = useCallback(() => {
    clearTimeout(rejoining.current?.timer);
    rejoining.current = null;
  }, []);

  const connect = useCallback((gameType: string, gameId: string, playerName: string, rejoin: boolean) => {
    joiningGameType.current = gameType;
    gameService.connect(gameType, gameId, playerName, rejoin);
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
    gameService.onGameJoined = (data) => {
      stopRejoining();
      setPlayerNumber(data.playerNumber);
      setGameState(data.gameState);
      setError(null);
      // The server's spelling of the name and ID, so a rejoin matches exactly what was seated
      if (joiningGameType.current) {
        updateSession({
          gameType: joiningGameType.current,
          gameId: data.gameState.gameId,
          playerName: data.gameState.playerNames[data.playerNumber],
          inGame: true
        });
      }
    };

    gameService.onGameState = (newGameState) => {
      setGameState(newGameState);
      setError(null);
    };

    gameService.onError = (message) => {
      const attempt = rejoining.current;
      if (!attempt) {
        setError(message);
        return;
      }
      if (sessionRef.current && message.endsWith(STILL_CONNECTED) && attempt.retriesLeft > 0) {
        attempt.retriesLeft -= 1;
        attempt.timer = setTimeout(() => {
          const remembered = sessionRef.current;
          if (remembered) connect(remembered.gameType, remembered.gameId, remembered.playerName, true);
        }, REJOIN_RETRY_DELAY_MS);
        return;
      }
      // The game is gone, the player was dismissed, or the seat stayed taken: forget it and say why
      stopRejoining();
      gameService.disconnect();
      updateSession(null);
      setError(message);
    };

    gameService.onDisconnect = () => {
      stopRejoining();
      setPlayerNumber(null);
      setGameState(null);
      setError('Disconnected from server');
      // The seat is held on the server, so the list offers it again
      const remembered = sessionRef.current;
      if (remembered?.inGame) updateSession({ ...remembered, inGame: false });
    };

    // A page that went away mid-game (refresh, closed tab) takes its seat back
    if (sessionRef.current?.inGame) rejoin();

    return () => {
      stopRejoining();
      gameService.disconnect();
    };
  }, [connect, rejoin, stopRejoining, updateSession]);

  const join = useCallback((gameType: string, gameId: string, playerName: string) => {
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
    connect(gameType, trimmedGameId, trimmedName, false);
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
    if (remembered) updateSession({ ...remembered, inGame: false });
  }, [leave, updateSession]);

  return { playerNumber, gameState, error, session, join, leave, backToGames, rejoin };
}

import { useCallback, useEffect, useState } from 'react'
import { GAME_INFOS } from '../games/infos.ts'
import ClientGameGate from './games/ClientGameGate.tsx'
import useGameConnection from './hooks/useGameConnection'
import GameList from './components/GameList'
import GameView from './components/GameView'
import JoinDialog from './components/JoinDialog'
import OpenGames from './components/OpenGames'
import OpenSavedGame from './components/OpenSavedGame'
import RejoinButton from './components/RejoinButton'
import ResumeGame from './components/ResumeGame'
import GitHubLink from './components/GitHubLink'
import SettingsButton from './components/SettingsButton'
import ThemeToggle from './components/ThemeToggle'
import { loadJoinForm, saveJoinForm } from './services/settings.ts'
import { joinRoleFor } from './services/openGames.ts'
import { parseJoinLink } from './services/share.ts'
import './App.scss'

function App() {
  // A /join/<game type>/<game ID> address, read once
  const [link] = useState(() => parseJoinLink(window.location.pathname, GAME_INFOS.map(({ id }) => id)))
  const [selectedId, setSelectedId] = useState<string | null>(link?.gameType ?? null)
  // Kept here so the form is still filled in after leaving or a disconnect
  // The last name and game ID used to join, read once
  const [initialForm] = useState(loadJoinForm)
  const [playerName, setPlayerName] = useState(initialForm.playerName)
  const [gameId, setGameId] = useState(link?.gameId ?? initialForm.gameId)
  const [role, setRole] = useState(initialForm.role)
  const [localNames, setLocalNames] = useState(initialForm.localNames ?? ['', ''])
  const { playerNumber, spectatorId, credential, gameState, gameType, error, session, localSeats, join, showSeat, leave, backToGames, dropGame, rejoin, resume } = useGameConnection(link)
  // So a refresh or Back does not reopen the dialog, and a stale ?game= does not make the service worker think this tab shows that game
  useEffect(() => {
    if (window.location.pathname.startsWith('/join/') || window.location.search) window.history.replaceState(null, '', '/')
  }, [])
  const joined = gameState !== null && (playerNumber !== null || spectatorId !== null || localSeats !== null)
  // The game on screen however it was joined: dialog, refresh or rejoin button
  const joinedGame = GAME_INFOS.find(({ id }) => id === gameType)
  // The remembered game the list offers to rejoin, which may differ from a lobby just left
  const sessionGame = GAME_INFOS.find(({ id }) => id === session?.gameType)

  // Leaving or losing the connection goes back to the list, not to the dialog
  const [wasJoined, setWasJoined] = useState(joined)
  if (joined !== wasJoined) {
    setWasJoined(joined)
    if (!joined) setSelectedId(null)
  }

  const openDialog = useCallback((id: string) => {
    // Clears an earlier error, such as a lost connection, so the new dialog starts clean
    leave()
    setSelectedId(id)
  }, [leave])

  const closeDialog = useCallback(() => {
    // Also drops a socket left open by a refused join
    leave()
    setSelectedId(null)
  }, [leave])

  const selected = GAME_INFOS.find(({ id }) => id === selectedId)

  if (joinedGame && joined) {
    // A refresh lands here straight away, so the game's code may still be downloading
    return (
      <ClientGameGate id={joinedGame.id} name={joinedGame.name}>
        {client => (
          <GameView
            game={joinedGame}
            client={client}
            gameState={gameState}
            playerNumber={playerNumber}
            spectatorId={spectatorId}
            credential={credential}
            localSeats={localSeats}
            onShowSeat={showSeat}
            error={error}
            onBack={backToGames}
            onDrop={dropGame}
          />
        )}
      </ClientGameGate>
    )
  }

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>Multiplayer Tabletop Games</h1>
        <GitHubLink />
        <SettingsButton />
        <ThemeToggle />
      </header>
      <main className="lobby-main">
        {error && !selected && <div className="lobby-error">{error}</div>}
        <div className="lobby-actions">
          {session && !session.inGame && sessionGame && (
            <RejoinButton gameName={sessionGame.name} gameId={session.gameId} onRejoin={rejoin} />
          )}
          <OpenSavedGame games={GAME_INFOS} />
          <ResumeGame games={GAME_INFOS} onReady={resume} />
          <a className="open-saved-game lobby-stats-link" href="/stats">Stats</a>
        </div>
        <OpenGames
          games={GAME_INFOS}
          onSelect={game => {
            setGameId(game.gameId)
            const info = GAME_INFOS.find(({ id }) => id === game.gameType)
            if (info) setRole(joinRoleFor(game, info.maxPlayers))
            openDialog(game.gameType)
          }}
        />
        <GameList games={GAME_INFOS} onSelect={openDialog} />
      </main>
      {selected && (
        <JoinDialog
          game={selected}
          playerName={playerName}
          gameId={gameId}
          error={error}
          onPlayerNameChange={setPlayerName}
          onGameIdChange={setGameId}
          role={role}
          onRoleChange={setRole}
          localNames={localNames}
          onLocalNamesChange={setLocalNames}
          onJoin={(joinRole = role) => {
            saveJoinForm({ playerName, gameId, role: joinRole, localNames })
            join(selected.id, gameId, joinRole === 'tableScreen' ? 'Table screen' : playerName, joinRole, localNames)
          }}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}

export default App

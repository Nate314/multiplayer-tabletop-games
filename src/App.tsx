import { useCallback, useState } from 'react'
import { GAMES } from '../games/registry.ts'
import { CLIENT_GAMES, type PlayableGame } from './clientGames.ts'
import useGameConnection from './hooks/useGameConnection'
import GameList from './components/GameList'
import GameView from './components/GameView'
import JoinDialog from './components/JoinDialog'
import GitHubLink from './components/GitHubLink'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

// Every game needs a screen as well as rules; a missing one fails at startup instead of hiding the game
const PLAYABLE_GAMES: PlayableGame[] = GAMES.map(({ info }) => {
  const client = CLIENT_GAMES[info.id]
  if (!client) throw new Error(`Game "${info.id}" has no entry in CLIENT_GAMES`)
  return { info, client }
})

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Kept here so the form is still filled in after leaving or a disconnect
  const [playerName, setPlayerName] = useState('')
  const [gameId, setGameId] = useState('')
  const { playerNumber, gameState, error, join, leave } = useGameConnection()
  const joined = gameState !== null && playerNumber !== null

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

  const selected = PLAYABLE_GAMES.find(({ info }) => info.id === selectedId)

  if (selected && joined) {
    return (
      <GameView
        game={selected.info}
        client={selected.client}
        gameState={gameState}
        playerNumber={playerNumber}
        error={error}
        onBack={leave}
      />
    )
  }

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>Multiplayer Tabletop Games</h1>
        <GitHubLink />
        <ThemeToggle />
      </header>
      <main className="lobby-main">
        {error && !selected && <div className="lobby-error">{error}</div>}
        <GameList games={PLAYABLE_GAMES} onSelect={openDialog} />
      </main>
      {selected && (
        <JoinDialog
          game={selected.info}
          faq={selected.client.faq}
          playerName={playerName}
          gameId={gameId}
          error={error}
          onPlayerNameChange={setPlayerName}
          onGameIdChange={setGameId}
          onJoin={() => join(selected.info.id, gameId, playerName)}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}

export default App

import { useCallback, useState } from 'react'
import { GAMES } from '../games/registry.ts'
import { CLIENT_GAMES } from './clientGames.ts'
import useGameConnection from './hooks/useGameConnection'
import GameList from './components/GameList'
import GameView from './components/GameView'
import JoinDialog from './components/JoinDialog'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

// A game shows up once it has a screen as well as rules
const PLAYABLE_GAMES = GAMES.map(game => game.info).filter(info => CLIENT_GAMES[info.id])

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

  const closeDialog = useCallback(() => {
    // Also drops a socket left open by a refused join
    leave()
    setSelectedId(null)
  }, [leave])

  const selected = PLAYABLE_GAMES.find(info => info.id === selectedId)
  const client = selected && CLIENT_GAMES[selected.id]

  if (selected && client && joined) {
    return (
      <GameView
        game={selected}
        client={client}
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
        <ThemeToggle />
      </header>
      <main className="lobby-main">
        {error && !selected && <div className="lobby-error">{error}</div>}
        <GameList games={PLAYABLE_GAMES} onSelect={setSelectedId} />
      </main>
      {selected && client && (
        <JoinDialog
          game={selected}
          faq={client.faq}
          playerName={playerName}
          gameId={gameId}
          error={error}
          onPlayerNameChange={setPlayerName}
          onGameIdChange={setGameId}
          onJoin={() => join(selected.id, gameId, playerName)}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}

export default App

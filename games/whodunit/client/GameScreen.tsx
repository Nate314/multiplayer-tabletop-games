import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { Die } from '../../../src/components/Dice';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import { PASSAGES } from '../board.ts';
import { SUSPECTS, nameOf } from '../content.ts';
import { whodunitInfo } from '../info.ts';
import Board from './Board';
import CardPicker from './CardPicker';
import Hand from './Hand';
import NotesSheet from './NotesSheet';
import ShowPrompt from './ShowPrompt';
import SuggestionLog from './SuggestionLog';
import animateMove, { dieKey } from './animateMove.ts';
import { trio } from './describeMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Action, Move, PublicGameState, Seat } from '../types.ts';

const makeMove = (move: Move) => gameService.makeMove(move);
const sendAction = (action: Action) => gameService.sendAction(action);

function turnMessage(state: PublicGameState, viewer: Seat): string {
  const { isGameOver, winners, playerNames, activePlayers, started, currentPlayer, out } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${winners.map(seat => playerNames[seat]).join(' and ')} wins` : 'Game over: nobody solved it';
  if (!started && activePlayers.length < whodunitInfo.minPlayers) return `Waiting for at least ${whodunitInfo.minPlayers} players`;
  if (out.includes(viewer)) return 'You are out of turns, but still show cards';
  if (currentPlayer === null) return '';
  if (currentPlayer !== viewer) return `${playerNames[currentPlayer]}'s turn`;
  return started ? 'Your turn' : 'You go first. Joining closes after the first move.';
}

// The turn holder's buttons, exactly the moves the rules allow in this phase. Keyed by moveCount, so a picker closes after every move
function Controls({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat }) {
  const [picking, setPicking] = useState<'suggest' | 'accuse' | null>(null);
  const { phase, positions, suspectOf, movedIn, destinations } = gameState;
  const here = positions[suspectOf[viewer]];
  const room = 'room' in here ? here.room : null;
  const button = (label: string, onClick: () => void) => <button key={label} type="button" className="wd-button" onClick={onClick}>{label}</button>;
  const accuse = button('Accuse', () => setPicking('accuse'));

  if (picking) return <CardPicker room={picking === 'suggest' ? room! : undefined} onMove={makeMove} onCancel={() => setPicking(null)} />;
  if (phase === 'start') {
    return (
      <div className="wd-buttons">
        {button('Roll', () => makeMove({ type: 'roll' }))}
        {room && PASSAGES[room] && button('Secret passage', () => makeMove({ type: 'passage' }))}
        {room && movedIn.includes(suspectOf[viewer]) && button(`Stay in ${nameOf(room)}`, () => makeMove({ type: 'stay' }))}
        {accuse}
      </div>
    );
  }
  if (phase === 'move') {
    return destinations.length === 0
      ? <div className="wd-buttons"><p className="wd-hint">Nowhere to go with this roll.</p>{button('Stay put', () => makeMove({ type: 'stayPut' }))}</div>
      : <p className="wd-hint">Pick a highlighted square or room on the board.</p>;
  }
  if (phase === 'room' || phase === 'end') {
    return (
      <div className="wd-buttons">
        {phase === 'room' && button('Suggest', () => setPicking('suggest'))}
        {accuse}
        {button('End turn', () => makeMove({ type: 'endTurn' }))}
      </div>
    );
  }
  return null; // showing: the suggester waits
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, started, moveCount,
    dice, hand, faceUp, playerNames, suspectOf, solution, handSizes, out } = gameState;
  const seated = activePlayers.includes(playerNumber);
  const ready = !isGameOver && !undoVote && !dismissVote && (started || activePlayers.length >= whodunitInfo.minPlayers);
  const myTurn = ready && currentPlayer === playerNumber;
  const canUndo = undoAvailable && !undoVote && !dismissVote && seated && activePlayers.length >= 2;
  useMoveAnimation(screenRef, gameState, animateMove);

  return (
    <>
      <div className="wd-layout" ref={screenRef}>
        <div className="wd-board-area hand-only-board">
          <Board gameState={gameState} onMove={myTurn && gameState.phase === 'move' ? to => makeMove({ type: 'moveTo', to }) : undefined} />
        </div>
        <div className="wd-side">
          {seated && <div className="wd-you">You are {playerNames[playerNumber]}, playing {SUSPECTS.find(s => s.id === suspectOf[playerNumber])?.name}</div>}
          <div className={error ? 'game-status game-status-error' : 'game-status'} role="status">{error || gameStatus}</div>
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          {solution && <div className="wd-solution">The answer: {trio(solution)}</div>}
          {dice && currentPlayer !== null && (
            <div className="wd-dice" role="img" aria-label={`${playerNames[currentPlayer]} rolled ${dice[0]} and ${dice[1]}`}>
              {dice.map((value, index) => <Die key={index} value={value} animKey={dieKey(index)} />)}
            </div>
          )}
          {myTurn && <Controls key={moveCount} gameState={gameState} viewer={playerNumber} />}
          {ready && <ShowPrompt gameState={gameState} viewer={playerNumber} onMove={makeMove} />}
          {canUndo && <button type="button" className="wd-button wd-quiet" onClick={() => gameService.requestUndo()}>Undo</button>}
          {seated && <Hand cards={hand} label="Your cards" />}
          {Object.entries(faceUp).filter(([, cards]) => cards.length > 0).map(([seat, cards]) => (
            <Hand key={seat} cards={cards} label={`${playerNames[Number(seat)]}'s cards, face up`} />
          ))}
          <ul className="wd-players" aria-label="Players">
            {activePlayers.map(seat => (
              <li key={seat} className={seat === currentPlayer ? 'wd-current' : undefined}>
                {playerNames[seat]} ({SUSPECTS.find(s => s.id === suspectOf[seat])?.name}): {handSizes[seat] ?? 0} cards{out.includes(seat) ? ', out' : ''}
              </li>
            ))}
          </ul>
          <SuggestionLog gameState={gameState} viewer={playerNumber} />
          {seated && <NotesSheet gameState={gameState} onAction={isGameOver ? undefined : sendAction} />}
        </div>
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}

import { useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import GuessRows from './GuessRows';
import ColorPicker from './ColorPicker';
import RaceProgress from './RaceProgress';
import HistoryBoard from './HistoryBoard';
import { RoundSummaryView, Totals } from './RoundRows';
import { houseRule } from '../../../shared/houseRules.ts';
import { modeOf, playsAtOnce } from '../../../shared/puzzleModes.ts';
import { CODEBREAKER_MODE, CODE_RULE, MAX_GUESSES, ROUNDS_EACH, codeShape } from '../options.ts';
import type { Mode } from '../options.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Board, Color, PublicGameState, Seat } from '../types.ts';

const isFinished = (board: Board): boolean => board.broken || board.guesses.length >= MAX_GUESSES;
const emptyRow = (pegs: number): (Color | null)[] => Array.from({ length: pegs }, () => null);
const nameOr = (gameState: PublicGameState, seat: Seat | null, fallback: string): string => seat === null ? fallback : gameState.playerNames[seat];

function turnMessage(gameState: PublicGameState, mode: Mode, me: Seat, myBoard: Board | null): string {
  const { isGameOver, activePlayers, phase, maker, currentPlayer } = gameState;
  if (isGameOver) return 'Game over';
  if (mode === 'classic') {
    if (activePlayers.length < 2) return 'Waiting for a second player';
    if (phase === 'summary') return 'Round over';
    if (phase === 'setting') return maker === me ? 'Your turn: set a code' : `Waiting for ${nameOr(gameState, maker, 'the maker')} to set the code`;
    return currentPlayer === me ? 'Your turn: break the code' : `${nameOr(gameState, currentPlayer, 'The breaker')} is breaking your code`;
  }
  if (mode === 'race') {
    if (!myBoard) return 'Watching the race';
    if (isFinished(myBoard)) return myBoard.broken ? 'You broke the code. Waiting for the others' : 'Out of guesses. Waiting for the others';
    return 'Break the code before the others';
  }
  return mode === 'together' ? 'Anyone can guess at any time' : 'Break the code';
}

export default function GameScreen({ gameState, playerNumber: me, error }: GameScreenProps<PublicGameState>) {
  const { activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, phase, maker, currentPlayer, board, boards, code, round, summary, gameStatus } = gameState;
  const mode = modeOf(gameState, CODEBREAKER_MODE);
  const { pegs, colors } = codeShape(houseRule(gameState, CODE_RULE));
  const seated = activePlayers.includes(me);
  const voting = !!undoVote || !!dismissVote;
  const myBoard: Board | null = mode === 'race' ? boards[me] ?? null : board;
  const myGuesses = mode === 'race' ? myBoard?.guesses.length ?? 0 : board.guesses.filter(guess => guess.by === me).length;
  const live = !isGameOver && seated && !voting;
  const classicLive = live && mode === 'classic' && activePlayers.length === 2;
  const setting = classicLive && phase === 'setting' && maker === me;
  const guessing = mode === 'classic'
    ? classicLive && phase === 'breaking' && currentPlayer === me
    : live && myBoard !== null && !isFinished(myBoard);

  // The row being built lives only in this browser; it empties once my guess (or code) lands, or the round or game moves on
  const draftKey = `${gameState.gameNumber ?? 1}:${round}:${phase}:${pegs}:${myGuesses}`;
  const [draftState, setDraftState] = useState({ key: draftKey, pegs: emptyRow(pegs) });
  const draft = draftState.key === draftKey ? draftState.pegs : emptyRow(pegs);
  const setDraft = (next: (Color | null)[]) => setDraftState({ key: draftKey, pegs: next });

  // Empties the row as it is sent, so an undo that brings back the same guess count does not bring back the sent row
  const submit = (row: Color[]) => {
    setDraft(emptyRow(pegs));
    if (setting) gameService.makeMove({ type: 'setCode', pegs: row });
    else if (playsAtOnce(mode)) gameService.sendAction({ type: 'guess', pegs: row });
    else gameService.makeMove({ type: 'guess', pegs: row });
  };

  // Together and Race: each player takes back only their own guesses, with no vote; a finished Race board stays as it is
  const ownUndo = playsAtOnce(mode);
  const canUndo = ownUndo
    ? live && myBoard !== null && myGuesses > 0 && !(mode === 'race' && isFinished(myBoard))
    : live && undoAvailable;

  return (
    <div className="cb-layout">
      <div className="cb-board-area">
        {mode === 'race' && !myBoard
          ? <HistoryBoard gameState={gameState} viewer={me} />
          : <GuessRows board={myBoard ?? board} code={code} pegs={pegs} names={mode === 'together' ? playerNames : null}
              label={mode === 'race' ? 'Your guesses' : 'Guesses'} />}
        <UndoVote gameState={gameState} playerNumber={me} onVote={approve => gameService.voteUndo(approve)} />
      </div>
      <div className="cb-side-panel">
        {(error || gameStatus) && <div className={error ? 'cb-status cb-status-error' : 'cb-status'}>{error || gameStatus}</div>}
        <div className={setting || guessing ? 'cb-turn cb-your-turn' : 'cb-turn'}>{turnMessage(gameState, mode, me, myBoard)}</div>
        {(setting || guessing) && (
          <ColorPicker colors={colors} draft={draft} onChange={setDraft} onSubmit={submit}
            submitLabel={setting ? 'Set code' : 'Submit guess'} title={setting ? 'Your code' : 'Your guess'} />
        )}
        <button type="button" className="cb-button cb-secondary cb-undo"
          onClick={() => ownUndo ? gameService.undoOwn() : gameService.requestUndo()} disabled={!canUndo}>
          {ownUndo ? 'Undo my last move' : 'Undo'}
        </button>
        {mode === 'classic' && activePlayers.length === 2 && (
          <div className="cb-classic-info">
            <div className="cb-panel-title">
              Round {round} of {2 * ROUNDS_EACH}{maker !== null && `: ${playerNames[maker]} makes the code`}
            </div>
            <Totals gameState={gameState} viewer={me} />
          </div>
        )}
        {mode === 'race' && <RaceProgress gameState={gameState} exclude={me} viewer={me} />}
      </div>
      {mode === 'classic' && phase === 'summary' && summary && seated && !isGameOver && (
        <RoundSummaryView summary={summary} gameState={gameState} playerNumber={me} />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import Card from './Card';
import MissionSummary from './MissionSummary';
import Table from './Table';
import animateMove, { sortedHand } from './animateMove.ts';
import { handKey } from '../../../src/animation/animKeys.ts';
import { MIN_PLAYERS, canPlayCard, cardName, sameCard, trueTokens } from '../rules.ts';
import { LAST_MISSION, allowsHandOver, missionOf } from '../missions.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Card as CardData, Direction, PublicGameState } from '../types.ts';

const MISSION_NUMBERS = Array.from({ length: LAST_MISSION }, (_, i) => i + 1);

const DECISION_PROMPTS: Record<string, string> = {
  sick: 'Who is sick? Ask everyone "good" or "bad", then choose',
  mute: 'Who may not communicate in this mission?',
  takesAll: 'Ask everyone "yes" or "no", then choose who takes all the tasks',
  exactlyOneTrick: 'Ask everyone "yes" or "no", then choose who must win exactly one trick',
  firstAndLastOnly: 'Ask everyone "yes" or "no", then choose who must win only the first and last trick',
  relay: 'Decide together, then choose who wins tricks 1 to 4',
  relayLast: 'Now choose who wins only the last trick'
};

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [communicating, setCommunicating] = useState(false);
  const [selected, setSelected] = useState<CardData | null>(null); // a card picked to communicate or pass
  const [tokenFrom, setTokenFrom] = useState<number | null>(null);
  const [handOverTask, setHandOverTask] = useState('');
  const [handOverTo, setHandOverTo] = useState('');
  const [summaryClosed, setSummaryClosed] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const {
    currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, started, hand, phase, trick,
    tasks, commander, chosen, communications, distress, trickWinners, roundSummary, gameStatus, passedThisAttempt, handedOver
  } = gameState;
  const mission = missionOf(gameState.mission);
  const rule = mission.rule?.kind;
  const seated = activePlayers.length >= MIN_PLAYERS;
  const voting = undoVote !== null || dismissVote !== null;
  const live = seated && !isGameOver && !voting;
  const isMyTurn = live && currentPlayer === playerNumber;
  const beforeFirstTrick = phase === 'play' && trickWinners.length === 0 && trick.length === 0;
  const canUndo = undoAvailable && !voting && activePlayers.includes(playerNumber) && seated;
  const canCommunicate = live && phase === 'play' && trick.length === 0 && !communications[playerNumber]
    && !(rule === 'mute' && chosen[0] === playerNumber) && !(mission.commsFrom && trickWinners.length + 1 < mission.commsFrom);
  const passing = live && phase === 'distress' && distress !== null && !distress.passed.includes(playerNumber);
  const canCallDistress = isMyTurn && beforeFirstTrick && !passedThisAttempt && Object.keys(communications).length === 0;
  const canHandOver = isMyTurn && beforeFirstTrick && !handedOver && allowsHandOver(mission, activePlayers.length);

  useMoveAnimation(screenRef, gameState, animateMove);

  useEffect(() => {
    // A new turn or step starts with nothing picked
    setSelected(null);
    setCommunicating(false);
    setTokenFrom(null);
  }, [currentPlayer, phase, trick.length]);

  useEffect(() => {
    if (!isGameOver) setSummaryClosed(false);
  }, [isGameOver]);

  const playing = isMyTurn && phase === 'play' && !communicating;
  const clickable = (card: CardData) => {
    if (passing) return card.suit !== 'rocket';
    if (communicating) return trueTokens(hand, card).length > 0;
    return playing && canPlayCard(hand, card, trick);
  };
  function pick(card: CardData) {
    if (passing || communicating) setSelected(current => (current && sameCard(current, card) ? null : card));
    else gameService.makeMove({ type: 'play', card });
  }

  function communicate(token?: string) {
    if (!selected) return;
    gameService.sendAction({ type: 'communicate', card: selected, token });
    setCommunicating(false);
    setSelected(null);
  }

  function pickTokenTask(index: number) {
    if (tokenFrom === null) setTokenFrom(index);
    else if (tokenFrom === index) setTokenFrom(null);
    else gameService.makeMove({ type: 'moveToken', from: tokenFrom, to: index });
  }

  let taskPick;
  if (isMyTurn && phase === 'choose') {
    taskPick = { label: 'Take', enabled: () => true, onPick: (task: number) => gameService.makeMove({ type: 'takeTask', task }) };
  } else if (isMyTurn && phase === 'tokens') {
    const swap = rule === 'swapTokens';
    taskPick = {
      label: tokenFrom === null ? 'Move the token of' : swap ? 'Swap with' : 'Move to',
      enabled: (index: number) => tokenFrom === null ? tasks[index].token !== null
        : index === tokenFrom || (swap ? tasks[index].token !== null : tasks[index].token === null),
      selected: tokenFrom === null ? [] : [tokenFrom],
      onPick: pickTokenTask
    };
  }

  let hint: string | null = null;
  if (isGameOver || !live) hint = null;
  else if (passing) hint = `Distress signal: pick a card (not a rocket) to pass to the ${distress?.direction}`;
  else if (communicating) hint = 'Pick the card to communicate: your highest, lowest or only card of its color';
  else if (isMyTurn) {
    if (phase === 'tokens') hint = tokenFrom === null ? 'Pick a task whose order token moves, or keep them' : 'Now pick where it goes';
    else if (phase === 'choose') hint = 'Take a task';
    else if (phase === 'decision') hint = DECISION_PROMPTS[rule === 'relay' && chosen.length === 1 ? 'relayLast' : rule ?? ''] ?? null;
    else if (phase === 'distribute') hint = 'Ask everyone "yes" or "no" about the task shown, then give it to someone';
    else if (phase === 'play') hint = trick.length === 0 ? 'Lead any card' : 'Follow suit if you can';
  }

  let turn = '';
  if (isGameOver) turn = 'Game over';
  else if (!seated) turn = `The Crew needs 3 to 5 players (${activePlayers.length} seated)`;
  else if (phase === 'missionOver') turn = 'The mission is over';
  else if (phase === 'distress') turn = 'Everyone passes a card';
  else if (currentPlayer !== null) {
    turn = currentPlayer === playerNumber ? 'Your turn' : `${playerNames[currentPlayer]}'s turn`;
    if (!started) turn += '. Joining closes after the first move.';
  }

  const others = activePlayers.filter(seat => !(rule === 'relay' && chosen.includes(seat)));
  const decisionSeats = rule === 'mute' || rule === 'takesAll' ? others.filter(seat => seat !== commander) : others;
  const openTask = tasks.find(task => task.owner === null);

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turn}</div>
          <div className="hint">{hint}</div>
          {!started && activePlayers.includes(playerNumber) && (
            <label className="mission-choice">
              Starting mission{' '}
              <select value={gameState.startMission}
                onChange={event => gameService.sendAction({ type: 'chooseMission', mission: Number(event.target.value) })}>
                {MISSION_NUMBERS.map(number => <option key={number} value={number}>{number}</option>)}
              </select>
            </label>
          )}
          <div className="action-buttons">
            {isMyTurn && phase === 'tokens' && (
              <button type="button" onClick={() => gameService.makeMove({ type: 'keepTokens' })}>Keep the tokens</button>
            )}
            {isMyTurn && phase === 'decision' && decisionSeats.map(seat => (
              <button key={seat} type="button" onClick={() => gameService.makeMove({ type: 'choosePlayer', seat })}>
                Choose {playerNames[seat]}
              </button>
            ))}
            {isMyTurn && phase === 'distribute' && openTask && activePlayers.map(seat => (
              <button key={seat} type="button" onClick={() => gameService.makeMove({ type: 'assignTask', seat })}>
                Give to {playerNames[seat]}
              </button>
            ))}
            {canCommunicate && !communicating && (
              <button type="button" onClick={() => setCommunicating(true)}>Communicate</button>
            )}
            {communicating && selected && (mission.deadSpot ? (
              <button type="button" onClick={() => communicate()}>Communicate {cardName(selected)}</button>
            ) : trueTokens(hand, selected).map(token => (
              <button key={token} type="button" onClick={() => communicate(token)}>
                {cardName(selected)} is my {token}
              </button>
            )))}
            {communicating && <button type="button" onClick={() => { setCommunicating(false); setSelected(null); }}>Cancel</button>}
            {passing && selected && (
              <button type="button" onClick={() => gameService.sendAction({ type: 'passCard', card: selected })}>
                Pass {cardName(selected)}
              </button>
            )}
            {canCallDistress && (['left', 'right'] as Direction[]).map(direction => (
              <button key={direction} type="button" onClick={() => gameService.makeMove({ type: 'distress', direction })}>
                Distress signal: pass {direction}
              </button>
            ))}
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
            {isGameOver && roundSummary && summaryClosed && (
              <button type="button" onClick={() => setSummaryClosed(false)}>Show the mission</button>
            )}
          </div>
          {canHandOver && (
            <div className="hand-over" role="group" aria-label="Hand over a task">
              <select aria-label="Task to hand over" value={handOverTask} onChange={event => setHandOverTask(event.target.value)}>
                <option value="">Task</option>
                {tasks.map((task, index) => task.card && (
                  <option key={index} value={index}>{cardName(task.card)} ({playerNames[task.owner ?? 0]})</option>
                ))}
              </select>
              <select aria-label="Hand it to" value={handOverTo} onChange={event => setHandOverTo(event.target.value)}>
                <option value="">To</option>
                {activePlayers.map(seat => <option key={seat} value={seat}>{playerNames[seat]}</option>)}
              </select>
              <button type="button" disabled={handOverTask === '' || handOverTo === ''}
                onClick={() => gameService.makeMove({ type: 'handOverTask', task: Number(handOverTask), to: Number(handOverTo) })}>
                Hand over
              </button>
            </div>
          )}
          {phase === 'distress' && distress && (
            <div className="distress-info">
              Passing to the {distress.direction}: {distress.passed.length} of {activePlayers.length} ready
              {distress.mine && <> (you pass {cardName(distress.mine)})</>}
            </div>
          )}
        </div>
        <Table gameState={gameState} viewer={playerNumber} taskPick={taskPick} />
        <section className={playing || passing || communicating ? 'hand' : 'hand hand-waiting'} aria-label="Your hand">
          <header className="hand-header">Your hand ({hand.length})</header>
          <div className="hand-cards">
            {sortedHand(hand).map((card, slot) => (
              <Card key={slot} card={card} animKey={handKey(slot)} playable={clickable(card)}
                selected={selected !== null && sameCard(selected, card)} onClick={() => pick(card)} />
            ))}
          </div>
        </section>
      </div>
      {roundSummary && !(isGameOver && summaryClosed) && (
        <MissionSummary
          summary={roundSummary}
          gameState={gameState}
          playerNumber={playerNumber}
          onContinue={() => gameService.sendAction({ type: 'acknowledgeRound' })}
          onVote={yes => gameService.sendAction({ type: 'voteEnd', yes })}
          onClose={() => setSummaryClosed(true)}
        />
      )}
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={approve => gameService.voteUndo(approve)} />
    </>
  );
}

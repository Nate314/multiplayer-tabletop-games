import Tile from './Tile';
import { lineKey } from './animateMove.ts';
import { seatKey } from '../../../src/animation/animKeys.ts';
import { Fragment } from 'react';
import { boardOf, lineOf, openEnds } from '../board.ts';
import { targetScore } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // null in the history dialog
  // Highlights who made the last move and the tile it played; for the history dialog
  showLastMove?: boolean;
  // Given only when you may draw; the boneyard is then a button
  onDraw?: () => void;
};

// What goes before the i-th of n open ends, so they read '3 and 4' or '3, 4 and 6'
const separator = (i: number, n: number) => (i === 0 ? '' : i === n - 1 ? ' and ' : ', ');

// Every player's score and tile count in seat order, the boneyard, the open ends and the line
export default function Table({ gameState, viewer, showLastMove = false, onDraw }: TableProps) {
  const { handCounts, playerNames, currentPlayer, winners, lastMove, scores, roundNumber, boneyardCount, set } = gameState;
  const board = boardOf(gameState);
  const line = lineOf(board);
  const ends = openEnds(board).map(({ pips }) => pips);
  const seats = Object.keys(handCounts).map(Number).sort((a, b) => a - b);
  const lastMover = showLastMove ? lastMove?.playerNumber : undefined;
  const lastTile = showLastMove && lastMove?.type === 'play' ? lastMove.tile : null;

  return (
    <div className="table">
      <div className="round">Round {roundNumber}: first to {targetScore(seats.length)} points wins ({set === 6 ? 'double-six' : 'double-nine'})</div>
      <ol className="players">
        {seats.map(seat => {
          const count = handCounts[seat];
          const classes = ['player'];
          if (seat === currentPlayer) classes.push('player-current');
          if (winners.includes(seat)) classes.push('player-winner');
          if (seat === lastMover) classes.push('player-last');
          return (
            <li key={seat} className={classes.join(' ')} data-anim-key={seatKey(seat)}>
              <span className="player-name">
                {playerNames[seat]}
                {seat === viewer && ' (you)'}
                {winners.includes(seat) && ' ★'}
              </span>
              <span className="player-count">{count} {count === 1 ? 'tile' : 'tiles'}</span>
              <span className="player-score">{scores[seat] ?? 0} pts</span>
            </li>
          );
        })}
      </ol>
      <div className="boneyard">
        {onDraw ? (
          <button type="button" className="tile tile-back tile-playable" onClick={onDraw} aria-label="Draw a tile" />
        ) : (
          <span className="tile tile-back" />
        )}
        <span className="boneyard-label">Boneyard: {boneyardCount}</span>
      </div>
      <div className="line-ends">
        {line.length === 0 ? 'No tiles played yet' : (
          <>Open ends: {ends.map((pips, i) => (
            <Fragment key={i}>{separator(i, ends.length)}<span className="end-pips">{pips}</span></Fragment>
          ))}</>
        )}
      </div>
      <div className="line" role="list" aria-label="Line of play">
        {line.map(placed => (
          <span key={placed.tile} role="listitem" className="line-slot">
            <Tile pips={[placed.left, placed.right]} animKey={lineKey(placed.tile)} highlighted={placed.tile === lastTile} />
          </span>
        ))}
      </div>
    </div>
  );
}

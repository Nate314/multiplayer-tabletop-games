import { useState } from 'react';
import gameService from '../../../src/services/gameService';
import PlayingCard from '../../../src/components/PlayingCard';
import { useCountdown } from '../../../src/hooks/useCountdown.ts';
import { houseRule } from '../../../shared/houseRules.ts';
import { sameCard } from '../../../shared/playingCards.ts';
import { MUGGINS_RULE, MUGGINS_STYLE_RULE } from '../options.ts';
import { sideOf } from '../rules.ts';
import { describeItems } from '../scoring.ts';
import type { Card, PublicGameState, Seat } from '../types.ts';

type ShowPanelProps = {
  gameState: PublicGameState;
  viewer: Seat | null;
  controls: boolean; // false in the history dialog, during a vote or for a spectator
};

const MAX_CLAIM = 29;

// The count being shown: its cards and the starter, the breakdown once it may be seen, the owner's claim and the
// opponents' Muggins answers. Render with key={showIndex} so a new count starts with nothing selected.
export default function ShowPanel({ gameState, viewer, controls }: ShowPanelProps) {
  const { shows, showIndex, starter, playerNames, serverTime } = gameState;
  const show = shows[showIndex];
  const [claim, setClaim] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Card[]>([]);
  const msLeft = useCountdown(show?.closesAt ?? null, serverTime);
  if (!show || !starter) return null;

  const owner = playerNames[show.owner];
  const style = houseRule(gameState, MUGGINS_STYLE_RULE);
  const isOwner = viewer === show.owner;
  const opponent = viewer !== null && gameState.activePlayers.includes(viewer) && sideOf(gameState, viewer) !== sideOf(gameState, show.owner);
  const answered = viewer !== null && (show.passed.includes(viewer) || show.muggins.some(press => press.by === viewer));
  const claiming = controls && isOwner && show.claimed === null && houseRule(gameState, MUGGINS_RULE);
  const answering = controls && opponent && !answered && show.closesAt !== null;
  const points = Number(claim);
  const validClaim = claim !== '' && Number.isInteger(points) && points >= 0 && points <= MAX_CLAIM;
  const toggle = (card: Card) =>
    setSelected(cards => (cards.some(c => sameCard(c, card)) ? cards.filter(c => !sameCard(c, card)) : [...cards, card]));
  const pickable = answering && selecting;

  return (
    <section className="show-panel" aria-label="The show">
      <h2 className="show-title">{owner}'s {show.crib ? 'crib' : 'hand'}</h2>
      <div className="show-cards">
        {[...show.cards, starter].map((card, i) => (
          <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="small" highlighted={i === show.cards.length}
            selected={selected.some(c => sameCard(c, card))} onClick={pickable ? () => toggle(card) : undefined} />
        ))}
      </div>
      {show.items && <div className="show-breakdown">{describeItems(show.items)}</div>}
      {show.claimed !== null && <div className="show-claim">{owner} claimed {show.claimed}</div>}
      {show.claimed === null && !isOwner && !gameState.isGameOver && houseRule(gameState, MUGGINS_RULE) && <div className="show-claim">Waiting for {owner} to count</div>}
      {show.muggins.map(({ by, points: taken }, i) => (
        <div key={i} className="show-press">
          {playerNames[by]} called Muggins! {taken < 0 ? `Nothing was missed: it cost ${-taken}` : `and took ${taken}`}
        </div>
      ))}
      {show.passed.length > 0 && <div className="show-press">No Muggins: {show.passed.map(seat => playerNames[seat]).join(', ')}</div>}
      {msLeft !== null && <div className="show-clock">{Math.ceil(msLeft / 1000)} seconds left</div>}
      {claiming && (
        <form className="show-actions" onSubmit={event => { event.preventDefault(); if (validClaim) gameService.makeMove({ type: 'claim', points }); }}>
          <label>
            Your count <input type="number" min={0} max={MAX_CLAIM} step={1} inputMode="numeric" value={claim} onChange={event => setClaim(event.target.value)} />
          </label>
          <button type="submit" disabled={!validClaim}>Claim</button>
        </form>
      )}
      {answering && !selecting && (
        <div className="show-actions">
          <button type="button" onClick={() => (style === 'name' ? setSelecting(true) : gameService.sendAction({ type: 'muggins' }))}>Muggins!</button>
          <button type="button" onClick={() => gameService.sendAction({ type: 'noMuggins' })}>No Muggins</button>
        </div>
      )}
      {answering && selecting && (
        <div className="show-actions">
          <span className="show-hint">Tap the cards of a combination {owner} missed</span>
          <button type="button" disabled={!selected.length} onClick={() => gameService.sendAction({ type: 'muggins', cards: selected })}>Claim these</button>
          <button type="button" onClick={() => { setSelecting(false); setSelected([]); }}>Cancel</button>
        </div>
      )}
    </section>
  );
}

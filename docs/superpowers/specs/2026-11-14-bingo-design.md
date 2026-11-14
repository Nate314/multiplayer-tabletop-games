# Bingo

## Intent

Add Bingo (`bingo`, display name "Bingo") as a new game. The owner wants it as one more game on the site; no deeper driver.

## Goals, non-goals, anti-goals

- Goal: players take turns calling numbers, mark their own cards, and claim Bingo.
- Goal: per-tab checkboxes let the game run itself, the same way War's Auto-flip works.
- Non-goal: a timed server-side caller. The owner chose turn-based calling.
- Anti-goal: a way to peek at the next numbers through undo.

## Approaches

- A. Automatic timed caller on the server. Rejected by the owner.
- **B. Players take turns calling, plus Auto-call and Auto-mark checkboxes (chosen).**
- C. Timed caller with automatic marking. Rejected: nothing for players to do.

## Design

- **Cards.** Standard 75-ball cards: B 1-15, I 16-30, N 31-45, G 46-60, O 61-75, five random numbers per column, free center (N column has four numbers). Every player gets the same number of cards.
- **Calling.** On your turn, Call draws the next number from the shuffled 75, which everyone sees, and the turn passes on. Called numbers and the last call show above the cards.
- **Marking and claiming.** Marking a square and pressing Bingo! are out-of-turn moves any seated player can make at any time. Only a called number can be marked. The server checks a claim against the player's marks on all their cards; a claim that is not a Bingo is refused with "Not a Bingo yet" and no penalty.
- **Checkboxes** (browser-only, per tab, off after a reload, like War's Auto-flip): Auto-call calls for you about a second after your turn comes up; Auto-mark marks called numbers on your cards and claims Bingo for you when any card has one.
- **House rules:**
  - Cards per player: choice 1 to 12, default 1.
  - Pattern: Line (any full row, column or diagonal, default), Four corners, Blackout.
  - Play until: 1st place (default), 2nd place, 3rd place.
- **Places and ties.** Everyone with a valid claim before the next number is called shares that place. Placed players keep their calling turn so turn order never shifts; their cards are done. The game ends once the last place named by "Play until" is filled (or the 75 numbers run out, which cannot happen before a Line or Blackout is possible to claim).
- **Layout.** Cards shrink to compact 5x5 grids, two across on a phone and four across on a wide screen, page scrolls. A called number on any of your cards gets a soft highlight until marked. One Bingo! button checks all your cards.
- **Players.** 2 to 12. Pass and play allowed (cards are not secret). The table screen shows the called numbers board.
- **Undo.** The platform undo vote can take back a call; `onUndo` reshuffles the uncalled numbers.
- **Leaving.** The game continues while 2 or more players remain.
- **Docs.** README with Rules, Controls and "Differences from Wikipedia", plus a FAQ, like the other games.

## Calls made by Claude (owner approved the summary)

Auto-mark also auto-claims; no penalty for a false claim; ties share a place; placed players keep calling; 2-12 players; pass and play on; undo reshuffles.

## Left to the builder

Card generation details, highlight styling, the exact Auto-call delay (about one second, as in War), and test cases.

## Settled after the builder check (Claude's calls)

- **Places close on a timer.** A valid claim is confirmed and shown at once. The place stays open for claims until the next Call or 3 seconds after the first valid claim, whichever comes first (a platform `deadline`), so a game that is already decided never waits for someone to press Call.
- **Pass and play.** A shared device shows every local seat's cards, each section labelled with the player's name. Auto-call and Auto-mark apply to all local seats on that device.
- **Undo.** Marks are unrecorded actions (`applyAction`, `recordsAction` false). Calls and claims are recorded moves, so the undo vote takes back a call or a claim, never a mark. Undoing a call restores the state before it, including any places awarded after it.

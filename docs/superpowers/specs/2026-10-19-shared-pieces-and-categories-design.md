# Shared Pieces and Game Categories: Design

Date: 2026-10-19
Repo: `Nate314/multiplayer-tabletop-games`
Builds on: `master` at `b4aaada` (31 games)

## Intent

With 31 games on the site, the same logic and UI have been written many times over: the Continue step after a round, the round scoring dialog, partnership seats, per-player hand views, dice, deck building. This change moves those repeats into shared code and switches the existing games onto it, so the next game is quicker to build and a fix lands everywhere at once. It also groups the landing page by game type, and removes the last two "last move" aids now that the History dialog covers them.

No game is added (owner's decision). It is one PR.

## Goals

1. **Landing page grouped by type** (owner's decision). A heading per group, games alphabetical within each group, groups in this order:
   - **Card games:** Euchre, Go Fish, Hearts, Phase 10, Rack-O, Rook, Skip-Bo, Spades, Texas Hold'em, The Crew, UNO, War
   - **Dice games:** Farkle, Yahtzee
   - **Tile games:** Azul, Carcassonne, Dominoes, Rummikub, Scrabble
   - **Classic board games:** Backgammon, Checkers, Chess, Connect Four, Mancala, Parchisi, Quoridor
   - **Strategy board games:** Catan, Monopoly, Risk, Splendor, Ticket to Ride

   Each game declares its category in its `GameInfo` (a new required `category` field), so a new game cannot forget it.
2. **Remove the last-move aids** (owner's decision): Quoridor's "Show Last Move" button (hover and pin) with its board highlight, and Azul's outline around the source of the last move on the live table. The History dialog's own highlighting of the last move stays (Azul's `HistoryBoard` line highlight, every game's History view). READMEs and FAQs that mention the removed aids are updated.
3. **Shared pieces, with every existing game that repeats them switched over** (owner's decision: refactor, not just add):
   1. **Round Continue (server).** The "acknowledge the round summary, wait for every connected player, then deal the next round" logic in Uno, Phase 10, Rook, Spades, Euchre, Hearts, Dominoes, Rack-O, Azul and Texas Hold'em becomes one helper in `shared/`. Each game keeps its own summary field name and its own "deal the next round" step; the helper owns the checks, the seat list and the "is ready for the next hand/round" status. The Crew's mission flow is close enough to share it if it fits without changing behavior; otherwise it stays as is (builder's call).
   2. **Round scoring dialog (client).** One shared dialog component in `src/components/` holds the overlay, heading ("Hand N scoring" / "Final scoring" or the game's word), result line, "Waiting for ..." line and the Continue or Close button, with its CSS in `src/App.css` under `:where()` like the other platform pieces. Each game passes only its own rows. Used by the same games as 3.1 where their summary has that shape (Texas Hold'em's hand result panel and The Crew's mission summary only if they fit without changing what players see). A shared `plural(count, word)` helper replaces the copies.
   3. **Partnerships.** `shared/partnerships.ts` with the four-seat helpers Rook, Spades and Euchre each copy: the seat list, next seat, team of a seat, seats of a team, partner, team names ("Alice and Cara"), and the "partnership broken, the other team wins" ending when a player leaves. Hearts uses the next-seat helper.
   4. **Hand views.** One helper for "the viewer's own hand and everyone's card counts" in `toPublicState`, used by the 15 games that repeat it, plus a shared per-seat map helper replacing the `mapSeats` / `perSeat` copies.
   5. **Dice.** A shared server helper to roll one die and several dice from the platform's `random`, used by Backgammon, Catan, Monopoly, Risk, Parchisi, Farkle and Yahtzee. Client side, the shared `Dice` component (or a single-die piece split out of it) replaces the die drawing in Backgammon, Catan, Monopoly, Parchisi and Risk, keeping each game's extras (Backgammon and Parchisi's used dice, Parchisi's faces underneath doubles and bonus moves, Risk's red attack and white defend dice in two labelled groups, Catan's total) through props or wrapping. The die drawing is the same in all of them; the extras are only classes on a die or layout around the dice, so every one of these games is expected to use the shared die. Each game's dice must look as they do now (sizes, colors per theme), by retheming through the component's CSS variables or the game's scoped CSS.
   6. **Trick-taking.** Rook moves onto `shared/tricks.ts` (follow suit, trick winner), keeping the Rook card's special rules (it may always be played and is the highest trump). The identical "played / took the trick" move text in Rook, Spades and Euchre becomes one helper.
   7. **Standard deck with filters and jokers** (owner's decision). `standardDeck` takes options to keep only certain ranks (and suits) and to add jokers, so any game using a standard 52-card deck, filtered or with jokers, builds it through the shared code. Euchre's 9-to-ace deck is built this way; Hearts, Spades, Texas Hold'em, War and Go Fish keep calling it with no options. Joker support (a joker card type, its name, and how `PlayingCard` draws it) is added because the owner asked for it, though no current game uses jokers. Uno, Rook, Phase 10, Skip-Bo, Rack-O and The Crew keep their own decks, which are not standard decks.
   8. **Small repeats.** Shared animation key helpers for the card games' hand, seat and trick slots, and Scrabble's private client shuffle replaced by `shared/shuffle.ts`.

## Non-goals

- New games, new rules, house rules.
- Sharing the end vote (Hold'em, The Crew) or the lobby choice (Dominoes, The Crew): two games each, different shapes.
- Sharing the "whose turn" status message helpers, the per-game card faces (Uno, Rook, Phase 10, Skip-Bo, The Crew, Risk cards), player and score panels, or test helpers.
- Changing how any game looks or plays, beyond the two removed last-move aids and the grouped landing page.

## Anti-goals

- **Any change in a game's behavior** from the refactor: rules, move validation, error text, status text, what each player sees, animation, History, game files. The refactor is pure; a behavior change is a bug.
- A shared helper so general it is harder to read than the copies it replaced. If a game's copy needs more than a small option to fit, that game keeps its copy and the reason is noted.
- Saved games in SQLite or downloaded game files that no longer load. State shapes stay the same unless a change is unavoidable, and then old saved states still load.
- A hidden card reaching a browser that should not see it, through the new hand-view helper or anywhere else.

## Constraints

- No new npm dependency.
- Server code (`server/`, `shared/`, non-client game files) never imports from `src/` or any `games/<id>/client/`.
- Platform CSS goes under `:where()`; per-game CSS stays scoped under `[data-game="<id>"]`; light and dark themes both work.
- No em-dashes in docs, comments, READMEs, FAQs or commit messages.
- `npm test`, `npm run typecheck`, `npm run lint` and the full `npm run test:e2e` pass. The existing tests are the proof the refactor changed nothing; they are changed only where a test reached into code that moved (an import path, a renamed private helper), never to accept different behavior. The e2e tests for the removed last-move aids are removed or changed to match.
- `docs/architecture.md` lists the new shared pieces in its Contracts and platform sections, and says each game declares a category.
- One PR from a branch, as the owner's workflow requires.

## Left to the builder

- Exact names, signatures and file split of the shared helpers and components.
- Whether to work game by game or piece by piece, and whether to parallelize.
- Category ids and heading text (the groups and their order are fixed above), and the heading's look.
- Which per-game copies are too different to share, as long as the reason is written down.

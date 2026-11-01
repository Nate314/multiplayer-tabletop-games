# Pause and resume, Jenga turntable, Rummikub and other fixes

A batch of fixes and features from one list of ideas. Each numbered section below is its own piece of work, built on its own branch and merged into one integration branch at the end, so each section must stand on its own. Where a section says "my call", that is a decision made while writing this document, not something the user stated.

Uno needs no work: calling UNO is already implemented (arm the UNO! button before playing the next-to-last card, call late until caught, and others get a Catch button).

All prose written for this work (README, docs, FAQ, commit messages) uses no em-dashes.

## 1. Storage keys prefixed with the repository name

**Why:** several apps may be served from the same domain, and bare keys like `theme` or `preferences` collide with theirs.

- Every `localStorage` and `sessionStorage` key the app writes gets the prefix `multiplayer-tabletop-games:` (so `theme` becomes `multiplayer-tabletop-games:theme`).
- The prefix is applied in one place. `src/services/storage.ts` is the existing shared helper; the keys in `settings.ts`, `session.ts`, `device.ts` and the direct `localStorage` use in `ThemeToggle.tsx` all go through it (or through one prefixing function). Any inline script in `index.html` that reads the theme before React loads must use the same prefixed key.
- Migration (my call): once per browser, the app's old bare keys are copied to their prefixed names (never removed, since a bare key may belong to another app), and after that bare keys are never read. This keeps players' device ID, preferences, theme and seat after the update. The device ID matters most: losing it would detach a player from their stats and seats.
- Tests: the prefix is applied on read and write, and migration moves an old key once.

## 2. Rummikub

All in `games/rummikub`.

### 2a. Sorting replays on the next turn (bug)

**Observed:** after a player sorts their rack, the sort animation plays again when the next player's turn begins.

**Likely cause (not yet confirmed in the browser):** `useMoveAnimation` slides each tile from where it was at the previous move. A sort done between moves is not counted, so on the next move every rack tile slides again from its old, unsorted place. The builder confirms the cause in the browser first, then fixes it at the root (for example, rack tiles that the viewer did not play or draw should not slide from their place at the previous move, or the positions used for "from" should be refreshed after local rearranging). Expected: a move by someone else animates only what that move changed; the viewer's own rack does not move.

### 2b. Strict joker rule, fixed

Today the message "A joker taken from the table must be replaced by the tile it stands for" shows when a joker that was on the table at the start of the turn ends up standing for another tile, or is moved away from the tiles it was grouped with, and the tile it stood for was not put in its place. Two gaps against the official rules:

- The replacement tile may currently come from the table. It must come from the player's rack.
- A freed joker must be played in the same turn in a new or existing group that also uses at least two tiles from the player's rack (official rule: "used in the same turn, together with two tiles from the player's rack to form a new set"). Not checked today.

The strict rule stays the default, with both gaps fixed. Error messages say plainly which part failed.

### 2c. House rule: Jokers move freely

When on, jokers on the table can be rearranged like any other tile. The only requirement is the usual one: every group is valid at the end of the turn. No replacement tile is needed.

### 2d. House rule: Add to melds on your first turn

Today a player's first meld may not use or change the table.

When on, on the turn a player makes their initial meld they first lay 30 or more points in new groups from their rack. In that same turn they may then add more tiles from their rack to groups already on the table and to the groups they just laid. The added tiles do not count toward the 30. Adding only: splitting, moving or rearranging tiles already on the table still waits until a later turn (my call).

### 2e. Save a rearrangement

During their turn a player can press **Save** to keep the current arrangement of the table and their rack as a checkpoint. **Reset** then goes back to the last saved checkpoint instead of the start of the turn. Save is enabled only when the current arrangement is valid (every group a valid set or run and the play would be accepted, as the existing preview already checks), so Reset always returns to a valid state. A second press of Reset, or a Reset with no checkpoint, goes back to the start of the turn (my call). Checkpoints are local to the browser and end with the turn.

House rules use the existing house rules framework (see `docs/superpowers/specs/2026-10-24-house-rules-design.md`). Update the Rummikub README, its "Differences" section and FAQ.

## 3. Phase 10: play beyond the phase

When laying down a phase, a player may use more cards than the phase needs: a run of 8 or more for a run of 7, a set of 4 or more for a set of 3, more than 7 cards of one color for 7 of a color. Every requirement still has to be met, each by its own group. Extra groups beyond what the phase calls for are not allowed (my call, matching the official rules); extra cards go on by hitting afterward, as today. This is the default, not a house rule, since the official rules allow it. Update the README and FAQ, and any hint text that says "exactly".

## 4. Hide button

**Why:** someone walks by mid-game and the player wants their hand out of sight.

- A Hide button in the game page header, on every game.
- Pressing it covers everything secret on that player's screen: their hand, rack, hidden cards, tiles, and any other private information. Public parts of the table stay visible (my call: covering the whole game area is also acceptable if per-game masking is not practical; the builder decides, as long as nothing private stays readable).
- Press it again to show everything. It affects only that player's own screen, and nothing is sent to the server.
- While hidden, the player cannot act (they cannot see what they would be doing).

## 5. Home page accent follows the OS

The green accent on the landing page (and wherever the same accent token is used) follows the operating system's accent color where the browser exposes it, using the CSS `AccentColor` system color. Firefox and Safari support it; Chrome does not, and there the current green stays. Use a feature check (`@supports (color: AccentColor)`) so unsupported browsers keep the green. Text on accent backgrounds must stay readable in light and dark themes (use `AccentColorText` where text sits on the accent).

## 6. Scrabble ghost tile (bug)

When tiles are dealt to a player in Scrabble, the deal animation leaves a ghost tile on the screen. The cause is not known. The builder reproduces it in the browser, finds the root cause, and fixes it. Check whether the same cause affects other games that use the shared animation code, and fix it there too if so.

## 7. Join dialog and table screen

### 7a. Join dialog options on one line

The join dialog's four choices ("Player", "Spectator", "Pass and play", "Table screen") show:

- on one row when the screen is wide enough,
- two per row when it is not,
- one per row on a small phone screen,

with all buttons the same width at each size. The dialog grows wide enough for one row when the window allows. Check at several widths (see the `chrome-phone-width-checks` memory: use iframes for phone widths).

### 7b. Table screen with a game ID that does not exist

Choosing Table screen with a game ID that does not exist creates that game with nobody seated, and the table screen shows its QR code so people can join from their phones. The game type is the one chosen in the dialog.

### 7c. QR code button on the table screen

The table screen header gets a button that shows the join QR code at any time, including after the game has started, so more spectators can join. It closes with a button or Escape.

## 8. Jenga

All in `games/jenga`. Server physics stays the only judge.

- **Placing (default):** with a block in hand, the player drags it up to the top row and it snaps into an open spot (left, middle or right), which ends the turn. The player can still let go first to set the block on the table. The Place buttons stay for keyboard and devices that cannot draw 3D.
- **House rule: Free placement.** The player sets the block on top themselves, at the position and angle they drop it, and the physics decides what happens. A careless drop can shake or topple the tower. Jenga gets its first house rule (update the README line "Jenga has no house rules").
- **Camera:** when it is not your turn, you move the camera freely. When your turn starts, the camera snaps back to where it was at the end of your last turn (your first turn starts from the default view). During your turn you can only tilt the camera up and down.
- **Free placement details (my calls):** the block keeps the orientation it has in hand, laid across the level below like normal; the player chooses only where it goes. The turn ends once the block rests on the top of the tower and everything is still. A block that slides off onto the table without moving any other block goes back in hand to try again; if other blocks fall, that is a topple.
- **Turntable:** the tower stands on a turntable with visible markings so its facing is clear. During your turn, dragging left or right turns the turntable, which is a physics body the server simulates. Turning it hard or jerking it can make the tower sway or fall, and any fall during your turn is your topple. Other players see the turntable turn. The turntable's angle is game state (my calls): it stays where the last player left it, undo, History and pause files restore it, and a turntable still spinning blocks the next grab the way a moving tower does. The saved camera is measured against the turntable, so you come back to the same side of the tower you left. Keyboard: a key pair turns the turntable (the builder picks keys that do not clash with the existing controls and documents them).
- **Toppling at the end:** when the game ends, every player sees the tower fall until the blocks come to rest, and only then does the game-over screen appear.
- **History:** the first step is the untouched starting tower.
- Re-measure server tick cost after adding the turntable and update the README figures.

## 9. Pause and resume

**Why:** a game runs late, someone has to get up early, and the group wants to stop and finish another day. The players must be able to rebuild the game from their own files even if the server's database is lost.

### Pausing

- Any player can ask to pause. Everyone seated must agree, using the same voting pattern as undo. A pass and play device counts for each seat it holds.
- When the vote passes, every player is offered a download of their own pause file, and the game is closed for play.
- A paused game is kept on the server until it is resumed: the usual deletion 10 minutes after the last player leaves does not apply to it. It is deleted 30 days after the pause (decided after review, to stop abandoned pauses filling the server); the players' files still bring it back.
- While the paused game is still on the server, any player can download their file again from the game page (my call: the server keeps the key shares with the paused room, so a missed download is not fatal; they are deleted when the game resumes or is removed).

### The pause file

Each player's file holds:

- the game type, game ID, house rules, seat number and player name, and the move history needed for History,
- the public table state everyone can already see, in plain form,
- that player's own private state (their hand) in plain form,
- everything else that is secret (draw pile, bag, other players' hands, hidden grips) encrypted,
- that player's key share.

Encryption: the server makes a random key at pause time and splits it into one share per seat (XOR shares, so all shares are needed to rebuild the key). The secret state is encrypted with AES-GCM under that key. A single file cannot unlock anything; it takes every seat's file together. If every player colluded they could unlock it, which is accepted: "a bit" of protection, per the user.

Tamper check: the same key seals a fingerprint (HMAC) of the whole game, including every player's hand. On resume, after the key is rebuilt from all shares, the server checks the fingerprint, that the public parts match across all files, and that each file's plain hand matches the decrypted state. Any mismatch refuses the resume and names which seat's file does not match. The server keeps no key between sessions.

### Resuming

Either way, the game does not resume until every player who was seated at the pause is present again, in the same seats. Until then it shows a waiting screen naming who is still missing.

**From the server (the game still exists):** players rejoin as usual, by game ID, link or QR code, and take back their seats as they do after a disconnect. No file is needed.

**From files (the server lost the game):**

- From the landing page, a player chooses Resume a game and uploads their file. That opens a waiting room for that game, which others join by uploading their own files (and by the usual game ID or QR code).
- When every seat's file is in and the checks pass, play continues on the same turn with the same players in the same seats.
- A player who lost their file cannot resume that game from files (accepted).
- If a game with that ID already exists on the server, the upload goes to it only if it is the same paused game (same fingerprint); otherwise the resume is refused with a clear message (my call).
- The full move history, including past secret state, goes in the encrypted part, so History and undo keep working after a resume (my call). Compress it if size becomes a problem.
- The device that uploads a seat's file takes that seat, for rejoining and for stats (my call).
- Pausing mid-action (for example mid-pull in Jenga) first puts the action back the way undo would, so the file always holds a resting state (my call).

Files are JSON with a version number. The existing review-only export of finished games (`docs/superpowers/specs/2026-10-18-history-start-persistence-export-design.md`) stays as it is.

Games: every game whose state can be serialized. Each game declares which parts of its state are private to a seat and which are secret to everyone, using what the existing private seat view code already knows (`games/privateSeatView.test.ts`). Jenga's tower state is all public apart from the grips, which are secret.

## Not in scope

- Uno changes.
- Resuming with fewer players than were seated.
- Storing pause files on the server.

## Left to the builder

- Exact button placement and styling, within the existing look.
- Exact file and type layout of the pause file.
- Test coverage beyond what each section names, following the existing unit test and Playwright patterns.

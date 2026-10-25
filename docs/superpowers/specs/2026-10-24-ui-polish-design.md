# UI Polish Design

## Intent

Make the site easier to get into and to look around: share a game with one tap, find a game quickly on the landing page, and a History dialog that stays still and is less cluttered.

## Goals

- Share links that open the join dialog with the game ID filled in
- Search, sort and filter on the landing page, and a grid on wide screens
- A History dialog with a fixed size, a playback speed choice and a settings gear
- Checkboxes and selects themed like the buttons

## Non-goals

- Invites, accounts or a lobby browser of open games
- Changing what History shows

## Anti-goals

- The History dialog resizing between steps
- A phone layout that is worse than today's single column

## Share link (decided)

- A Share button in the game header
- On a device with the system share sheet (`navigator.share`), it opens it; otherwise it copies the link and shows "Link copied"
- The link is `/join/<game type>/<game ID>`. Opening it shows the landing page with that game's join dialog open, the game ID filled in and the player's last-used name prefilled (`loadJoinForm`)
- A link to a started game still opens the dialog; rejoining by your own name works as today. An unknown game type opens the landing page with no dialog
- The server's SPA fallback already serves `index.html` for paths without an extension (`server/static.ts`). Builder: confirm it covers `/join/...` and that the service worker (`public/sw.js`) does too

## Landing page (decided)

- A search box matching game names and descriptions
- A sort choice: by category (today's grouping, the default) or A to Z
- Category chips to show one or more categories
- A "Players" number filter showing games that support that many players. Counts reachable only with the house rules player-count override are included and marked "house rule" (my guess, approved by the user). Until the house rules PR is combined, filter on `minPlayers` and `maxPlayers` only
- Wide screens show game cards in a grid, 2 to 4 columns by width; phones keep the single column
- The search, sort and filters are remembered per browser

## History dialog (decided)

- Fixed at 90% of the window width and height, so it never resizes between steps; the board scales to fit inside it
- The row under the board is the slider, Play/Pause, and a settings gear to the right of the slider
- The gear opens a small themed panel holding every playback setting: Animations, Sounds (from the preferences PR, added when combined), Speed and, for saved games, "View as"
- Speed choices are 0.5x, 1x, 2x and 4x of today's `PLAY_STEP_MS`, remembered per browser like Animations
- While "View as" is inside the gear, the current choice is shown as a small label under the slider, so the viewer always knows whose view they see (my guess, approved by the user)

## Themed controls (decided)

- The Animations checkbox, the speed choice, "View as" and every new checkbox and select get the same look as the buttons, following each game's `--platform-*` theme variables in light and dark mode
- Builder: put the shared control styles in `src/App.scss` under `:where()` like the other platform defaults, so the preferences and house rules PRs can use them when combined

## When the branches are combined (my calls)

- The header gains Share (this PR), the settings gear (preferences PR) and, briefly, House rules (house rules PR). House rules is dropped in favor of the settings screen. Check the header at phone width and move less-used buttons into the settings screen if it crowds
- The Players filter switches to the house rules stretched ranges

## Constraints

- No new dependencies
- Check every changed layout at phone width and at least one wide width, in light and dark mode, for overlap and blank rows
- Styles in SCSS, matching PR #21
- Tests: unit tests for filtering and link parsing; e2e tests for the share link, filters and the History gear
- `docs/architecture.md` and the README are updated

## Left to the builder

- Exact breakpoints, chip and gear looks
- How the Players filter reads when empty

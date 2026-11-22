# Open games flag for run.ps1 and run.sh

## Intent

Let the owner turn the landing page's "Games happening now" list (`SHOW_OPEN_GAMES=true`, read in `server/server.ts`) on from the run script, without editing files. Today the container never receives the variable, so the scripts cannot turn it on at all.

## Goals, non-goals, anti-goals

- Goal: `.\run.ps1 -ShowOpenGames` and `./run.sh --show-open-games` start the stack with the list on.
- Goal: any run without the flag starts it with the list off, even if an earlier run turned it on.
- Non-goal: a saved setting. The choice lasts only for that run.
- Anti-goal: changing the shared `compose-launcher` submodule. The flag is handled in this project's wrappers only.

## Approaches

- A. Saved setting in `.env`, with show and hide flags. Rejected: the owner chose per-run.
- **B. Per-run flag (chosen).** Simple to explain, and a plain run always means "off".
- C. Edit `.env` by hand, no flag. Rejected: not what was asked.

## Design

- `docker-compose.yml`: the `app` service gets `environment: SHOW_OPEN_GAMES: ${SHOW_OPEN_GAMES:-false}`.
- `run.ps1`: before calling the launcher, remove every `-ShowOpenGames` from `$args` (case-insensitive, matching PowerShell's own convention) and set `$env:SHOW_OPEN_GAMES` to `true` if one was found, otherwise `false`. The shell value takes precedence over `.env`, so a stray `SHOW_OPEN_GAMES` line in `.env` cannot keep it on.
- `run.sh`: the same with `--show-open-games`, exporting `SHOW_OPEN_GAMES`.
- The flag may appear anywhere in the arguments, so `.\run.ps1 share -ShowOpenGames` works and ngrok never sees the flag.
- If the stack is already running, `docker compose up -d` recreates the container when the value changes, so the flag takes effect without a rebuild.
- README: document both flags next to the existing `SHOW_OPEN_GAMES` paragraph, including that a plain run turns the list off.

## Verification

Run `.\run.ps1 -ShowOpenGames` and check that `GET /api/open-games` returns 200 and the landing page shows the section in Chrome. Then run a plain `.\run.ps1` and check that the endpoint returns 404. Repeat with `run.sh` from Git Bash.

## Left to the builder

The exact argument-filtering code, and the README wording.

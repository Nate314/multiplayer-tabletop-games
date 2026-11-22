# Starts this project through the shared launcher, the git submodule in ./compose-launcher
# (https://github.com/Nate314/compose-launcher). The ports and printed URLs are in run.conf.
# No param() block on purpose: $args keeps compose flags such as -d intact.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path compose-launcher/run.ps1)) {
    git submodule update --init compose-launcher
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine('run.ps1: could not fetch the compose-launcher submodule. This needs a git clone of the project (not a zip download) and network access.')
        exit 1
    }
}
# -ShowOpenGames is consumed here and sets the server flag for this run only.
$rest = @($args | Where-Object { $_ -isnot [string] -or $_ -ine '-ShowOpenGames' })
$previous = $env:SHOW_OPEN_GAMES # put back afterwards, so a later docker compose in this shell does not inherit it
$env:SHOW_OPEN_GAMES = if ($args.Count -gt $rest.Count) { 'true' } else { 'false' }
try { & ./compose-launcher/run.ps1 @rest } finally { $env:SHOW_OPEN_GAMES = $previous }
exit $LASTEXITCODE

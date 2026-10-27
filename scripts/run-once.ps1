# Runs Reel Reactor once with headless Claude Code (CLI), appending output to ~/.reel-reactor/run.log.
# Called by the Task Scheduler entries that schedule-windows.ps1 creates. Requires the plugin to be installed.
# Desktop app users don't need this: use the app's Scheduled tasks instead (see README).

$dataDir = Join-Path $env:USERPROFILE ".reel-reactor"
$log = Join-Path $dataDir "run.log"
New-Item -ItemType Directory -Force $dataDir | Out-Null

Set-Location $dataDir
"`n===== $(Get-Date -Format s) =====" | Out-File -Append -Encoding utf8 $log

& claude -p "/reel-reactor:react" --model sonnet `
    --allowedTools "mcp__plugin_reel-reactor_playwright__*" Read Write Edit "Bash(node:*)" *>&1 |
    Out-File -Append -Encoding utf8 $log

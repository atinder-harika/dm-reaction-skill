# Runs Reel Reactor once, headless Claude Code, appending output to ~/.reel-reactor/run.log.
# Called by the Task Scheduler entries that schedule-windows.ps1 creates; also fine to run by hand.

$pluginRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $env:USERPROFILE ".reel-reactor"
$log = Join-Path $dataDir "run.log"
New-Item -ItemType Directory -Force $dataDir | Out-Null

Set-Location $dataDir
"`n===== $(Get-Date -Format s) =====" | Out-File -Append -Encoding utf8 $log

& claude --plugin-dir $pluginRoot `
    -p "Use the reel-reactor:react skill to run Reel Reactor now." `
    --allowedTools "mcp__playwright,Read,Write,Edit,Bash(node -e:*)" *>&1 |
    Out-File -Append -Encoding utf8 $log

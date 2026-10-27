# Registers one Windows Task Scheduler task per time in ~/.reel-reactor/config.json "schedule".
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 [-Remove]

param([switch]$Remove)

$prefix = "ReelReactor-"

Get-ScheduledTask -TaskName "$prefix*" -ErrorAction SilentlyContinue |
    Unregister-ScheduledTask -Confirm:$false
if ($Remove) {
    Write-Host "Removed all $prefix* tasks."
    return
}

$configPath = Join-Path $env:USERPROFILE ".reel-reactor\config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "No config at $configPath. Run the reel-reactor:setup skill first."
    exit 1
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Error "'claude' is not on PATH. Install Claude Code first."
    exit 1
}

$config = Get-Content $configPath -Raw -Encoding utf8 | ConvertFrom-Json
$runner = Join-Path $PSScriptRoot "run-once.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

foreach ($time in $config.schedule) {
    $name = $prefix + ($time -replace ":", "")
    $trigger = New-ScheduledTaskTrigger -Daily -At $time
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger `
        -Settings $settings -Description "Reel Reactor run at $time" | Out-Null
    Write-Host "Scheduled $name (daily at $time)"
}
Write-Host "Logs: $env:USERPROFILE\.reel-reactor\run.log"

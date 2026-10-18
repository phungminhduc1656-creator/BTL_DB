[CmdletBinding()]
param([switch]$All)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$pidFile=Join-Path $projectRoot '.local\app.pid'
$jarPath=Join-Path $projectRoot 'target\pickleball-manager-1.0.0.jar'
if (Test-Path -LiteralPath $pidFile) {
    $appProcessId=[int](Get-Content -LiteralPath $pidFile -Raw).Trim()
    $process=$null
    if (Get-Process -Id $appProcessId -ErrorAction SilentlyContinue) { $process=Get-CimInstance Win32_Process -Filter "ProcessId=$appProcessId" -OperationTimeoutSec 5 -ErrorAction SilentlyContinue }
    if ($process) {
        if ($process.Name -ne 'java.exe' -or -not $process.CommandLine.Contains($jarPath)) { throw 'Saved PID belongs to a different process; stopping was refused.' }
        Stop-Process -Id $appProcessId
        # Windows PowerShell can briefly list a process after Stop-Process returns.
        # Poll until it disappears before allowing the next build to replace the JAR.
        $remainingProcess=$null
        for ($attempt=0;$attempt -lt 75;$attempt++) {
            $remainingProcess=Get-Process -Id $appProcessId -ErrorAction SilentlyContinue
            if (-not $remainingProcess) { break }
            Start-Sleep -Milliseconds 200
        }
        if ($remainingProcess) { throw 'Java has not exited yet; do not rebuild while the JAR is still open.' }
        Write-Host 'Project Java app stopped. Data is preserved.'
    } else { Write-Host 'Project Java app is already stopped.' }
    Remove-Item -LiteralPath $pidFile -Force
    $portFile=Join-Path $projectRoot '.local\app.port'
    if(Test-Path -LiteralPath $portFile) { Remove-Item -LiteralPath $portFile -Force }
} else { Write-Host 'No saved project Java process.' }
if ($All) { & (Join-Path $PSScriptRoot 'stop-mysql.ps1') }

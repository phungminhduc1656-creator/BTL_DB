[CmdletBinding()]
param([switch]$ExistingDatabase,[switch]$SchemaReady,[switch]$SkipBuild,[int]$Port=8080)
$ErrorActionPreference='Stop'
# An already-open terminal may not inherit newly saved Windows User variables.
if ([string]::IsNullOrEmpty($env:DB_PASSWORD)) {
    $savedDatabasePassword=[Environment]::GetEnvironmentVariable('DB_PASSWORD','User')
    if (-not [string]::IsNullOrEmpty($savedDatabasePassword)) { $env:DB_PASSWORD=$savedDatabasePassword }
}
$projectRoot=Split-Path $PSScriptRoot -Parent
$localRoot=Join-Path $projectRoot '.local'
$jarPath=Join-Path $projectRoot 'target\pickleball-manager-1.0.0.jar'
$pidFile=Join-Path $localRoot 'app.pid'
$portFile=Join-Path $localRoot 'app.port'
if (Test-Path -LiteralPath $pidFile) {
    $ownedPid=[int](Get-Content -LiteralPath $pidFile -Raw).Trim()
    $owned=$null
    if (Get-Process -Id $ownedPid -ErrorAction SilentlyContinue) { $owned=Get-CimInstance Win32_Process -Filter "ProcessId=$ownedPid" -OperationTimeoutSec 5 -ErrorAction SilentlyContinue }
    if ($owned -and $owned.Name -eq 'java.exe' -and $owned.CommandLine.Contains($jarPath)) {
        $activePort=(Get-Content -LiteralPath $portFile -Raw).Trim()
        Write-Host "App is already running at http://127.0.0.1:$activePort. Run scripts/stop.ps1 before rebuilding."
        exit 0
    }
}
Push-Location -LiteralPath $projectRoot
try {
    if (-not $ExistingDatabase) { & (Join-Path $PSScriptRoot 'start-mysql.ps1') }
    $hasJar=Test-Path -LiteralPath $jarPath -PathType Leaf
    if ($SkipBuild -and -not $hasJar) {
        Write-Host 'Chua co JAR de tai su dung. Se bien dich Java trong lan chay nay.'
    }
    if (-not $SkipBuild -or -not $hasJar) {
        & (Join-Path $PSScriptRoot 'build.ps1')
    }
    if (-not (Test-Path -LiteralPath $jarPath -PathType Leaf)) { throw 'Chua co file ung dung Java. Mo BIEN_DICH_UNG_DUNG.bat va xem .local\logs\build.log.' }
    $javaCommand='java'
    if ($env:JAVA_HOME) { $javaCommand=Join-Path $env:JAVA_HOME 'bin\java.exe' }
    elseif (Test-Path -LiteralPath 'D:\Java\bin\java.exe') { $javaCommand='D:\Java\bin\java.exe' }
    $logRoot=Join-Path $localRoot 'logs'
    New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
    $outputLog=Join-Path $logRoot 'app.out.log'
    $errorLog=Join-Path $logRoot 'app.err.log'
    $setupFlag=(-not $SchemaReady).ToString().ToLowerInvariant()
    $arguments=@('-jar',"`"$jarPath`"","--app.setup=$setupFlag",'--app.seed=true',"--server.port=$Port")
    $appProcess=Start-Process -FilePath $javaCommand -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
    $ready=$false
    for($attempt=0;$attempt -lt 120;$attempt++) {
        if ($appProcess.HasExited) { throw "Java startup failed. See $outputLog and $errorLog." }
        if ((Test-Path -LiteralPath $outputLog) -and (Select-String -LiteralPath $outputLog -Pattern 'Application ready' -Quiet)) { $ready=$true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        if (-not $appProcess.HasExited) { Stop-Process -Id $appProcess.Id }
        throw "Java did not become ready. See $outputLog."
    }
    $appProcess.Id | Set-Content -LiteralPath $pidFile
    $Port | Set-Content -LiteralPath $portFile
    Write-Host "Open http://127.0.0.1:$Port - demo login admin / admin123"
    Write-Host 'App runs in the background. Stop with scripts/stop.ps1. Data is preserved.'
} finally { Pop-Location }

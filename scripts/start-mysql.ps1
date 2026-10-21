[CmdletBinding()]
param([string]$MysqlBase)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
$dataRoot = Join-Path $localRoot 'mysql'
$logRoot = Join-Path $localRoot 'logs'
. (Join-Path $PSScriptRoot 'mysql-tools.ps1')
$tools = Resolve-ProjectMySql -ProjectRoot $projectRoot -MysqlBase $MysqlBase
$MysqlBase = $tools.Base
$server = $tools.Server
$client = $tools.Client
$admin = $tools.Admin
Write-Host ('Using MySQL Server at '+$MysqlBase)
New-Item -ItemType Directory -Force -Path $dataRoot,$logRoot | Out-Null
$fresh = -not (Test-Path -LiteralPath (Join-Path $dataRoot 'mysql'))
if ($fresh) {
    Write-Host 'Initializing isolated MySQL data inside .local/mysql...'
    & $server --no-defaults "--basedir=$MysqlBase" "--datadir=$dataRoot" --initialize-insecure "--log-error=$(Join-Path $logRoot 'mysql-init.log')"
    if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed. See .local/logs/mysql-init.log.' }
}
$defaults = Join-Path $localRoot 'mysql-admin.cnf'
$adminArgs = @('--protocol=TCP','--host=127.0.0.1','--port=3307','--user=root')
if (Test-Path -LiteralPath $defaults) { $adminArgs = @("--defaults-extra-file=$defaults") + $adminArgs }
# Reuse only the MySQL process associated with this project's data directory.
$pidFile = Join-Path $localRoot 'mysql.pid'
$running = $false
$ownedProcess = $null
if (Test-Path -LiteralPath $pidFile) {
    $existingPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
    $existing = $null
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) { $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$existingPid" -OperationTimeoutSec 5 -ErrorAction SilentlyContinue }
    $running = $existing -and $existing.Name -eq 'mysqld.exe' -and $existing.CommandLine.Contains($dataRoot)
}
if (-not $running) {
    Write-Host 'Launching isolated MySQL at 127.0.0.1:3307...'
    $arguments = @('--no-defaults',"--basedir=`"$MysqlBase`"","--datadir=`"$dataRoot`"",'--port=3307','--bind-address=127.0.0.1','--mysqlx=OFF','--skip-log-bin',"--log-error=`"$(Join-Path $logRoot 'mysql.log')`"","--pid-file=`"$pidFile`"")
    $ownedProcess = Start-Process -FilePath $server -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'mysql-start.out.log') -RedirectStandardError (Join-Path $logRoot 'mysql-start.err.log') -PassThru
}
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    # Windows PowerShell 5 treats native stderr as an error record, even with 2>$null.
    # A connection refusal is expected while MySQL starts; decide by the exit code.
    $previousErrorPreference=$ErrorActionPreference
    $pingExitCode=1
    try {
        $ErrorActionPreference='Continue'
        & $admin @adminArgs --connect-timeout=1 ping 2>$null | Out-Null
        $pingExitCode=$LASTEXITCODE
    } finally { $ErrorActionPreference=$previousErrorPreference }
    if ($pingExitCode -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'MySQL did not become ready. Check .local/logs/mysql.log and whether port3307 is already used.' }
$verifiedPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
$verifiedProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$verifiedPid" -OperationTimeoutSec 5 -ErrorAction SilentlyContinue
if (-not $verifiedProcess -or $verifiedProcess.Name -ne 'mysqld.exe' -or -not $verifiedProcess.CommandLine.Contains($dataRoot)) { throw 'Server process is not the isolated MySQL in this workspace; provisioning was refused.' }
if (-not (Test-Path -LiteralPath $defaults)) {
    # New local root password stays in ignored .local/, never in process arguments.
    $rootPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    $sql = "CREATE DATABASE IF NOT EXISTS pickleball_db CHARACTER SET utf8mb4; CREATE USER IF NOT EXISTS 'pickleball_app'@'127.0.0.1' IDENTIFIED BY 'pickleball_local_2026'; GRANT ALL PRIVILEGES ON pickleball_db.* TO 'pickleball_app'@'127.0.0.1'; ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';"
    $sql | & $client @adminArgs
    if ($LASTEXITCODE -ne 0) { throw 'Local MySQL provisioning failed.' }
    $content = "[client]`nuser=root`npassword=$rootPassword`nhost=127.0.0.1`nport=3307`nprotocol=TCP`n"
    [IO.File]::WriteAllText($defaults,$content,[Text.UTF8Encoding]::new($false))
}
[IO.File]::WriteAllText((Join-Path $localRoot 'mysql-base.txt'),$MysqlBase,[Text.UTF8Encoding]::new($false))
Write-Host 'MySQL ready at 127.0.0.1:3307 (isolated project data).'

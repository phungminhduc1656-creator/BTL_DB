[CmdletBinding()]
param([string]$MysqlBase)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$dataRoot=Join-Path $projectRoot '.local\mysql'
$pidFile=Join-Path $projectRoot '.local\mysql.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Project MySQL is not running.'; exit 0 }
$mysqlProcessId=[int](Get-Content -LiteralPath $pidFile -Raw).Trim()
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$mysqlProcessId" -ErrorAction SilentlyContinue
if (-not $process -or $process.Name -ne 'mysqld.exe' -or -not $process.CommandLine.Contains($dataRoot)) { throw 'PID does not identify the MySQL instance in this workspace. Stopping was refused.' }
$defaults=Join-Path $projectRoot '.local\mysql-admin.cnf'
if (-not (Test-Path -LiteralPath $defaults)) { throw 'Missing project MySQL admin config. No unrelated process was stopped.' }
. (Join-Path $PSScriptRoot 'mysql-tools.ps1')
$tools=Resolve-ProjectMySql -ProjectRoot $projectRoot -MysqlBase $MysqlBase
& $tools.Admin "--defaults-extra-file=$defaults" shutdown
if ($LASTEXITCODE -ne 0) { throw 'Graceful MySQL shutdown failed.' }
# mysqladmin có thể trả về trước khi InnoDB đóng xong. Chờ PID file biến mất để không tái sử dụng server đang thoát.
for ($attempt=0;$attempt -lt 60;$attempt++) {
    if (-not (Test-Path -LiteralPath $pidFile)) { break }
    Start-Sleep -Milliseconds 500
}
if (Test-Path -LiteralPath $pidFile) { throw 'MySQL is still shutting down. Wait before starting it again.' }
Write-Host 'Project MySQL stopped. All data is preserved.'

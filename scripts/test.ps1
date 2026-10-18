[CmdletBinding()]
param([switch]$IncludeSqlChecks)
$ErrorActionPreference = 'Stop'
# An already-open terminal may not inherit newly saved Windows User variables.
if ([string]::IsNullOrEmpty($env:DB_PASSWORD)) {
    $savedDatabasePassword=[Environment]::GetEnvironmentVariable('DB_PASSWORD','User')
    if (-not [string]::IsNullOrEmpty($savedDatabasePassword)) { $env:DB_PASSWORD=$savedDatabasePassword }
}
$projectRoot = Split-Path $PSScriptRoot -Parent
$client = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
$defaults = Join-Path $projectRoot '.local\mysql-admin.cnf'
if (-not (Test-Path -LiteralPath $defaults)) { & (Join-Path $PSScriptRoot 'start-mysql.ps1') }
$sql = "CREATE DATABASE IF NOT EXISTS pickleball_integration_test CHARACTER SET utf8mb4; GRANT ALL PRIVILEGES ON pickleball_integration_test.* TO 'pickleball_app'@'127.0.0.1';"
$sql | & $client "--defaults-extra-file=$defaults"
if ($LASTEXITCODE -ne 0) { throw 'Cannot provision the dedicated integration test database.' }
if ($IncludeSqlChecks) {
    if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Use PowerShell7 (pwsh) for -IncludeSqlChecks.' }
    & (Join-Path $projectRoot 'database\tests\verify-mysql.ps1') -DefaultsFile $defaults
}
$previousFlag = $env:RUN_MYSQL_TESTS
$env:RUN_MYSQL_TESTS = 'true'
try {
    & (Join-Path $projectRoot 'mvnw.cmd') -q test
    $result = $LASTEXITCODE
} finally { $env:RUN_MYSQL_TESTS = $previousFlag }
exit $result

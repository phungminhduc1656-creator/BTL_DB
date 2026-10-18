[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'start-mysql.ps1')
$workbench=$null
foreach ($candidate in @('C:\Program Files\MySQL\MySQL Workbench 8.0\MySQLWorkbench.exe','C:\Program Files\MySQL\MySQL Workbench 8.0 CE\MySQLWorkbench.exe')) {
    if (Test-Path -LiteralPath $candidate) { $workbench=$candidate; break }
}
if (-not $workbench) { throw 'Khong tim thay MySQL Workbench. Cai MySQL Workbench hoac mo ket noi 127.0.0.1:3307 thu cong.' }
$sqlFile=Join-Path $projectRoot 'database\XEM_TOAN_BO_DB.sql'
Write-Host 'Mo CSDL pickleball_db: 127.0.0.1:3307, user pickleball_app.'
Write-Host 'Neu Workbench hoi mat khau, dung mat khau MySQL cua ung dung (xem README).'
Write-Host 'Ctrl+Shift+Enter trong SQL Editor de xem du lieu cac bang.'
Start-Process -FilePath $workbench -ArgumentList @('--query','pickleball_app@127.0.0.1:3307','--script',"`"$sqlFile`"") -WorkingDirectory $projectRoot -WindowStyle Normal | Out-Null

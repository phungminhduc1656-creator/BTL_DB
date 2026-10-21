[CmdletBinding()]
param([string]$MysqlBase)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'mysql-tools.ps1')
if ([string]::IsNullOrWhiteSpace($MysqlBase)) {
    Write-Host 'Nhap thu muc cai MySQL Server, vi du C:\Program Files\MySQL\MySQL Server 8.4'
    Write-Host 'Chon thu muc chua bin\mysqld.exe; MySQL Workbench khong phai MySQL Server.'
    $MysqlBase=Read-Host 'Thu muc MySQL Server'
}
if ([string]::IsNullOrWhiteSpace($MysqlBase)) { throw 'Chua nhap thu muc MySQL Server.' }
$MysqlBase=$MysqlBase.Trim().Trim('"')
$tools=Resolve-ProjectMySql -ProjectRoot $projectRoot -MysqlBase $MysqlBase
$localRoot=Join-Path $projectRoot '.local'
$existingData = (Test-Path -LiteralPath (Join-Path $localRoot 'mysql\mysql') -PathType Container) -or
    (Test-Path -LiteralPath (Join-Path $localRoot 'mysql\auto.cnf') -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $localRoot 'mysql\ibdata1') -PathType Leaf)
if ($existingData) {
    $currentTools=Resolve-ProjectMySql -ProjectRoot $projectRoot
    if (-not [string]::Equals($currentTools.Base,$tools.Base,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Du lieu MySQL cua bai da ton tai voi bo cai khac. Hay sao luu va chuyen du lieu theo huong dan MySQL truoc khi doi phien ban.'
    }
}
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
[IO.File]::WriteAllText((Join-Path $localRoot 'mysql-base.txt'),$tools.Base,[Text.UTF8Encoding]::new($false))
Write-Host ('Da luu thu muc MySQL: '+$tools.Base)
Write-Host 'Chay lai CHAY_UNG_DUNG.bat de mo ung dung Java.'

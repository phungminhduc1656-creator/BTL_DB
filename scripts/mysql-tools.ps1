# Shared discovery only: this file never starts MySQL or changes project data.
function Resolve-ProjectMySql {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$ProjectRoot,
        [string]$MysqlBase
    )
    $resolvedRoot = [IO.Path]::GetFullPath($ProjectRoot)
    $localRoot = Join-Path $resolvedRoot '.local'
    $dataRoot = Join-Path $localRoot 'mysql'
    $initialized = (Test-Path -LiteralPath (Join-Path $dataRoot 'mysql') -PathType Container) -or
        (Test-Path -LiteralPath (Join-Path $dataRoot 'auto.cnf') -PathType Leaf) -or
        (Test-Path -LiteralPath (Join-Path $dataRoot 'ibdata1') -PathType Leaf)

    function Get-MySqlInstallation([string]$Candidate) {
        if ([string]::IsNullOrWhiteSpace($Candidate)) { return $null }
        try {
            $basePath = [Environment]::ExpandEnvironmentVariables($Candidate.Trim().Trim('"'))
            if (-not [IO.Path]::IsPathRooted($basePath)) { $basePath = Join-Path $resolvedRoot $basePath }
            $basePath = [IO.Path]::GetFullPath($basePath)
            if ($basePath.Length -gt [IO.Path]::GetPathRoot($basePath).Length) {
                $basePath = $basePath.TrimEnd([char[]]'\/')
            }
            $result = [pscustomobject]@{
                Base = $basePath
                Server = Join-Path $basePath 'bin\mysqld.exe'
                Client = Join-Path $basePath 'bin\mysql.exe'
                Admin = Join-Path $basePath 'bin\mysqladmin.exe'
            }
            foreach ($binary in @($result.Server,$result.Client,$result.Admin)) {
                if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { return $null }
            }
            # MySQL 8+ features are required; mysql-compatible MariaDB tools
            # or an old 5.x server must not be selected just by their filenames.
            if ($basePath -match '(?i)(?:^|[\\/])MariaDB[^\\/]*(?:[\\/]|$)') { return $null }
            if ($basePath -match '(?i)(?:^|[\\/])MySQL Server (\d+)(?:\.\d+)*(?:\s[^\\/]*)?(?:[\\/]|$)') {
                if ([int]$Matches[1] -lt 8) { return $null }
            }
            try {
                $versionInfo = [Diagnostics.FileVersionInfo]::GetVersionInfo($result.Server)
                $product = @($versionInfo.ProductName,$versionInfo.ProductVersion,$versionInfo.CompanyName,$versionInfo.FileDescription) -join ' '
                if ($product -match '(?i)MariaDB') { return $null }
                if ($product -match '(?i)MySQL' -and $versionInfo.ProductVersion -match '(\d+)\.\d+') {
                    if ([int]$Matches[1] -lt 8) { return $null }
                }
            } catch { } # Metadata may be absent in a custom distribution.
            return $result
        } catch { return $null }
    }
    function Require-MySqlInstallation([string]$Candidate,[string]$Source) {
        $installation = Get-MySqlInstallation $Candidate
        if ($null -eq $installation) {
            throw "$Source khong hop le: '$Candidate'. Can MySQL Server 8.0 tro len (khong dung MariaDB/MySQL 5.x) va du 3 tep bin\mysqld.exe, bin\mysql.exe va bin\mysqladmin.exe. Cai MySQL Community Server (Workbench khong kem Server), roi chay CAU_HINH_MYSQL.bat hoac dat MYSQL_BASE / truyen -MysqlBase la thu muc cai Server, khong phai thu muc bin."
        }
        return $installation
    }

    # An explicit choice always wins, including an explicit failure.
    if (-not [string]::IsNullOrWhiteSpace($MysqlBase)) { return (Require-MySqlInstallation $MysqlBase '-MysqlBase') }
    if (-not [string]::IsNullOrWhiteSpace($env:MYSQL_BASE)) { return (Require-MySqlInstallation $env:MYSQL_BASE 'MYSQL_BASE') }

    $pinFile = Join-Path $localRoot 'mysql-base.txt'
    if (Test-Path -LiteralPath $pinFile -PathType Leaf) {
        $savedBase = ([string](Get-Content -LiteralPath $pinFile -Raw -Encoding UTF8 -ErrorAction Stop)).Trim()
        $installation = Get-MySqlInstallation $savedBase
        if ($installation) { return $installation }
        if ($initialized) {
            throw "Duong dan MySQL da luu tai .local/mysql-base.txt khong con hop le. Du lieu cu duoc giu nguyen; hay cai lai dung bo Server cu hoac chi dinh -MysqlBase / MYSQL_BASE. Khong tu dong chuyen phien ban cho du lieu da khoi tao."
        }
    }

    # Inspect only a live project PID and verify its exact --datadir before
    # trusting its executable. Never infer ownership from a reused PID alone.
    foreach ($pidName in @('mysql.pid','mysql-process.pid')) {
        $pidFile = Join-Path $localRoot $pidName
        if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) { continue }
        $serverProcessId = 0
        [string]$processIdText = [IO.File]::ReadAllText($pidFile)
        if (-not [int]::TryParse($processIdText.Trim(),[ref]$serverProcessId) -or $serverProcessId -le 0) { continue }
        try {
            $liveProcess = Get-Process -Id $serverProcessId -ErrorAction Stop
            if ($liveProcess.ProcessName -ne 'mysqld') { continue }
            $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$serverProcessId" -OperationTimeoutSec 5 -ErrorAction Stop
            if ($processInfo.Name -ne 'mysqld.exe') { continue }
            $command = [string]$processInfo.CommandLine
            if ($command -notmatch '(?i)(?:^|\s)--datadir(?:=|\s+)(?:"([^"]+)"|''([^'']+)''|(\S+))(?=\s|$)') { continue }
            $ownedData = @($Matches[1],$Matches[2],$Matches[3]) | Where-Object { $_ }
            if ([IO.Path]::GetFullPath([string]$ownedData).TrimEnd('\','/') -ine $dataRoot.TrimEnd('\','/')) { continue }
            $executable = [string]$processInfo.ExecutablePath
            if ([string]::IsNullOrWhiteSpace($executable)) { $executable = [string]$liveProcess.Path }
            if (-not [IO.Path]::IsPathRooted($executable)) { continue }
            $ownedBase = Split-Path (Split-Path $executable -Parent) -Parent
        } catch { continue }
        return (Require-MySqlInstallation $ownedBase 'MySQL dang chay cua du an')
    }

    $programRoots = @($env:ProgramFiles,${env:ProgramFiles(x86)},$env:ProgramW6432) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    # The old launcher used this 8.0 location. Keep that binary family for
    # existing data rather than selecting a newly installed 8.4/9.x server.
    $legacyBases = @('C:\Program Files\MySQL\MySQL Server 8.0')
    foreach ($programRoot in $programRoots) { $legacyBases += Join-Path $programRoot 'MySQL\MySQL Server 8.0' }
    foreach ($legacyBase in ($legacyBases | Select-Object -Unique)) {
        $installation = Get-MySqlInstallation $legacyBase
        if ($installation) { return $installation }
    }
    if ($initialized) {
        throw 'Du lieu .local/mysql da khoi tao nhung khong xac dinh duoc bo MySQL cu (pin, process cua du an hoac Server 8.0 mac dinh). Hay dat MYSQL_BASE hoac truyen -MysqlBase toi dung bo Server da tao du lieu. Khong tu dong doi sang MySQL 8.4/9.x; neu can nang cap, sao luu va lam theo quy trinh nang cap MySQL.'
    }

    # Fresh data: inspect installation folders, PATH and service executable
    # paths only. No recursive disk scan and no service/server execution.
    $folders = @()
    foreach ($programRoot in $programRoots) {
        $mysqlFolder = Join-Path $programRoot 'MySQL'
        if (-not (Test-Path -LiteralPath $mysqlFolder -PathType Container)) { continue }
        foreach ($folder in (Get-ChildItem -LiteralPath $mysqlFolder -Directory -ErrorAction SilentlyContinue)) {
            if ($folder.Name -match '^MySQL Server (\d+(?:\.\d+){1,3})(?:\s.*)?$') {
                $version = [version]$Matches[1]
                if ($version.Major -ge 8) { $folders += [pscustomobject]@{Base=$folder.FullName;Version=$version} }
            }
        }
    }
    foreach ($folder in ($folders | Sort-Object -Property Version -Descending)) {
        $installation = Get-MySqlInstallation $folder.Base
        if ($installation) { return $installation }
    }
    foreach ($command in (Get-Command mysqld.exe -CommandType Application -All -ErrorAction SilentlyContinue)) {
        $installation = Get-MySqlInstallation (Split-Path (Split-Path $command.Source -Parent) -Parent)
        if ($installation) { return $installation }
    }
    try { $services = @(Get-CimInstance Win32_Service -Filter "PathName LIKE '%mysqld%'" -OperationTimeoutSec 5 -ErrorAction Stop) }
    catch { $services = @() }
    foreach ($service in $services) {
        if ([string]$service.PathName -match '(?i)^\s*"?(.+?mysqld\.exe)"?(?:\s|$)') {
            $installation = Get-MySqlInstallation (Split-Path (Split-Path $Matches[1] -Parent) -Parent)
            if ($installation) { return $installation }
        }
    }
    throw 'Khong tim thay bo MySQL Server day du. MySQL Workbench/Router/Shell khong thay the MySQL Server. Cai MySQL Community Server 8.0/8.4 hoac phien ban moi tuong thich, roi chay CAU_HINH_MYSQL.bat hoac dat MYSQL_BASE / truyen -MysqlBase "D:\MySQL\MySQL Server 8.4" (thu muc co bin\mysqld.exe, mysql.exe, mysqladmin.exe). Co the dung Docker theo README neu da cai Docker.'
}

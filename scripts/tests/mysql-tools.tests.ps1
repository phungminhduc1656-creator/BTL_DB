# Run with Windows PowerShell 5.1. No Pester, server, service or real database is used.
[CmdletBinding()]
param(
    [string]$ProjectRoot = '',
    [string]$ChildCase = '',
    [string]$FixtureRoot = ''
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
$resolverFile = Join-Path $ProjectRoot 'scripts\mysql-tools.ps1'

function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ([string]$Actual -cne [string]$Expected) {
        throw "$Message; expected '$Expected', got '$Actual'."
    }
    $script:AssertionCount++
}
function Assert-Installation($Actual, [string]$ExpectedBase) {
    $expected = [IO.Path]::GetFullPath($ExpectedBase)
    foreach ($property in @('Base','Server','Client','Admin')) {
        $suffix = switch ($property) { 'Server' {'bin\mysqld.exe'} 'Client' {'bin\mysql.exe'} 'Admin' {'bin\mysqladmin.exe'} default {''} }
        $value = if ($suffix) { Join-Path $expected $suffix } else { $expected }
        if (-not [string]::Equals([string]$Actual.$property,$value,[StringComparison]::OrdinalIgnoreCase)) {
            throw "Incorrect $property; expected '$value', got '$($Actual.$property)'."
        }
        $script:AssertionCount++
    }
}
function Assert-Fails([scriptblock]$Action, [string]$Pattern) {
    $failure = $null
    try { $null = & $Action } catch { $failure = $_ }
    if ($null -eq $failure) { throw 'Expected the resolver to refuse this installation.' }
    if ($failure.Exception.Message -notmatch $Pattern) {
        throw "Unexpected failure: $($failure.Exception.Message); expected pattern '$Pattern'."
    }
    $script:AssertionCount++
}
function Get-CheckedFixture([string]$Candidate) {
    $allowed = [IO.Path]::GetFullPath((Join-Path $ProjectRoot '.local\tests'))
    $full = [IO.Path]::GetFullPath($Candidate)
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($full),$allowed,[StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($full) -notmatch '^mysql-tools-[0-9a-f]{32}$') {
        throw 'Fixture path must be a unique mysql-tools directory directly under this project .local/tests.'
    }
    return $full
}
function New-FakeInstallation([string]$Base, [string[]]$Missing = @()) {
    $basePath = [IO.Path]::GetFullPath($Base)
    if (-not $basePath.StartsWith($script:CaseRoot + '\',[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Fake installation escaped its test case directory.'
    }
    $null = New-Item -ItemType Directory -Force -Path (Join-Path $basePath 'bin')
    foreach ($name in @('mysqld.exe','mysql.exe','mysqladmin.exe')) {
        if ($Missing -notcontains $name) { [IO.File]::WriteAllBytes((Join-Path $basePath ('bin\' + $name)),[byte[]]@()) }
    }
    return $basePath
}
function Set-FakeInitialized([string]$Marker = 'mysql') {
    $data = Join-Path $script:FakeProject '.local\mysql'
    $null = New-Item -ItemType Directory -Force -Path $data
    if ($Marker -eq 'mysql') { $null = New-Item -ItemType Directory -Path (Join-Path $data 'mysql') }
    else { [IO.File]::WriteAllBytes((Join-Path $data $Marker),[byte[]]@()) }
}
function Set-FakePin([string]$Value) {
    $local = Join-Path $script:FakeProject '.local'
    $null = New-Item -ItemType Directory -Force -Path $local
    [IO.File]::WriteAllText((Join-Path $local 'mysql-base.txt'),$Value,[Text.UTF8Encoding]::new($true))
}
function Set-FakeOwnedProcess([string]$Base, [string]$DataSuffix = '', [string]$PidFile = 'mysql.pid') {
    $local = Join-Path $script:FakeProject '.local'
    $null = New-Item -ItemType Directory -Force -Path $local
    [IO.File]::WriteAllText((Join-Path $local $PidFile),'4242',[Text.UTF8Encoding]::new($true))
    $serverPath = Join-Path $Base 'bin\mysqld.exe'
    $script:MockProcess = [pscustomobject]@{ ProcessName='mysqld'; Path=$serverPath }
    $script:MockProcessInfo = [pscustomobject]@{
        Name='mysqld.exe'; ExecutablePath=$serverPath
        CommandLine=('"' + $serverPath + '" --datadir="' + (Join-Path $script:FakeProject '.local\mysql') + $DataSuffix + '" --port=3307')
    }
}
function Invoke-IsolatedCase([string]$Name, [string]$RunRoot) {
    $script:CaseRoot = Join-Path (Get-CheckedFixture $RunRoot) $Name
    $script:FakeProject = Join-Path $script:CaseRoot 'project'
    $script:FakeProgramFiles = Join-Path $script:CaseRoot 'Program Files'
    $script:FakeProgramFiles86 = Join-Path $script:CaseRoot 'Program Files x86'
    $script:MockCommands = @(); $script:MockServices = @()
    $script:MockProcess = $null; $script:MockProcessInfo = $null
    $script:Lookups = @{ Commands=0; Services=0; Processes=0 }
    $script:AssertionCount = 0
    $null = New-Item -ItemType Directory -Force -Path $script:FakeProject,$script:FakeProgramFiles,$script:FakeProgramFiles86
    $environmentNames = @('MYSQL_BASE','ProgramFiles','ProgramFiles(x86)','ProgramW6432','PATH','COURTLY_TEST_MYSQL')
    $savedEnvironment = @{}
    foreach ($environmentName in $environmentNames) {
        $savedEnvironment[$environmentName] = [Environment]::GetEnvironmentVariable($environmentName,'Process')
    }
    try {
        [Environment]::SetEnvironmentVariable('MYSQL_BASE',$null,'Process')
        [Environment]::SetEnvironmentVariable('ProgramFiles',$script:FakeProgramFiles,'Process')
        [Environment]::SetEnvironmentVariable('ProgramFiles(x86)',$script:FakeProgramFiles86,'Process')
        [Environment]::SetEnvironmentVariable('ProgramW6432',$script:FakeProgramFiles,'Process')
        [Environment]::SetEnvironmentVariable('PATH',(Join-Path $script:CaseRoot 'empty-path'),'Process')
        [Environment]::SetEnvironmentVariable('COURTLY_TEST_MYSQL',$null,'Process')

        # Mocks exist only in this child PowerShell process. Hide the host's
        # real installations and prevent process/service or credential access.
        function Test-Path {
            [CmdletBinding()] param([string]$Path,[string]$LiteralPath,[string]$PathType='Any')
            $candidate = if ($PSBoundParameters.ContainsKey('LiteralPath')) { $LiteralPath } else { $Path }
            try { $full = [IO.Path]::GetFullPath($candidate) } catch { return $false }
            if (-not $full.StartsWith($script:CaseRoot + '\',[StringComparison]::OrdinalIgnoreCase) -and
                -not [string]::Equals($full,$script:CaseRoot,[StringComparison]::OrdinalIgnoreCase)) { return $false }
            return (Microsoft.PowerShell.Management\Test-Path -LiteralPath $full -PathType $PathType)
        }
        function Get-Content {
            [CmdletBinding()] param([string]$LiteralPath,[switch]$Raw,[string]$Encoding='UTF8')
            $full = [IO.Path]::GetFullPath($LiteralPath)
            if (-not $full.StartsWith($script:CaseRoot + '\',[StringComparison]::OrdinalIgnoreCase)) {
                throw 'The resolver tried to read outside its fake fixture.'
            }
            Microsoft.PowerShell.Management\Get-Content -LiteralPath $full -Raw:$Raw -Encoding $Encoding
        }
        function Get-Command {
            [CmdletBinding()] param([Parameter(Position=0)][string]$Name,[object]$CommandType,[switch]$All)
            if ($Name -ne 'mysqld.exe') { throw 'Unexpected command lookup in resolver.' }
            $script:Lookups.Commands++
            return $script:MockCommands
        }
        function Get-Process {
            [CmdletBinding()] param([int]$Id)
            $script:Lookups.Processes++
            if ($Id -ne 4242 -or $null -eq $script:MockProcess) { throw 'No such fake process.' }
            return $script:MockProcess
        }
        function Get-CimInstance {
            [CmdletBinding()] param([Parameter(Position=0)][string]$ClassName,[string]$Filter,[int]$OperationTimeoutSec)
            if ($ClassName -eq 'Win32_Process') {
                if ($null -eq $script:MockProcessInfo) { throw 'No such fake process metadata.' }
                return $script:MockProcessInfo
            }
            if ($ClassName -eq 'Win32_Service') { $script:Lookups.Services++; return $script:MockServices }
            throw 'Unexpected CIM access in resolver.'
        }
        function Start-Process { throw 'Tests prohibit launching a server or service.' }
        function Stop-Process { throw 'Tests prohibit stopping processes.' }
        function Start-Service { throw 'Tests prohibit changing services.' }
        function Stop-Service { throw 'Tests prohibit changing services.' }
        . $resolverFile
        $fresh84 = Join-Path $script:FakeProgramFiles 'MySQL\MySQL Server 8.4'
        $legacy80 = Join-Path $script:FakeProgramFiles 'MySQL\MySQL Server 8.0'
        switch ($Name) {
            'explicit-unicode-spaces' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'Cài đặt riêng\MySQL Server 8.4')
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base) $base
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase ($base + '\')) $base
            }
            'explicit-relative' {
                $base = New-FakeInstallation (Join-Path $script:FakeProject 'tools\Custom Server')
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase 'tools\Custom Server') $base
            }
            'explicit-over-env-and-pin' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'explicit')
                $env:MYSQL_BASE = New-FakeInstallation (Join-Path $script:CaseRoot 'environment')
                Set-FakePin (New-FakeInstallation (Join-Path $script:CaseRoot 'pinned'))
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base) $base
            }
            'environment-over-pin-existing' {
                Set-FakeInitialized
                $env:MYSQL_BASE = New-FakeInstallation (Join-Path $script:CaseRoot 'environment')
                Set-FakePin (New-FakeInstallation (Join-Path $script:CaseRoot 'pinned'))
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $env:MYSQL_BASE
            }
            'empty-explicit-uses-environment' {
                $env:MYSQL_BASE = New-FakeInstallation (Join-Path $script:CaseRoot 'environment')
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase '') $env:MYSQL_BASE
            }
            'explicit-missing-server' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'incomplete') @('mysqld.exe')
                $null = New-FakeInstallation $fresh84
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base } '-MysqlBase.*mysqld\.exe'
            }
            'explicit-missing-client' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'incomplete') @('mysql.exe')
                $null = New-FakeInstallation $fresh84
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base } '-MysqlBase.*mysql\.exe'
            }
            'explicit-missing-admin' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'incomplete') @('mysqladmin.exe')
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base } 'mysqladmin\.exe'
            }
            'invalid-explicit-no-fallback' {
                $env:MYSQL_BASE = New-FakeInstallation (Join-Path $script:CaseRoot 'valid-environment')
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase (Join-Path $script:CaseRoot 'missing') } '-MysqlBase'
            }
            'invalid-environment-no-fallback' {
                $env:MYSQL_BASE = Join-Path $script:CaseRoot 'missing'
                Set-FakePin (New-FakeInstallation (Join-Path $script:CaseRoot 'valid-pin'))
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject } 'MYSQL_BASE'
            }
            'existing-pin-keeps-binary' {
                Set-FakeInitialized
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'Old Custom Server')
                Set-FakePin $base
                $null = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'existing-missing-pin-refuses-fallback' {
                Set-FakeInitialized
                Set-FakePin (Join-Path $script:CaseRoot 'missing-old-server')
                $null = New-FakeInstallation $fresh84
                $null = New-FakeInstallation $legacy80
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject } 'mysql-base\.txt'
            }
            'existing-incomplete-pin-refuses-fallback' {
                Set-FakeInitialized
                Set-FakePin (New-FakeInstallation (Join-Path $script:CaseRoot 'old-server') @('mysql.exe'))
                $null = New-FakeInstallation $fresh84
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject } 'mysql-base\.txt'
            }
            'fresh-invalid-pin-discovers-84' {
                Set-FakePin (Join-Path $script:CaseRoot 'missing-old-server')
                $base = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'existing-default-80-is-preserved' {
                Set-FakeInitialized
                $base = New-FakeInstallation $legacy80
                $null = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'fresh-default-84-discovery' {
                $base = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'fresh-x86-programfiles-discovery' {
                $base = New-FakeInstallation (Join-Path $script:FakeProgramFiles86 'MySQL\MySQL Server 8.4')
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'fresh-incomplete-newer-is-skipped' {
                $null = New-FakeInstallation (Join-Path $script:FakeProgramFiles 'MySQL\MySQL Server 9.0') @('mysql.exe')
                $base = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'fresh-path-discovery' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'PATH custom Server')
                $script:MockCommands = @([pscustomobject]@{Source=(Join-Path $base 'bin\mysqld.exe')})
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'fresh-service-discovery' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'Service Cài đặt')
                $script:MockServices = @([pscustomobject]@{PathName=('"' + (Join-Path $base 'bin\mysqld.exe') + '" --defaults-file="unused.ini"')})
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'existing-unpinned-refuses-new-family' {
                Set-FakeInitialized 'auto.cnf'
                $null = New-FakeInstallation $fresh84
                $null = New-FakeInstallation (Join-Path $script:FakeProgramFiles 'MySQL\MySQL Server 9.0')
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject } 'Khong tu dong doi sang MySQL 8\.4/9\.x'
                Assert-Equal $script:Lookups.Commands 0 'Existing data must not probe PATH fallback'
                Assert-Equal $script:Lookups.Services 0 'Existing data must not probe service fallback'
            }
            'owned-pid-exact-datadir' {
                Set-FakeInitialized 'ibdata1'
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'Owned old Server')
                Set-FakeOwnedProcess $base
                $null = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
            }
            'reused-pid-foreign-datadir-is-rejected' {
                Set-FakeInitialized
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'Unrelated Server')
                Set-FakeOwnedProcess $base '-other'
                $null = New-FakeInstallation $fresh84
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject } 'Khong tu dong doi sang MySQL 8\.4/9\.x'
                Assert-Equal $script:Lookups.Processes 1 'The PID fixture must actually be checked'
            }
            'empty-pid-is-ignored' {
                $local = Join-Path $script:FakeProject '.local'
                $null = New-Item -ItemType Directory -Path $local
                [IO.File]::WriteAllBytes((Join-Path $local 'mysql.pid'),[byte[]]@())
                $base = New-FakeInstallation $fresh84
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject) $base
                Assert-Equal $script:Lookups.Processes 0 'An empty PID must never inspect a process'
            }
            'workbench-only-is-not-server' {
                $null = New-FakeInstallation (Join-Path $script:FakeProgramFiles 'MySQL\MySQL Workbench 8.0') @('mysqld.exe')
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject } 'Workbench/Router/Shell.*CAU_HINH_MYSQL'
            }
            'expanded-and-quoted-explicit-path' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'Expanded Cài đặt')
                $env:COURTLY_TEST_MYSQL = $base
                Assert-Installation (Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase '"%COURTLY_TEST_MYSQL%"') $base
            }
            'mariadb-explicit-is-rejected' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'MariaDB 11.4')
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base } 'khong dung MariaDB/MySQL 5\.x'
            }
            'mysql-57-explicit-is-rejected' {
                $base = New-FakeInstallation (Join-Path $script:CaseRoot 'MySQL Server 5.7')
                Assert-Fails { Resolve-ProjectMySql -ProjectRoot $script:FakeProject -MysqlBase $base } 'khong dung MariaDB/MySQL 5\.x'
            }
            default { throw "Unknown isolated test case '$Name'." }
        }
        Write-Output ('ASSERTIONS:' + $script:AssertionCount)
    } finally {
        foreach ($environmentName in $environmentNames) {
            [Environment]::SetEnvironmentVariable($environmentName,$savedEnvironment[$environmentName],'Process')
        }
    }
}

if ($ChildCase) {
    if ([string]::IsNullOrWhiteSpace($FixtureRoot)) { throw 'A checked fixture directory is required for child tests.' }
    try { Invoke-IsolatedCase $ChildCase $FixtureRoot } catch { Write-Host $_.ScriptStackTrace; throw }
    exit 0
}

# Run this file in one dedicated Windows PowerShell process. Each case has
# function-scoped mocks and restores its environment before the next case.
$cases = @(
    'explicit-unicode-spaces','explicit-relative','explicit-over-env-and-pin',
    'environment-over-pin-existing','empty-explicit-uses-environment',
    'explicit-missing-server','explicit-missing-client','explicit-missing-admin',
    'invalid-explicit-no-fallback','invalid-environment-no-fallback',
    'existing-pin-keeps-binary','existing-missing-pin-refuses-fallback',
    'existing-incomplete-pin-refuses-fallback','fresh-invalid-pin-discovers-84',
    'existing-default-80-is-preserved','fresh-default-84-discovery',
    'fresh-x86-programfiles-discovery','fresh-incomplete-newer-is-skipped',
    'fresh-path-discovery','fresh-service-discovery','existing-unpinned-refuses-new-family',
    'owned-pid-exact-datadir','reused-pid-foreign-datadir-is-rejected','empty-pid-is-ignored',
    'workbench-only-is-not-server','expanded-and-quoted-explicit-path',
    'mariadb-explicit-is-rejected','mysql-57-explicit-is-rejected'
)
$runRoot = Get-CheckedFixture (Join-Path (Join-Path $ProjectRoot '.local\tests') ('mysql-tools-' + [guid]::NewGuid().ToString('N')))
$null = New-Item -ItemType Directory -Force -Path $runRoot
$totalAssertions = 0; $passed = 0; $failures = @()
try {
    foreach ($case in $cases) {
        try {
            $output = @(Invoke-IsolatedCase $case $runRoot) -join "`n"
            if ($output -notmatch 'ASSERTIONS:(\d+)') { throw 'Case did not report its assertion count.' }
            $totalAssertions += [int]$Matches[1]; $passed++
            Write-Host "PASS $case"
        } catch {
            $failures += $case
            Write-Host ("FAIL $case : " + $_.Exception.Message)
            Write-Host $_.ScriptStackTrace
        }
    }
    if ($failures.Count -gt 0) { throw "$($failures.Count) of $($cases.Count) resolver cases failed: $($failures -join ', ')." }
    Write-Host "All $passed resolver cases passed ($totalAssertions assertions) in Windows PowerShell $($PSVersionTable.PSVersion). No MySQL binary was executed."
} finally {
    # Delete only this run's own checked fixture, never .local/tests itself.
    $checkedRoot = Get-CheckedFixture $runRoot
    if (Microsoft.PowerShell.Management\Test-Path -LiteralPath $checkedRoot) {
        $resolved = (Resolve-Path -LiteralPath $checkedRoot).ProviderPath
        if (-not [string]::Equals($resolved,$checkedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture cleanup path changed; removal refused.' }
        $entries = @((Get-Item -LiteralPath $checkedRoot -Force)) + @(Get-ChildItem -LiteralPath $checkedRoot -Force -Recurse)
        foreach ($entry in $entries) {
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Fixture cleanup refused a symbolic link or junction.' }
        }
        Remove-Item -LiteralPath $checkedRoot -Recurse -Force
    }
}

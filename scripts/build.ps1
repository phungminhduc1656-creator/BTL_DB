[CmdletBinding()]
param([switch]$Offline)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$jarPath=Join-Path $projectRoot 'target\pickleball-manager-1.0.0.jar'
$logRoot=Join-Path $projectRoot '.local\logs'
$buildLog=Join-Path $logRoot 'build.log'
[IO.Directory]::CreateDirectory($logRoot) | Out-Null
# Reset old diagnostics even when Maven exits without any output.
[IO.File]::WriteAllText($buildLog,'',[Text.UTF8Encoding]::new($true))
Write-Host ('Dang bien dich Java tai: '+$projectRoot)
Write-Host ('Nhat ky bien dich: '+$buildLog)
$mavenArgs=@('-B','-DskipTests')
if ($Offline) { $mavenArgs += '-o' }
$mavenArgs += 'package'
Push-Location -LiteralPath $projectRoot
try {
    $buildExit=1
    $invocationFailure=$null
    $previousErrorPreference=$ErrorActionPreference
    try {
        # PS5 treats native stderr as errors. Use the process exit code;
        # keep both output streams in the log and on the console.
        $ErrorActionPreference='Continue'
        $LASTEXITCODE=1
        & (Join-Path $projectRoot 'mvnw.cmd') @mavenArgs 2>&1 | Tee-Object -LiteralPath $buildLog
        $buildExit=$LASTEXITCODE
    } catch { $invocationFailure=$_.Exception.Message }
    finally { $ErrorActionPreference=$previousErrorPreference }
    Add-Content -LiteralPath $buildLog -Value @(
        ('Project: '+$projectRoot),('Expected JAR: '+$jarPath),('Build exit code: '+$buildExit)
    )
    if ($invocationFailure) {
        Add-Content -LiteralPath $buildLog -Value $invocationFailure
        throw ('Khong chay duoc buoc bien dich Java. Mo '+$buildLog+' de xem loi.')
    }
    if ($buildExit -ne 0) {
        throw ('Bien dich Java that bai (ma '+$buildExit+'). Mo '+$buildLog+' de xem loi. Kiem tra JDK 17+ va Internet cho lan chay dau.')
    }
    if (-not (Test-Path -LiteralPath $jarPath -PathType Leaf)) {
        $outputFiles=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'target') -Filter '*.jar' -File -ErrorAction SilentlyContinue | ForEach-Object Name)
        Add-Content -LiteralPath $buildLog -Value ('JAR files in target: '+($outputFiles -join ', '))
        throw ('Buoc bien dich chua tao file '+$jarPath+'. Mo '+$buildLog+' de kiem tra Maven va pom.xml. Khong the khoi dong Java khi chua co JAR.')
    }
    Write-Host ('Da tao JAR: '+$jarPath)
} finally { Pop-Location }

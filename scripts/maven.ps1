# Maven wrapper nhỏ: tải Maven vào .tools, không cần cài Maven toàn máy.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$version = '3.9.16'
$mavenHome = Join-Path $projectRoot ".tools\apache-maven-$version"
$mavenCommand = Join-Path $mavenHome 'bin\mvn.cmd'
if (-not $env:JAVA_HOME -and (Test-Path -LiteralPath 'D:\Java\bin\javac.exe')) { $env:JAVA_HOME = 'D:\Java' }
if (-not (Test-Path -LiteralPath $mavenCommand)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.tools') | Out-Null
    $zip = Join-Path $projectRoot ".tools\apache-maven-$version.zip"
    $url = "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$version/apache-maven-$version-bin.zip"
    Write-Host "Downloading Apache Maven $version (first run only)..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    $expected = ((Invoke-WebRequest -Uri "$url.sha512" -UseBasicParsing).Content.Trim() -split '\s+')[0]
    $actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA512).Hash
    if ($actual -ne $expected) { throw 'Maven archive checksum does not match.' }
    Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $projectRoot '.tools') -Force
}
Push-Location $projectRoot
try {
    & $mavenCommand "-Dmaven.repo.local=$(Join-Path $projectRoot '.tools\m2')" @args
    $result = $LASTEXITCODE
} finally { Pop-Location }
exit $result

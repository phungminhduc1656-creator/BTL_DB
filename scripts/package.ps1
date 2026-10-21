# Đóng gói mã nguồn + JAR, không đưa dữ liệu MySQL, mật khẩu hoặc cache vào ZIP.
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$releaseRoot=Join-Path $projectRoot '.local\releases'
$stageRoot=Join-Path $releaseRoot ([guid]::NewGuid().ToString('N'))
$packageRoot=Join-Path $stageRoot 'Courtly-Java-MySQL'
New-Item -ItemType Directory -Force -Path $packageRoot,(Join-Path $packageRoot 'target') | Out-Null
foreach($entry in @('src','database','docs','scripts','pom.xml','README.md','mvnw.cmd','CHAY_UNG_DUNG.bat','CAU_HINH_MYSQL.bat','MO_KHACH_HANG.bat','MO_QUAN_LY.bat','MO_CSDL_MYSQL.bat','DUNG_UNG_DUNG.bat','compose.yaml','.env.example','.gitignore')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination $packageRoot -Recurse
}
$jar=Join-Path $projectRoot 'target\pickleball-manager-1.0.0.jar'
if (-not (Test-Path -LiteralPath $jar)) { throw 'Build the JAR before packaging.' }
Copy-Item -LiteralPath $jar -Destination (Join-Path $packageRoot 'target')
$zip=Join-Path $releaseRoot 'Courtly-Java-MySQL.zip'
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zip -Force
Write-Host "Created $zip (source + runnable JAR, no private runtime data)."

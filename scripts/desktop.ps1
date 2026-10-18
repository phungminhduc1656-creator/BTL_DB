[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('start','stop')][string]$Action,[ValidateSet('admin','customer')][string]$Page='admin')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
try {
    if ($Action -eq 'stop') {
        & (Join-Path $PSScriptRoot 'stop.ps1') -All
        if ($LASTEXITCODE -ne 0) { throw 'The project did not stop successfully.' }
        Write-Host 'Da dung Courtly va MySQL. Du lieu duoc giu nguyen.'
    } else {
        & (Join-Path $PSScriptRoot 'start.ps1')
        if ($LASTEXITCODE -ne 0) { throw 'The project did not start successfully.' }
        $port=8080
        $portFile=Join-Path $projectRoot '.local\app.port'
        if (Test-Path -LiteralPath $portFile) {
            $portText=(Get-Content -LiteralPath $portFile -Raw).Trim()
            if (-not [int]::TryParse($portText,[ref]$port) -or $port -lt 1 -or $port -gt 65535) { throw 'Invalid app port. See .local/app.port.' }
        }
        $pagePath=if ($Page -eq 'customer') { '/khach-hang/' } else { '/quan-ly/' }
        $url='http://127.0.0.1:'+$port+$pagePath
        Write-Host "Ung dung san sang: $url"
        if ($env:COURTLY_NO_BROWSER -ne '1') {
            # The desktop launcher opens the browser for the user after startup.
            try { Start-Process -FilePath $url } catch { Write-Host "Khong mo duoc trinh duyet tu dong. Mo dia chi: $url" }
        }
    }
    exit 0
} catch {
    Write-Host ('Loi: '+$_.Exception.Message) -ForegroundColor Red
    exit 1
}

# Creates the BAUMB database, an app login with least privilege, and the tables.
# Uses your Windows login (must be a SQL Server sysadmin). Writes credentials to .env.local.
#   powershell -ExecutionPolicy Bypass -File scripts\setup-database.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"
$server = if ($env:DB_SERVER) { $env:DB_SERVER } else { "localhost" }

$existing = @{}
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)=(.*)$' } | ForEach-Object { $existing[$Matches[1]] = $Matches[2] }
}
$user = if ($existing.DB_USER) { $existing.DB_USER } else { "baumb_app" }
$password = $existing.DB_PASSWORD
if (-not $password) {
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  function Get-RandomIndex([int]$max) { $b = New-Object byte[] 4; $rng.GetBytes($b); [BitConverter]::ToUInt32($b, 0) % $max }
  $sets = @("ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "-_.!@#%^*+")
  $chars = foreach ($s in $sets) { 1..6 | ForEach-Object { $s[(Get-RandomIndex $s.Length)] } }
  $password = -join ($chars | Sort-Object { Get-RandomIndex 100000 })
}

$bootstrap = @"
IF DB_ID('baumb') IS NULL CREATE DATABASE baumb;
GO
IF SUSER_ID('$user') IS NULL
  CREATE LOGIN [$user] WITH PASSWORD = N'$password', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = baumb;
ELSE
  ALTER LOGIN [$user] WITH PASSWORD = N'$password';
GO
USE baumb;
IF USER_ID('$user') IS NULL CREATE USER [$user] FOR LOGIN [$user];
ALTER ROLE db_datareader ADD MEMBER [$user];
ALTER ROLE db_datawriter ADD MEMBER [$user];
GO
"@
$tmp = Join-Path $env:TEMP "baumb-bootstrap.sql"
Set-Content -Path $tmp -Value $bootstrap -Encoding UTF8
try {
  sqlcmd -S $server -E -b -i $tmp
  if ($LASTEXITCODE) { throw "Bootstrap failed" }
} finally { Remove-Item $tmp -ErrorAction SilentlyContinue }

sqlcmd -S $server -E -b -i (Join-Path $root "db\schema.sql")
if ($LASTEXITCODE) { throw "Schema failed" }

$existing.DB_SERVER = $server
$existing.DB_PORT = if ($existing.DB_PORT) { $existing.DB_PORT } else { "1433" }
$existing.DB_NAME = "baumb"
$existing.DB_USER = $user
$existing.DB_PASSWORD = $password
$lines = ($existing.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "`n"
[IO.File]::WriteAllText($envFile, "$lines`n", (New-Object Text.UTF8Encoding $false))
Write-Output "Database ready. Credentials written to .env.local (user $user)."

$ErrorActionPreference = 'Stop'
$line = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\.env') |
  Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw 'Configure DATABASE_URL privately in .env first.' }
$url = $line.Substring(13).Trim('"', "'")
if ($url -notmatch '^sqlserver://(localhost|127\.0\.0\.1)[:;]' -or
  $url -notmatch '(?i);database=RCDRenta(;|$)') {
  throw 'Provisioning is restricted to localhost RCDRentaE2E.'
}
$match = [regex]::Match($url, '(?i)(?:^|;)user=(\{(?:[^}]|}})*\}|[^;]*)')
if (-not $match.Success) { throw 'SQL user field missing.' }
$login = $match.Groups[1].Value.Trim('{', '}').Replace('}}', '}')
$connection = New-Object System.Data.SqlClient.SqlConnection(
  'Server=localhost;Database=master;Integrated Security=true;TrustServerCertificate=true;Connect Timeout=5')
try {
  $connection.Open()
  $cmd = $connection.CreateCommand()
  $cmd.CommandText = "IF DB_ID(N'RCDRentaE2E') IS NULL CREATE DATABASE [RCDRentaE2E]"
  $cmd.ExecuteNonQuery() | Out-Null
  $connection.ChangeDatabase('RCDRentaE2E')
  $cmd.CommandText = @'
DECLARE @sql nvarchar(max);
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name=@login)
BEGIN
  SET @sql=N'CREATE USER '+QUOTENAME(@login)+N' FOR LOGIN '+QUOTENAME(@login);
  EXEC sp_executesql @sql;
END;
SET @sql=N'ALTER ROLE db_owner ADD MEMBER '+QUOTENAME(@login);
EXEC sp_executesql @sql;
'@
  $cmd.Parameters.AddWithValue('@login', $login) | Out-Null
  $cmd.ExecuteNonQuery() | Out-Null
  Write-Output 'RCDRentaE2E available; existing application login granted access only to this test database.'
}
catch {
  throw 'E2E provisioning failed. Current Windows principal needs local SQL CREATE DATABASE and test database administration rights.'
}
finally { $connection.Dispose() }

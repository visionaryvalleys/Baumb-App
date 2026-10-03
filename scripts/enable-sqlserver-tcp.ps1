# Enables TCP/IP on the default SQL Server instance (port 1433) and restarts it.
# Run once as Administrator:  powershell -ExecutionPolicy Bypass -File scripts\enable-sqlserver-tcp.ps1
$ErrorActionPreference = "Stop"
$instance = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL").MSSQLSERVER
$base = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instance\MSSQLServer\SuperSocketNetLib\Tcp"
Set-ItemProperty -Path $base -Name Enabled -Value 1
Set-ItemProperty -Path "$base\IPAll" -Name TcpDynamicPorts -Value ""
Set-ItemProperty -Path "$base\IPAll" -Name TcpPort -Value "1433"
Restart-Service -Name MSSQLSERVER -Force
Write-Output "TCP/IP enabled on port 1433 for $instance"

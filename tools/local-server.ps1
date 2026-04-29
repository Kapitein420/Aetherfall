param(
  [int]$Port = 4173,
  [string]$BindAddress = "127.0.0.1",
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

function Get-MimeType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "text/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".svg" { "image/svg+xml" }
    default { "application/octet-stream" }
  }
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8",
    [bool]$HeadersOnly = $false
  )

  $headers = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)

  if (-not $HeadersOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

$rootPath = [System.IO.Path]::GetFullPath($Root)
$rootPrefix = $rootPath
if (-not $rootPrefix.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
  $rootPrefix += [System.IO.Path]::DirectorySeparatorChar
}

$ipAddress = if ($BindAddress -eq "0.0.0.0") {
  [System.Net.IPAddress]::Any
} else {
  [System.Net.IPAddress]::Parse($BindAddress)
}

$displayHost = if ($BindAddress -eq "0.0.0.0") { "0.0.0.0" } else { $BindAddress }
$listener = [System.Net.Sockets.TcpListener]::new($ipAddress, $Port)
$listener.Start()

Write-Host "Serving $rootPath at http://$displayHost`:$Port/"
Write-Host "Press Ctrl+C to stop."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line.Length -eq 0) {
          break
        }
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $rawPath = $parts[1]

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
        Write-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -Body $body -HeadersOnly:($method -eq "HEAD")
        continue
      }

      $requestPath = ([System.Uri]::UnescapeDataString(($rawPath -split "\?")[0])).TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }

      $relativePath = $requestPath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootPath, $relativePath))

      if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Write-Response -Stream $stream -StatusCode 403 -StatusText "Forbidden" -Body $body -HeadersOnly:($method -eq "HEAD")
        continue
      }

      if (-not [System.IO.File]::Exists($filePath)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Write-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -Body $body -HeadersOnly:($method -eq "HEAD")
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($filePath)
      Write-Response -Stream $stream -StatusCode 200 -StatusText "OK" -Body $body -ContentType (Get-MimeType $filePath) -HeadersOnly:($method -eq "HEAD")
    } catch {
      if ($stream) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Server error")
        Write-Response -Stream $stream -StatusCode 500 -StatusText "Internal Server Error" -Body $body
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}

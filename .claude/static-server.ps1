param(
  [int]$Port = 8791,
  [string]$Root = (Get-Location).Path
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8";
  ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8"; ".png"="image/png"; ".jpg"="image/jpeg";
  ".jpeg"="image/jpeg"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".xml"="application/xml; charset=utf-8";
  ".txt"="text/plain; charset=utf-8"; ".sql"="text/plain; charset=utf-8"; ".webmanifest"="application/manifest+json"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $Root ($path.TrimStart("/"))
    $full = [System.IO.Path]::GetFullPath($filePath)
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($Root))) {
      $res.StatusCode = 403; $res.Close(); continue
    }
    if (Test-Path $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}

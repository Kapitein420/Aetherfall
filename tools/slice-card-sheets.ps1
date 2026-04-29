param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $Root "assets\cards\crops"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$sheets = @(
  @{
    Path = Join-Path $Root "assets\cards\arian-full-card-sheet.png"
    Cards = @(
      "arian-stone-breath", "arian-granite-skin", "arian-tectonic-wait",
      "arian-stored-impact", "arian-mossbound-guardian", "arian-seismic-pressure",
      "arian-faultline-slam", "arian-kindly-cataclysm", "arian-worldbreaker-patience"
    )
  },
  @{
    Path = Join-Path $Root "assets\cards\geert-full-card-sheet.png"
    Cards = @(
      "geert-spark-anchor", "geert-repulsion-pulse", "geert-magnetic-drone",
      "geert-attraction-field", "geert-chain-capacitor", "geert-overclock",
      "geert-polarity-switch", "geert-scrap-colossus", "geert-perfect-chain-reaction"
    )
  },
  @{
    Path = Join-Path $Root "assets\cards\wouter-full-card-sheet.png"
    Cards = @(
      "wouter-silent-arrow", "wouter-veilstep", "wouter-loot-cache",
      "wouter-ambush-cut", "wouter-snare-trap", "wouter-relic-hunter",
      "wouter-critical-line", "wouter-shadow-stag", "wouter-perfect-heist"
    )
  },
  @{
    Path = Join-Path $Root "assets\cards\noah-full-card-sheet.png"
    Cards = @(
      "noah-chaos-spark", "noah-burning-die", "noah-unstable-barrier",
      "noah-reality-misprint", "noah-void-imp", "noah-wild-equation",
      "noah-backfire-blast", "noah-fractured-familiar", "noah-unwritten-catastrophe"
    )
  }
)

function Get-TrimBounds {
  param([System.Drawing.Bitmap]$Bitmap)

  $threshold = 14
  $minimumBrightPixels = [Math]::Max(2, [Math]::Floor([Math]::Min($Bitmap.Width, $Bitmap.Height) * 0.03))
  $left = 0
  $right = $Bitmap.Width - 1
  $top = 0
  $bottom = $Bitmap.Height - 1

  for ($x = 0; $x -lt $Bitmap.Width; $x++) {
    $brightPixels = 0
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if (($pixel.R + $pixel.G + $pixel.B) -gt $threshold) {
        $brightPixels++
      }
    }
    if ($brightPixels -ge $minimumBrightPixels) {
      $left = $x
      break
    }
  }

  for ($x = $Bitmap.Width - 1; $x -ge 0; $x--) {
    $brightPixels = 0
    for ($y = 0; $y -lt $Bitmap.Height; $y++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if (($pixel.R + $pixel.G + $pixel.B) -gt $threshold) {
        $brightPixels++
      }
    }
    if ($brightPixels -ge $minimumBrightPixels) {
      $right = $x
      break
    }
  }

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    $brightPixels = 0
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if (($pixel.R + $pixel.G + $pixel.B) -gt $threshold) {
        $brightPixels++
      }
    }
    if ($brightPixels -ge $minimumBrightPixels) {
      $top = $y
      break
    }
  }

  for ($y = $Bitmap.Height - 1; $y -ge 0; $y--) {
    $brightPixels = 0
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if (($pixel.R + $pixel.G + $pixel.B) -gt $threshold) {
        $brightPixels++
      }
    }
    if ($brightPixels -ge $minimumBrightPixels) {
      $bottom = $y
      break
    }
  }

  $padding = 2
  $left = [Math]::Max(0, $left - $padding)
  $top = [Math]::Max(0, $top - $padding)
  $right = [Math]::Min($Bitmap.Width - 1, $right + $padding)
  $bottom = [Math]::Min($Bitmap.Height - 1, $bottom + $padding)

  return [System.Drawing.Rectangle]::new($left, $top, $right - $left + 1, $bottom - $top + 1)
}

foreach ($sheet in $sheets) {
  if (-not [System.IO.File]::Exists($sheet.Path)) {
    throw "Missing sheet: $($sheet.Path)"
  }

  $image = [System.Drawing.Bitmap]::FromFile($sheet.Path)
  try {
    for ($row = 0; $row -lt 3; $row++) {
      for ($column = 0; $column -lt 3; $column++) {
        $index = ($row * 3) + $column
        $x1 = [Math]::Round(($image.Width * $column) / 3)
        $x2 = [Math]::Round(($image.Width * ($column + 1)) / 3)
        $y1 = [Math]::Round(($image.Height * $row) / 3)
        $y2 = [Math]::Round(($image.Height * ($row + 1)) / 3)
        $cellRect = [System.Drawing.Rectangle]::new($x1, $y1, $x2 - $x1, $y2 - $y1)
        $cell = $image.Clone($cellRect, $image.PixelFormat)
        try {
          $trimRect = Get-TrimBounds -Bitmap $cell
          $card = $cell.Clone($trimRect, $cell.PixelFormat)
          try {
            $targetPath = Join-Path $outputDir "$($sheet.Cards[$index]).png"
            $card.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "Wrote $targetPath"
          } finally {
            $card.Dispose()
          }
        } finally {
          $cell.Dispose()
        }
      }
    }
  } finally {
    $image.Dispose()
  }
}

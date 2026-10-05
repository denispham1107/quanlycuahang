param(
  [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Add-Type -AssemblyName System.Drawing

function Export-IconPng {
  param(
    [string] $Source,
    [string] $Destination,
    [int] $Size
  )

  $sourcePath = Join-Path $Root (Join-Path 'icons' $Source)
  $destinationPath = Join-Path $Root (Join-Path 'icons' $Destination)
  $original = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    if ($original.Width -ne $original.Height) {
      throw "Icon source must be square: $sourcePath"
    }
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($original, 0, 0, $Size, $Size)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $original.Dispose()
  }
}

Export-IconPng 'icon-v3-master.png' 'icon-v3-192.png' 192
Export-IconPng 'icon-v3-master.png' 'icon-v3-512.png' 512
Export-IconPng 'icon-v3-master.png' 'apple-touch-icon-v3.png' 180
Export-IconPng 'icon-v3-maskable-master.png' 'icon-v3-maskable-512.png' 512

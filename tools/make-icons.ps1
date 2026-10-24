# 生成 App 图标（192 / 512 PNG），仅依赖 Windows 自带的 System.Drawing
Add-Type -AssemblyName System.Drawing

function New-TankIcon {
    param([int]$Size, [string]$OutPath)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $u = $Size / 512.0

    # 背景渐变 + 圆角
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 22, 32, 43),
        [System.Drawing.Color]::FromArgb(255, 7, 9, 12),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 96 * $u
    $path.AddArc(0, 0, $r, $r, 180, 90)
    $path.AddArc($Size - $r, 0, $r, $r, 270, 90)
    $path.AddArc($Size - $r, $Size - $r, $r, $r, 0, 90)
    $path.AddArc(0, $Size - $r, $r, $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bg, $path)

    # 网格线
    $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 42, 58, 74), [Math]::Max(1, 4 * $u))
    foreach ($i in 1..3) {
        $p = $i * $Size / 4
        $g.DrawLine($gridPen, $p, 0, $p, $Size)
        $g.DrawLine($gridPen, 0, $p, $Size, $p)
    }

    # 履带
    $trackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 58, 63, 70))
    $g.FillRectangle($trackBrush, 96 * $u, 140 * $u, 56 * $u, 250 * $u)
    $g.FillRectangle($trackBrush, 360 * $u, 140 * $u, 56 * $u, 250 * $u)

    $darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 29, 33, 38))
    for ($y = 160; $y -le 340; $y += 36) {
        $g.FillRectangle($darkBrush, 96 * $u, $y * $u, 56 * $u, 14 * $u)
        $g.FillRectangle($darkBrush, 360 * $u, $y * $u, 56 * $u, 14 * $u)
    }

    # 车体
    $bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 195, 58))
    $g.FillRectangle($bodyBrush, 164 * $u, 150 * $u, 184 * $u, 240 * $u)

    $lightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 255, 246, 201))
    $g.FillRectangle($lightBrush, 164 * $u, 150 * $u, 184 * $u, 26 * $u)

    # 炮管
    $g.FillRectangle($bodyBrush, 240 * $u, 70 * $u, 32 * $u, 110 * $u)
    $g.FillRectangle($lightBrush, 240 * $u, 70 * $u, 12 * $u, 110 * $u)

    # 炮塔
    $turret = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 217, 77))
    $g.FillEllipse($turret, 194 * $u, 168 * $u, 124 * $u, 124 * $u)
    $darkTurret = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 168, 128, 28))
    $g.FillEllipse($darkTurret, 216 * $u, 190 * $u, 80 * $u, 80 * $u)
    $g.FillEllipse($lightBrush, 234 * $u, 208 * $u, 44 * $u, 44 * $u)

    # 底部阴影
    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
    $g.FillRectangle($shadow, 164 * $u, 356 * $u, 184 * $u, 34 * $u)

    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "生成: $OutPath"
}

$root = Split-Path -Parent $PSScriptRoot
New-TankIcon -Size 192 -OutPath (Join-Path $root 'www\icon-192.png')
New-TankIcon -Size 512 -OutPath (Join-Path $root 'www\icon-512.png')

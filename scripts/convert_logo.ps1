Add-Type -AssemblyName System.Drawing

$src = 'C:\Users\nakul\.gemini\antigravity\brain\7bbb643c-80f9-4789-80f5-5fa358b62082\skilltube_logo_1789198790030.jpg'
$img = [System.Drawing.Image]::FromFile($src)
$sizes = @(16, 48, 128)

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $s, $s)
    $outPath = "c:\Users\nakul\Documents\antigravity\quirky-fermi\icons\icon$s.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $outPath"
}
$img.Dispose()

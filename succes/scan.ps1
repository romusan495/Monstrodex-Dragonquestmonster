# Scan de l'écran de jeu : capture, lecture du texte (OCR de Windows, en français), résultat dans scan.json.
# Lancé caché par le traqueur ; s'arrête quand le traqueur (processus -Parent) n'existe plus.
# Réglages relus en continu dans scan-config.json : actif, intervalle (s), ecran (nom de périphérique, vide = principal), demande (scan immédiat).
param([string]$Dossier, [int]$Parent)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing, System.Windows.Forms, System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Attendre($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $null = $t.Wait(-1); $t.Result }

$moteur = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('fr-FR'))
if (-not $moteur) { $moteur = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
$max = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sortie = Join-Path $Dossier 'scan.json'
$tmp = Join-Path $env:TEMP "antre-scan-$Parent.png"

function Lire-Image([System.Drawing.Bitmap]$bmp) {
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  try {
    $f = Attendre ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
    $flux = Attendre ($f.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Attendre ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($flux)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sb = Attendre ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Attendre ($moteur.RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])
    $flux.Dispose()
    return @($res.Lines | ForEach-Object { $_.Text })
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

function Scanner($cfg) {
  $ecrans = [System.Windows.Forms.Screen]::AllScreens
  $e = $ecrans | Where-Object { $_.DeviceName -eq $cfg.ecran } | Select-Object -First 1
  if (-not $e) { $e = [System.Windows.Forms.Screen]::PrimaryScreen }
  $b = $e.Bounds
  $img = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.CopyFromScreen($b.X, $b.Y, 0, 0, $img.Size)
  $g.Dispose()
  # L'OCR de Windows limite la taille des images : on découpe en bandes verticales.
  $n = [Math]::Ceiling($b.Width / $max)
  $larg = [Math]::Ceiling($b.Width / $n)
  $haut = [Math]::Min($b.Height, $max)
  $lignes = @()
  for ($i = 0; $i -lt $n; $i++) {
    $rect = New-Object System.Drawing.Rectangle ($i * $larg), 0, ([Math]::Min($larg, $b.Width - $i * $larg)), $haut
    $part = $img.Clone($rect, $img.PixelFormat)
    $lignes += Lire-Image $part
    $part.Dispose()
  }
  $img.Dispose()
  return @{ t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); ecran = $e.DeviceName; lignes = $lignes
    ecrans = @($ecrans | ForEach-Object { @{ nom = $_.DeviceName; largeur = $_.Bounds.Width; hauteur = $_.Bounds.Height; principal = $_.Primary } }) }
}

$dernier = [DateTime]::MinValue
$derniereDemande = 0
while ($true) {
  if (-not (Get-Process -Id $Parent -ErrorAction SilentlyContinue)) { exit }
  $cfg = $null
  try { $cfg = Get-Content (Join-Path $Dossier 'scan-config.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
  if ($cfg) {
    $intervalle = [Math]::Max(10, [int]$cfg.intervalle)
    $demande = [double]$cfg.demande
    if (($cfg.actif -and ([DateTime]::Now - $dernier).TotalSeconds -ge $intervalle) -or $demande -gt $derniereDemande) {
      $derniereDemande = $demande
      $dernier = [DateTime]::Now
      try { $r = Scanner $cfg } catch { $r = @{ t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); erreur = "$_"; lignes = @() } }
      [IO.File]::WriteAllText($sortie, ($r | ConvertTo-Json -Depth 4 -Compress), $utf8)
    }
  }
  Start-Sleep -Seconds 2
}

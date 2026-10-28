param(
  [uri]$Url='https://wwmaker.fluorescentmice.fun/',
  [string]$ShortcutDirectory=[Environment]::GetFolderPath('Desktop'),
  [switch]$Launch
)
$ErrorActionPreference='Stop'
if($Url.Scheme -ne 'https' -or $Url.UserInfo -or $Url.AbsoluteUri.Contains('"')) { throw 'An HTTPS URL without credentials is required.' }
$browsers=@(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browser=$browsers | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
if(!$browser){throw 'Microsoft Edge or Google Chrome is required.'}
if(!(Test-Path -LiteralPath $ShortcutDirectory -PathType Container)){throw 'Shortcut directory does not exist.'}
$appDir=Join-Path $env:LOCALAPPDATA 'WWMaker'
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
$sourceIcon=Join-Path (Split-Path $PSScriptRoot -Parent) 'public/icons/app.ico'
$icon=Join-Path $appDir 'app.ico'
if(Test-Path -LiteralPath $sourceIcon){Copy-Item -LiteralPath $sourceIcon -Destination $icon -Force}
$path=Join-Path $ShortcutDirectory 'Weave and Wander Maker.lnk'
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($path)
$shortcut.TargetPath=$browser
$shortcut.Arguments='--app="'+$Url.AbsoluteUri+'"'
$shortcut.Description='Weave & Wander Maker - Asset Editor'
$shortcut.WorkingDirectory=$appDir
if(Test-Path -LiteralPath $icon){$shortcut.IconLocation=$icon}
$shortcut.Save()
Write-Output $path
if($Launch){Start-Process -FilePath $path}

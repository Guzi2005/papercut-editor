param(
  [Parameter(Mandatory=$true)][string[]]$ProjectConfig,
  [string]$NodePath='D:\NodeJS\node.exe',
  [string]$GodotPath='',
  [int]$Port=3108,
  [switch]$NoBrowser
)
$ErrorActionPreference='Stop'
$editorRoot=Split-Path $PSScriptRoot -Parent
$configs=@($ProjectConfig | ForEach-Object { (Resolve-Path -LiteralPath $_).Path })
$env:WEAVE_PROJECT_CONFIGS=ConvertTo-Json -InputObject $configs -Compress
$env:WEAVE_GODOT=$GodotPath
$url="http://127.0.0.1:$Port/"
try { $status=Invoke-RestMethod ($url+'__weave/status') -TimeoutSec 2 } catch { $status=$null }
if($status.version -eq 1) {
  $actual=@($status.configFiles)
  if(!$actual.Count -or (Compare-Object $configs $actual)) {throw 'This port serves different projects. Choose another -Port or restart that editor service.'}
} else {
  $logs=Join-Path $editorRoot 'work'; New-Item -ItemType Directory -Force -Path $logs | Out-Null
  Start-Process -FilePath $NodePath -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$Port",'--strictPort') -WorkingDirectory $editorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "project-$Port.log") -RedirectStandardError (Join-Path $logs "project-$Port-error.log") | Out-Null
  $ready=$false
  for($i=0;$i -lt 25;$i++){
    Start-Sleep -Milliseconds 300
    try {$s=Invoke-RestMethod ($url+'__weave/status') -TimeoutSec 1; if($s.version -eq 1){$ready=$true;break}}catch{}
  }
  if(!$ready){throw "Editor did not start. Check work/project-$Port-error.log."}
}
if(!$NoBrowser){Start-Process $url}
Write-Output $url

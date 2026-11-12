param([string]$TvIp='192.168.1.83',[int]$Port=26101,[switch]$SkipBackup,[switch]$Build)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$toolRoot=Join-Path $env:USERPROFILE '.tizen-extension-platform/server/sdktools/data/tools'
$sdb=Join-Path $toolRoot 'sdb.exe';$tz=Join-Path $toolRoot 'tizen-core/tz.exe'
if(!(Test-Path $sdb) -or !(Test-Path $tz)){throw 'Tizen SDK e SDB non trovati.'}
$device="${TvIp}:${Port}"
$package=Join-Path $root 'Release/AnimePlayer.wgt'
if($Build -or !(Test-Path $package)){& (Join-Path $PSScriptRoot 'build-tizen.ps1');if($LASTEXITCODE -ne 0){throw 'Build fallita'}}
& $sdb connect $device | Out-Host
& $sdb devices | Out-Host
# Stop the existing app: a live debug session can make the backup debug command time out.
& $sdb -s $device shell 0 kill tOIM55JMUl | Out-Host
if(!$SkipBackup){
 & node (Join-Path $PSScriptRoot 'tv-storage.mjs') backup $device
 if($LASTEXITCODE -ne 0){throw 'Backup LocalStorage fallito. Installazione annullata per sicurezza.'}
 # tv-storage starts the app in debug mode: stop before replacing it.
 & $sdb -s $device shell 0 kill tOIM55JMUl | Out-Host
}
& $tz install -p $package -e $device
if($LASTEXITCODE -ne 0){throw 'Installazione fallita. Conserva il backup TV.'}
& $sdb -s $device shell 0 kill tOIM55JMUl | Out-Host
if(!$SkipBackup){
 & node (Join-Path $PSScriptRoot 'tv-storage.mjs') restore $device
 if($LASTEXITCODE -ne 0){throw 'Ripristino fallito. Backup conservato in tools/local-private/. NON cancellarlo.'}
}
# Leave no debug process running after restore.
& $sdb -s $device shell 0 kill tOIM55JMUl | Out-Host
& $sdb -s $device shell 0 execute tOIM55JMUl.AnimePlayer | Out-Host
Write-Host "AniPlayer Angular installato su $device"

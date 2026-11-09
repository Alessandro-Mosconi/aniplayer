param([string]$Profile='SamsungS90F',[switch]$SkipChecks)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$tz=Join-Path $env:USERPROFILE '.tizen-extension-platform/server/sdktools/data/tools/tizen-core/tz.exe'
if(!(Test-Path $tz)){throw "Tizen SDK mancante: $tz"}
Push-Location $root
try {
 if(!(Test-Path 'node_modules')){throw 'Dipendenze Angular assenti: esegui npm install con Node compatibile.'}
 if(!$SkipChecks){& npm run typecheck;if($LASTEXITCODE -ne 0){throw 'TypeScript typecheck fallito'};& npm test;if($LASTEXITCODE -ne 0){throw 'Test falliti'}}
 & npm run build;if($LASTEXITCODE -ne 0){throw 'Build Angular fallita'}
 $browser=Join-Path $root 'dist/aniplayer/browser'
 if(!(Test-Path (Join-Path $browser 'index.html'))){throw "Output Angular non trovato: $browser"}
 $stage=Join-Path $root 'tizen'
 if((Resolve-Path -LiteralPath $stage).Path -ne (Join-Path (Resolve-Path -LiteralPath $root).Path 'tizen')){throw 'Directory staging Tizen inattesa'}
 Get-ChildItem $stage -Force | Where-Object {$_.Name -notin @('.project','.tproject','config.xml')} | Remove-Item -Force -Recurse
 Copy-Item (Join-Path $browser '*') -Destination $stage -Recurse -Force
 Copy-Item (Join-Path $root 'src/assets/images/icon.png') (Join-Path $stage 'icon.png') -Force
 # Samsung Tizen with strict CSP may block Angular's CSS media=print/onload optimization.
 # Bundle full global stylesheet directly into index.html as a <style> (allowed by style-src 'unsafe-inline').
 # Keep the CSS file too for inspection and validation; do not enable unsafe-inline scripts.
 $stageIndex=Join-Path $stage 'index.html'
 $stageStyles=Join-Path $stage 'styles.css'
 if(!(Test-Path $stageStyles)){throw 'Angular styles.css mancante: packaging annullato'}
 $html=[System.IO.File]::ReadAllText($stageIndex)
 $css=[System.IO.File]::ReadAllText($stageStyles)
 if([string]::IsNullOrWhiteSpace($css) -or $css.Length -lt 1500){throw 'CSS globale Angular vuoto o incompleto'}
 # Style link may have media=print and an inline onload handler blocked by Tizen CSP.
 $styleLinkPattern='<link\b(?=[^>]*\bhref\s*=\s*["''](?:\./)?styles\.css(?:\?[^"'']*)?["''])[^>]*>'
 if(![regex]::IsMatch($html,$styleLinkPattern,[System.Text.RegularExpressions.RegexOptions]::IgnoreCase)){
   throw 'Collegamento a styles.css assente in index.html: verificare l output Angular'
 }
 # Put the full stylesheet in the page rather than relying on an onload handler.
 $css=$css.Replace('</style','<\/style')
 $linkMatch=[regex]::Match($html,$styleLinkPattern,[System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
 $html=$html.Substring(0,$linkMatch.Index)+'<style data-aniplayer-tizen-css>'+$css+'</style>'+$html.Substring($linkMatch.Index+$linkMatch.Length)
 if(!$html.Contains('data-aniplayer-tizen-css') -or $html -match '(?is)<link[^>]*styles\.css'){
   throw 'Incorporamento CSS non riuscito'
 }
 [System.IO.File]::WriteAllText($stageIndex,$html,[System.Text.UTF8Encoding]::new($false))

 $files=@(Get-ChildItem -Path $stage -File -Recurse | Where-Object {$_.FullName -notmatch '\\(Build|Release|Debug|Test)\\' -and $_.Name -notin @('.project','.tproject','config.xml','tizen_web_project.yaml')} | ForEach-Object {$_.FullName.Substring($stage.Length+1).Replace('\','/')})
 $yaml=@('project_type: web_app','profile: tv-samsung','api_version: "9.0"','build_type: Release','output_name: AnimePlayer','output_path: ""','opt: false',"signing_profile: '$Profile'",'trust_anchor: []','files:')
 foreach($file in $files){$yaml+="  - '$file'"}
 $yaml+=@('excludes:','  - Build/*','  - Debug/*','  - Release/*','  - Test/*','  - .project','  - .tproject','  - tizen_web_project.yaml','deps: []')
 $yaml | Set-Content (Join-Path $stage 'tizen_web_project.yaml') -Encoding utf8
 Push-Location $stage
 try{& $tz build -b Release -s $Profile;if($LASTEXITCODE -ne 0){throw 'Build Tizen fallita'};& $tz pack;if($LASTEXITCODE -ne 0){throw 'Firma e packaging Tizen falliti'}}finally{Pop-Location}
 # The Tizen SDK may generate 'tizen.wgt' instead of the configured output_name.
 # Select the signed artifact from this build, then publish it under a stable name.
 $releaseDir=Join-Path $stage 'Release'
 $packages=@(Get-ChildItem -LiteralPath $releaseDir -Filter '*.wgt' -File -ErrorAction SilentlyContinue)
 if($packages.Count -eq 0){throw "WGT non prodotto in $releaseDir"}
 if($packages.Count -gt 1){throw "Packaging ambiguo: trovati $($packages.Count) WGT in $releaseDir; rimuovi gli output obsoleti e riprova."}
 $package=$packages[0].FullName
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $archive=[System.IO.Compression.ZipFile]::OpenRead($package)
 try {
  $entries=@($archive.Entries | ForEach-Object {$_.FullName})
  foreach($required in @('index.html','styles.css','config.xml','author-signature.xml','signature1.xml')){
   if($entries -notcontains $required){throw "WGT incompleto: manca $required in $package"}
  }
  $indexEntry=$archive.GetEntry('index.html')
  $reader=[System.IO.StreamReader]::new($indexEntry.Open())
  try { $packagedHtml=$reader.ReadToEnd() } finally { $reader.Dispose() }
  if(!$packagedHtml.Contains('data-aniplayer-tizen-css')){throw 'WGT senza CSS globale incorporato'}
 } finally {$archive.Dispose()}
 $release=Join-Path $root 'Release'
 New-Item $release -ItemType Directory -Force | Out-Null
 $target=Join-Path $release 'AnimePlayer.wgt'
 Copy-Item -LiteralPath $package -Destination $target -Force
 Write-Host "WGT firmato: $target (da $($packages[0].Name))"
}finally{Pop-Location}

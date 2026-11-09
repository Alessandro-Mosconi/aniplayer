import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();const file=path=>readFileSync(join(root,path),'utf8');
test('Angular 22 stable version pinned',()=>{const p=JSON.parse(file('package.json'));assert.equal(p.dependencies['@angular/core'],'22.2.5');assert.equal(p.devDependencies['@angular/cli'],'22.2.5');assert.ok(p.scripts['tizen:deploy']);});
test('Tizen package ID stays compatible with original app',()=>{const xml=file('tizen/config.xml');assert.match(xml,/tOIM55JMUl\.AnimePlayer/);assert.match(xml,/required_version="9\.0"/);assert.match(xml,/aniplayer/);});
test('Remote supports Samsung Return and media keys',()=>{const text=file('src/app/core/remote.service.ts');for(const code of ['10009','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','MediaPlayPause','MediaFastForward'])assert.ok(text.includes(code),code);});
test('Player has AVPlay and HTML5 fallback',()=>{const text=file('src/app/core/playback.service.ts');for(const token of ['prepareAsync','getTotalTrackInfo','getDuration','setDisplayRect','html5','commitScrub','saveIntro','setSubtitleTrack','playbackSegments'])assert.ok(text.includes(token),token);});
test('App uses Angular components, not the legacy main.js',()=>{const h=file('src/index.html');assert.match(h,/<app-root>/);assert.doesNotMatch(h,/js\/main\.js/);const ts=file('src/app/app.component.ts');assert.match(ts,/Component/);assert.match(ts,/inject\(AppFacadeService\)/);});
test('No client secret bundled, no proxy backend',()=>{const mal=file('src/app/core/mal.service.ts');assert.match(mal,/code_challenge_method:'plain'/);assert.doesNotMatch(mal,/client_secret\s*:/);assert.equal(existsSync(join(root,'server.js')),false);});
test('Deploy includes protective TV storage backup',()=>{const ps=file('tools/deploy-tizen.ps1');assert.match(ps,/tv-storage\.mjs.*backup/);assert.match(ps,/tv-storage\.mjs.*restore/);assert.match(file('.gitignore'),/local-private/);});
test('Original LocalStorage prefix kept',()=>{assert.match(file('src/app/core/storage.service.ts'),/autv\./);});

test('Every Angular package imported by components is installed',()=>{const p=JSON.parse(file('package.json'));assert.equal(p.dependencies['@angular/forms'],'22.2.5');for(const source of ['src/app/pages/catalog/catalog.page.ts','src/app/components/player.component.ts'])assert.match(file(source),/import \{FormsModule\} from '@angular\/forms'/);});

test('Every screen has its own Angular component, template and stylesheet',()=>{
 for(const page of ['home','catalog','anime-detail','related','favorites','history','settings','mal','diagnostics','my-anime','explore']){
  const folder=`src/app/pages/${page}/${page}.page`;
  for(const suffix of ['ts','html','scss'])assert.ok(existsSync(join(root,folder+'.'+suffix)),folder+'.'+suffix);
  assert.match(file(folder+'.ts'),/extends PageBase/);
 }
 const shell=file('src/app/app.component.html');
 for(const name of ['home','catalog','detail','related','favorites','history','settings','mal','diagnostics','my-anime','explore'])assert.ok(shell.includes(`@case ('${name}')`),name);
 assert.doesNotMatch(shell,/anime-card|episode-grid|settings-grid/);
});
test('Tizen pack accepts SDK-generated WGT names and exports stable AnimePlayer.wgt',()=>{
 const script=file('tools/build-tizen.ps1');
 assert.match(script,/Get-ChildItem.*-Filter '\*\.wgt'/);
 assert.match(script,/AnimePlayer\.wgt/);
 assert.match(script,/author-signature\.xml/);
 assert.match(script,/signature1\.xml/);
});


test('TV stylesheet is never deferred behind CSP-blocked onload event',()=>{
 const config=JSON.parse(file('angular.json'));
 const prod=config.projects.aniplayer.architect.build.configurations.production;
 assert.equal(prod.optimization.styles.inlineCritical,false);
 assert.match(file('src/index.html'),/width=1920/);
 const pack=file('tools/build-tizen.ps1');
 for(const pattern of [/data-aniplayer-tizen-css/,/styles\.css/,/CSS globale Angular/,/GetEntry\('index\.html'\)/]) assert.match(pack,pattern);
 assert.match(file('tizen/config.xml'),/style-src 'self' 'unsafe-inline'/);
 assert.doesNotMatch(file('tizen/config.xml'),/script-src[^;]*'unsafe-inline'/);
});

test('Deploy closes app before backup, to avoid competing debugger sessions',()=>{
 const ps=file('tools/deploy-tizen.ps1');
 const kill=ps.indexOf('shell 0 kill tOIM55JMUl');
 const backup=ps.indexOf('tv-storage.mjs');
 assert.ok(kill>=0&&kill<backup);
});

test('TV video plane clears document backgrounds while AVPlay is open',()=>{
 const css=file('src/styles.scss');const player=file('src/app/core/playback.service.ts');const html=file('src/app/app.component.html');
 assert.match(css,/html\.tv-video-active/);assert.match(css,/background:transparent!important/);
 assert.match(player,/setTransparentVideoLayer\(true\)/);assert.match(player,/setTransparentVideoLayer\(false\)/);
 assert.match(html,/\[hidden\]="playback\.state\(\)\.opened"/);
});
test('Original shuriken loader and separate editable phrases remain',()=>{
 const loader=file('src/app/components/anime-loader.component.ts');const phrases=file('src/app/frasi-caricamento.ts');
 assert.match(loader,/loader-shuriken/);assert.match(loader,/loader-spark/);assert.match(loader,/5000/);
 assert.match(phrases,/export const loadingPhrases:\s*string\[\]\s*=\s*\[\s*["\x27][^"\x27]+/);assert.match(file('src/app/components/player.component.html'),/app-anime-loader/);
});
test('Home has hero banner and remote can scroll to top beyond last focusable',()=>{
 const home=file('src/app/pages/home/home.page.html');const remote=file('src/app/core/remote.service.ts');
 assert.match(home,/class="hero"/);assert.match(home,/hero-art/);
 assert.match(remote,/window\.scrollTo\(\{top:0/);
});
test('Storage debugger uses the full Tizen application ID',()=>{assert.match(file('tools/tv-storage.mjs'),/call\('shell','0','debug',appId\)/);});

test('Original intro analyzer architecture and storage keys migrated',()=>{
 const a=file('src/app/core/audio-fingerprint.ts');const d=file('src/app/core/intro-detector.service.ts');
 const pre=file('src/app/core/intro-prefetch.service.ts');const api=file('src/app/core/intro.service.ts');
 for(const token of ['SpectralFrames','2048','24','Range','multiRange','MAX_BYTES','MAX_SECONDS','AudioDecoder','inferRepeated','matchTemplate','consensus','temporalContrast'])assert.ok(a.includes(token),token);
 for(const key of ['introDetections','introPrepared','introFingerprints'])assert.ok(d.includes(key),key);
 assert.ok(pre.includes("'introPrefetch'"));assert.ok(pre.includes('readVideoDuration'));assert.ok(pre.includes('120000'));assert.ok(pre.includes('this.playback.state().opened'));
 for(const key of ['introCorrections','aniskipAvailability','types%5B%5D=op','episodeLength'])assert.ok(api.includes(key),key);
});
test('Player uses verified audio, manual correction and AniSkip fallback',()=>{
 const p=file('src/app/core/playback.service.ts');const html=file('src/app/components/player.component.html');
 for(const key of ['this.detector.saved','this.detector.detect','this.introService.local','rememberNotFound','skipByAniSkip','cancelIntroAnalysis','disableIntro'])assert.ok(p.includes(key),key);
 assert.match(html,/object #avObject[^>]*\[hidden\]="p\.html5\(\)"/);
 assert.match(html,/Avanza −5 secondi/);
});
test('TV usability: audio versions, plot scroll, catalog focus and view-all',()=>{
 const detail=file('src/app/pages/anime-detail/anime-detail.page.html');
 const remote=file('src/app/core/remote.service.ts');const catalog=file('src/app/pages/catalog/catalog.page.ts');const home=file('src/app/pages/home/home.page.html');
 assert.match(detail,/Versione audio/);assert.match(detail,/tabindex="0" role="region"/);
 assert.match(remote,/active\.scrollTop/);assert.match(remote,/\.search-line/);assert.match(catalog,/catalogFocusHint/);
 assert.match(home,/home-history-all/);assert.match(home,/home-recent-all/);
 assert.match(file('src/app/core/catalog.service.ts'),/async version\(/);
});

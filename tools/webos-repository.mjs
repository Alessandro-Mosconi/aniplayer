import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile, copyFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';

const id = 'org.aniplayer.tv';
const [command, releasePath, packageDir, outputDir] = process.argv.slice(2);
try {
  const release = JSON.parse(await readFile(releasePath, 'utf8'));
  if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw Error('La release deve essere stabile e avere un tag nel formato vX.Y.Z.');
  }
  const version = release.tag_name.slice(1);
  const name = `${id}_${version}_all.ipk`;
  const assets = release.assets.filter(asset => asset.name === name && asset.state === 'uploaded');
  if (assets.length !== 1 || !assets[0].browser_download_url) throw Error(`IPK ${name} non trovato nella release.`);
  if (command === 'select') {
    console.log(name);
  } else if (command === 'generate') {
    const base = new URL(process.env.GITHUB_PAGES_BASE_URL.replace(/\/$/, '') + '/');
    if (base.protocol !== 'https:') throw Error('Il repository deve usare HTTPS.');
    const files = await readdir(packageDir);
    if (files.length !== 1 || files[0] !== name) throw Error('IPK scaricato non valido.');
    const bytes = await readFile(join(packageDir, name));
    if (!bytes.length || bytes.length !== assets[0].size) throw Error('Dimensione IPK non valida.');
    const iconUri = new URL('aniplayer/icon.png', base).href;
    const manifestUrl = new URL('aniplayer/app.manifest.json', base).href;
    const manifest = {id, version, type: 'web', title: 'AniPlayer', appDescription: 'Le tue storie. Il tuo schermo.', iconUri, rootRequired: false, ipkUrl: assets[0].browser_download_url, ipkHash: {sha256: createHash('sha256').update(bytes).digest('hex')}};
    await mkdir(join(outputDir, 'aniplayer'), {recursive: true});
    await writeFile(join(outputDir, 'repo.json'), JSON.stringify({packages: [{id, title: 'AniPlayer', iconUri, manifestUrl}]}, null, 2) + '\n');
    await writeFile(join(outputDir, 'aniplayer', 'app.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await copyFile('src/assets/images/aniplayer-icon-512.png', join(outputDir, 'aniplayer', 'icon.png'));
    await writeFile(join(outputDir, '.nojekyll'), '');
  } else throw Error('Comando non valido.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

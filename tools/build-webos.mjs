import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {root,run,preparePlatform} from './prepare-platform.mjs';
try{
 const stage=await preparePlatform('webos',{build:!process.argv.includes('--skip-build')});
 await mkdir(join(root,'Release'),{recursive:true});
 const candidates=[process.env.WEBOS_CLI,join(root,'tools/local-private/webos-sdk/node_modules/@webos-tools/cli/bin/ares-package.js'),join(root,'node_modules/@webos-tools/cli/bin/ares-package.js'),join(process.env.APPDATA||join(homedir(),'.npm-global'),'npm/node_modules/@webos-tools/cli/bin/ares-package.js'),'/usr/local/lib/node_modules/@webos-tools/cli/bin/ares-package.js','/usr/lib/node_modules/@webos-tools/cli/bin/ares-package.js'].filter(Boolean);
 const cli=candidates.find(path=>existsSync(path));
 if(!cli)throw Error('CLI LG assente: installa @webos-tools/cli con npm install -g, oppure imposta WEBOS_CLI al suo bin/ares-package.js');
 run(process.execPath,[cli,stage,'-o',join(root,'Release')]);
}catch(error){console.error(error.message);process.exitCode=1;}

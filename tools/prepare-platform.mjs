import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function run(command,args,options={}){
 const result=spawnSync(command,args,{cwd:root,stdio:'inherit',windowsHide:true,...options});
 if(result.error)throw result.error;if(result.status!==0)throw Error(command+' non riuscito ('+result.status+')');
}
export function npm(args){if(process.platform==='win32')run('cmd.exe',['/d','/c','npm',...args]);else run('npm',args);}
export async function preparePlatform(target,{build=true,projectRoot=root}={}){
 if(!['webos','android','web'].includes(target))throw Error('Piattaforma non valida');
 if(build)npm(['run','build']);
 const browser=join(projectRoot,'dist','aniplayer','browser');
 const html=await readFile(join(browser,'index.html'),'utf8');
 if(html.includes('assets/dev-fetch.js'))throw Error('Build di sviluppo: esegui npm run build prima di preparare i pacchetti TV');
 const stage=resolve(projectRoot,'dist','platforms',target),safe=resolve(projectRoot,'dist','platforms')+sep;
 if(!stage.startsWith(safe))throw Error('Staging fuori dalla directory prevista');
 await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});await cp(browser,stage,{recursive:true});
 if(html.includes('$WEBAPIS'))throw Error('SDK Samsung statico nella build multipiattaforma');
 if(target==='webos'){
  const info=JSON.parse(await readFile(join(projectRoot,'platforms','webos','appinfo.json'),'utf8'));
  if(info.type!=='web'||info.main!=='index.html'||!info.disableBackHistoryAPI)throw Error('Manifest webOS non valido');
  await writeFile(join(stage,'appinfo.json'),JSON.stringify(info,null,2));
  for(const name of ['icon.png','largeIcon.png'])await cp(join(projectRoot,'src/assets/images/aniplayer-icon-512.png'),join(stage,name));
 }
 return stage;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log('Build preparata:',await preparePlatform(process.argv[2],{build:!process.argv.includes('--skip-build')}));}catch(error){console.error(error.message);process.exitCode=1;}
}

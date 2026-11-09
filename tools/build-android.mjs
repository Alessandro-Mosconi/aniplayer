import {mkdir,cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {root,run,preparePlatform} from './prepare-platform.mjs';
try{
 const stage=await preparePlatform('android',{build:!process.argv.includes('--skip-build')});
 const project=join(root,'platforms','android'),assets=join(project,'app/src/main/assets/web');
 // preparePlatform already replaces its own staging. The Android assets folder
 // is generated only from that folder and excludes local user data.
 const {rm}=await import('node:fs/promises');
 if(!resolve(assets).startsWith(resolve(project,'app/src/main/assets')+sep))throw Error('Directory asset Android inattesa');
 await rm(assets,{recursive:true,force:true});await mkdir(assets,{recursive:true});await cp(stage,assets,{recursive:true});
 const drawable=join(project,'app/src/main/res/drawable');await mkdir(drawable,{recursive:true});
 await cp(join(root,'src/assets/images/aniplayer-icon-512.png'),join(drawable,'icon.png'));
 const env={...process.env};env.ANDROID_HOME=env.ANDROID_HOME||env.ANDROID_SDK_ROOT||(process.platform==='win32'?join(env.LOCALAPPDATA||'','Android','Sdk'):'');
 if(!env.ANDROID_HOME||!existsSync(env.ANDROID_HOME))throw Error('Installa Android SDK e imposta ANDROID_HOME');
 if(process.platform==='win32')run('cmd.exe',['/d','/c','gradlew.bat','--no-daemon','assembleDebug'],{cwd:project,env});
 else run('sh',['gradlew','--no-daemon','assembleDebug'],{cwd:project,env});
 const output=join(root,'Release','AniPlayer-AndroidTV-debug.apk');await mkdir(join(root,'Release'),{recursive:true});
 await cp(join(project,'app/build/outputs/apk/debug/app-debug.apk'),output);console.log('APK sperimentale:',output);
}catch(error){console.error(error.message);process.exitCode=1;}

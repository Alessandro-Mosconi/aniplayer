import {npm,run} from './prepare-platform.mjs';

try{
 // Tizen packaging runs checks and produces the shared production build first.
 npm(['run','tizen:pack']);
 run(process.execPath,['tools/build-webos.mjs','--skip-build']);
 run(process.execPath,['tools/build-android.mjs','--skip-build']);
 run(process.execPath,['tools/prepare-platform.mjs','web','--skip-build']);
 console.log('Pacchetti pronti in Release/; versione browser in dist/platforms/web/.');
}catch(error){console.error('Build completa interrotta:',error.message);process.exitCode=1;}

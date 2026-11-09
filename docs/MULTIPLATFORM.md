# Build multipiattaforma

La stessa interfaccia Angular viene ora preparata per più ambienti. **Pacchetto compilato non significa compatibilità hardware certificata.** Apple TV è esclusa da questo lavoro.

## Stato concreto

| Ambiente | Output / implementazione | Verifica necessaria |
| --- | --- | --- |
| Samsung Tizen | WGT esistente, AVPlay, tasti Samsung e app-control | Regressione sulla TV dopo gli adattamenti comuni. |
| LG webOS | IPK, manifest dedicato, Back 461, player HTML5, apertura browser tramite Luna | TV recente: rete/CORS, codec, Magic Remote, tastiera, ritorno da standby e uscita. |
| Android TV / Google TV | APK debug, Activity landscape/Leanback, player HTML5, ponte HTTP e deep link MAL | WebView aggiornata, telecomando e video su hardware. |
| Fire TV con Fire OS | Stesso APK Android, selezione Fire OS da user agent quando disponibile | Fire OS basato su Android API 26 o superiore; non vale per Vega. |
| Fire TV con Vega OS | Solo build web condivisa preparabile | Manca un contenitore Vega compilato e verificato: non installare l’APK Android. |
| VIDAA / altri browser TV | Build web condivisa preparabile | Accesso SDK/distribuzione del produttore, compatibilità del motore e CORS. Non è una versione nativa certificata. |
| Roku | Nessun pacchetto in questa revisione | Richiede un client SceneGraph separato: non esegue l’app Angular/DOM. |

Non vengono promessi tutti i modelli o tutte le versioni di sistema. LG NetCast e browser molto vecchi non sono un obiettivo di questa build.

## Prerequisiti comuni

```powershell
npm ci
npm run test:all
```

Per le prove con `npm start`, Angular usa un proxy di sviluppo per i provider e le API configurate, evitando il blocco CORS del browser. Riavvia il server dopo modifiche a `tools/dev-proxy.conf.mjs`. Questo proxy non viene caricato dai pacchetti di produzione e non aggira errori o verifiche richieste dai provider. Il normale uso dell’app sulle TV non richiede un server AniPlayer. Il relay MAL rimane opzionale. I dati `autv.*` restano locali a ciascuna installazione: non vengono trasferiti automaticamente tra sistemi TV.

## LG webOS

Installa la [CLI LG ufficiale](https://webostv.developer.lge.com/develop/tools/cli-introduction) separatamente dagli strumenti dell’app:

```powershell
npm install -g @webos-tools/cli@3.2.6
npm run webos:pack
```

Il comando prepara `dist/platforms/webos/` e genera `Release/org.aniplayer.tv_2.2.0_all.ipk`. Se la CLI è in un percorso diverso, imposta `WEBOS_CLI` al file `bin/ares-package.js` dell’installazione. È supportata anche un’installazione isolata in `tools/local-private/webos-sdk/`.

Per installare, configura un dispositivo con la Developer Mode app LG e la CLI:

```powershell
ares-setup-device
ares-novacom --device NOME_TV --getkey
ares-install --device NOME_TV Release/org.aniplayer.tv_2.2.0_all.ipk
ares-launch --device NOME_TV org.aniplayer.tv
```

Segui la [guida CLI LG](https://webostv.developer.lge.com/develop/tools/cli-dev-guide) per pairing, passphrase e durata del Developer Mode. `NOME_TV` è l’alias configurato con `ares-setup-device`.

Il manifest disabilita la gestione automatica della cronologia per far arrivare Back all’app. Dichiara `application.launcher` per aprire il browser tramite Luna sui sistemi con ACG. Il player usa `<video>` HTML5; AVPlay non viene caricato. Gli intervalli AniSkip possono funzionare anche senza WebCodecs, mentre l’analisi audio dipende dalle API e dai codec esposti dal modello.

Gli script Samsung di backup/deploy **non** vanno usati su LG. Backup automatico e migrazione tra installazioni LG non sono implementati.

## Android TV, Google TV e Fire OS

Occorrono **JDK 17**, Android SDK Platform 35 e Build Tools. Il Gradle wrapper 8.9 è incluso; al primo utilizzo può scaricare Gradle e i componenti Android. Imposta `ANDROID_HOME` e `JAVA_HOME` se non sono già configurati. Su Windows lo script cerca anche `%LOCALAPPDATA%/Android/Sdk`.

```powershell
npm run android:pack
# Alias per dispositivi Fire TV che eseguono Fire OS:
npm run fireos:pack
```

Entrambi generano `Release/AniPlayer-AndroidTV-debug.apk`, firmato con la chiave **debug locale**. Android minimo: API 26. È una build per prove e sideload, non una release pronta per gli store. Per una distribuzione stabile occorrono firma release propria, gestione del versionCode e verifiche delle policy della piattaforma.

Con ADB installato e dispositivo autorizzato:

```powershell
adb devices
adb install -r Release/AniPlayer-AndroidTV-debug.apk
adb shell am start -n org.aniplayer.tv/.MainActivity
```

Per collegamenti via rete segui il pairing ADB del dispositivo: porta e procedura variano, specialmente tra Android TV e Fire OS. Non viene effettuata alcuna installazione automatica durante la build.

### Come funziona il contenitore

- L’interfaccia è inclusa nell’APK e servita da un’origine HTTPS locale tramite `WebViewClient`; non viene caricata da un sito esterno.
- Il player resta HTML5 in WebView, con accelerazione hardware. Non è ancora un’integrazione Media3/ExoPlayer.
- Il ponte nativo inoltra le richieste `fetch` per gestire CORS, cookie, header e HTTP Range. Conserva lo stato HTTP e i byte delle risposte; supporta l’annullamento delle richieste.
- Non disattiva la verifica TLS e non permette di caricare pagine esterne dentro la WebView con il ponte nativo. I link esterni aprono il browser di sistema.
- L’HTTP non cifrato del ponte è limitato al relay MAL sulla porta 8766 in una LAN privata. Le API e le sorgenti usano HTTPS.
- Back, frecce, OK e tasti multimediali sono convertiti in eventi comuni all’app. La tastiera viene richiesta quando si entra in modifica di un input.
- Il deep link `aniplayer://mal/callback` torna all’app; resta disponibile il collegamento telefono/PC.
- Passando in background, il video viene messo in pausa e il progresso salvato.

Aggiornare un APK con una chiave diversa può richiedere la disinstallazione, con perdita dei dati locali. Il backup CDP degli script Samsung non è un backup Android.

## Build web per ulteriori port

```powershell
npm run web:prepare
```

Output: `dist/platforms/web/`, con base relativa e senza caricamento incondizionato delle librerie Samsung. Può essere servito via HTTPS come punto di partenza per un contenitore del produttore.

**Non equivale a un’app universale installabile.** Il browser può bloccare le richieste ai provider per CORS; supporto codec, persistenza e gestione dei tasti dipendono dall’ambiente. Una PWA non risolve automaticamente questi limiti.

### Vega

Il percorso ufficiale è il template WebView del [Vega SDK](https://developer.amazon.com/docs/vega/latest/build-an-app):

```text
vega project generate --template vegaWebview --name AniPlayerTV --packageId org.aniplayer.tv --outputDir AniPlayerVega
```

La build Angular può essere integrata in quel progetto, ma servono gestione dei servizi media, ciclo di vita, rete e un SDK Vega compatibile. Qui non viene fornito un VPKG e non viene dichiarato supporto Vega verificato.

### VIDAA e Roku

Per VIDAA servono gli strumenti e il percorso di distribuzione del produttore oltre alle verifiche sul motore web.

Roku richiede un’interfaccia e un player nel suo ambiente SceneGraph, con un contratto dati condiviso anziché il riuso diretto dei componenti Angular. Aggiungere un manifest o rinominare il pacchetto non costituisce un port: non viene incluso un finto pacchetto Roku.

## Verifiche prima di dichiarare una piattaforma supportata

1. Avvio a freddo, focus iniziale, navigazione in tutte le pagine e conferma di uscita.
2. Input e tastiera: attivazione solo con OK, spostamento del cursore, uscita con frecce/Back.
3. Provider, ricerca, paginazione, filtri, immagini e riconoscimento delle versioni audio.
4. Player: immagine e audio, pausa, seek, fine video, cambio episodio e salvataggio prima del cambio.
5. Ripresa dopo riavvio e pausa quando l’app va in background.
6. MAL pubblico/OAuth, cookie, rinnovo token, aggiornamenti e riconnessione.
7. AniSkip e analisi audio, con fallback esplicito quando WebCodecs non è disponibile.
8. Aggiornamento del pacchetto con mantenimento dei dati e firma coerente.

I test automatici coprono rilevamento piattaforma, normalizzazione tasti, rete binaria/Range, annullamento e staging. Non certificano codec, firmware o installazione su dispositivi reali.

## Verifiche eseguite in questa revisione

- Build Angular e pacchetto Samsung firmato generati.
- APK debug Android e IPK LG generati con gli strumenti delle rispettive piattaforme.
- Interfaccia provata in browser con ambiente LG e Android simulato: navigazione, switch, filtri e visibilità delle voci senza errori JavaScript.
- APK installato e avviato su un emulatore Android API 35 con profilo 1080p: avvio Angular, OK, switch, Back/conferma uscita e richiesta HTTPS reale attraverso il ponte nativo verificati.
- Corretto e verificato il ridimensionamento della WebView su schermi Android ad alta densità.

La riproduzione di sorgenti reali e le API dei produttori restano da collaudare su LG/Android/Fire TV fisici. L’emulatore non costituisce una certificazione di compatibilità TV.

# AniPlayer — Angular per Smart TV

<img src="src/assets/images/aniplayer-icon-512.png" alt="Icona AniPlayer" width="128" />

Client per Smart TV progettato per il telecomando: catalogo anime, riproduzione, cronologia, preferiti, esplorazione e integrazione con MyAnimeList.

Il catalogo usa AnimeUnity; la riproduzione cerca una corrispondenza su AnimeWorld. MAL è facoltativo: puoi usare l’app senza collegare un account.

**Stato:** progetto in sviluppo, con test automatici e packaging Samsung Tizen, LG webOS e Android TV / Fire OS. I nuovi port sono sperimentali e richiedono prove sui dispositivi. Il dispositivo di riferimento è Samsung S90F; il manifest Samsung richiede **Tizen 9.0**. La compatibilità con altri modelli e firmware non è garantita. Non è un’app ufficiale Samsung, MyAnimeList o dei provider.

**Uso consentito:** utilizza AniPlayer esclusivamente con contenuti e servizi ai quali hai diritto di accedere. Consulta il [disclaimer su copyright e responsabilità](#disclaimer-copyright-e-uso-consentito).

## Salta riassunti e sigle

Il player propone **Salta riassunto**, **Salta sigla iniziale** e **Salta sigla finale** appena dispone di una proposta AniSkip o di un intervallo verificato. I dati AniSkip vengono validati rispetto alla durata del video; se la sigla iniziale viene riconosciuta con audio e corrisponde a quella di riferimento, il suo offset riallinea anche riassunto e finale della stessa versione. Gli intervalli discordanti e le sigle miste a scene narrative non vengono accettati automaticamente.

Gli intervalli AniSkip vengono richiesti mentre il video si prepara e conservati in cache: il pulsante non aspetta l'analisi audio. Per una sigla compatibile che inizia entro cinque secondi, il confronto audio aggiuntivo viene evitato. La prima richiesta dipende comunque dalla disponibilità del servizio; le durate discordanti restano indicate come proposte da verificare.

Nei comandi del player gli indicatori compatti mostrano riassunto, sigla iniziale e finale: `--` se manca un intervallo, `A?` per una proposta AniSkip ancora da allineare, `A` per AniSkip compatibile o riallineato, `✓` per il riconoscimento audio, `✎` per una correzione manuale e `!` per un conflitto. Seleziona un indicatore con OK o un tocco per vedere i tempi di riferimento, quelli del video, l'offset applicato e il motivo dello stato. Il pulsante Salta usa subito una proposta AniSkip utilizzabile, poi si aggiorna dopo l'analisi; un conflitto sospende il salto interessato. Le correzioni manuali e la disattivazione della sigla mantengono la priorità.

L'analisi prova prima una finestra ridotta attorno ai tempi AniSkip o alle impronte locali; se non trova riscontri sufficienti, allarga la ricerca. Le impronte verificate della finale vengono riutilizzate negli episodi successivi della stessa serie e lingua: quando corrispondono basta analizzare il video corrente. Il primo riconoscimento resta più oneroso. Il riallineamento confronta riferimenti della stessa edizione e può usare la finale riconosciuta come secondo riscontro; un riassunto che si sovrappone alla sigla viene segnalato come conflitto.

Dopo un salto compare **Annulla salto** per cinque secondi. Riceve il focus solo se non ci sono altre azioni contestuali disponibili; Salta e Prossimo episodio hanno la precedenza. Ripristina la posizione precedente anche se il salto della finale ha già aperto l'episodio successivo.

I comandi principali usano icone: episodio precedente/successivo, indietro/avanti di 30 secondi, pausa/riprendi e PiP. `SUB`/`ITA` cambia la versione del video; **Salti** gestisce gli intervalli. La didascalia sotto i comandi descrive il pulsante con il focus. Dopo un salto i comandi e il focus vengono rimossi; dopo la finale resta disponibile il pulsante del prossimo episodio quando è nella finestra di fine episodio, senza riprendere il focus; OK/frecce o un tocco richiamano i comandi.

Nel player, il selettore **SUB / DUB ITA** sostituisce il precedente CC: sono sorgenti diverse, non tracce di sottotitoli. Mantiene lo stesso numero episodio e lo stato pausa/riproduzione, anche con ripresa automatica disattivata. Se le sigle di entrambe le versioni sono note e compatibili (correzioni, impronte audio o AniSkip validato), usa il loro offset per riallineare il punto a partire dalla sigla; prima della sigla o senza riferimenti affidabili mantiene i secondi esatti. Montaggi diversi possono comunque avere scene sfalsate. Non offre versioni prive dell'episodio richiesto; se la nuova sorgente fallisce o termina prima della posizione richiesta, prova a ripristinare la precedente al minuto originale.



Nei caricamenti la frase cambia ogni cinque secondi e i puntini seguono il ciclo `.`, `..`, `...`. Questo vale anche per i loader compatti di catalogo, Esplora e lista personale; con movimento ridotto i puntini rimangono fermi.


Se manca un intervallo della finale, negli ultimi sette minuti il player prova le impronte verificate già disponibili oppure il confronto audio degli ultimi cinque minuti con almeno due altri episodi. Richiede WebCodecs, video compatibili con richieste Range e un segmento ripetuto concorde di 45–150 secondi; può non trovare la sigla o non essere disponibile sul dispositivo. L'analisi si interrompe cambiando episodio e non rende obbligatorio il salto.

Premendo **Salta sigla finale**, se dopo la sigla resta del video vieni portato alla fine della sigla per guardarlo. Il prossimo episodio viene aperto direttamente solo se l'intervallo arriva alla fine del file e l'episodio successivo ? disponibile. I soli timestamp non distinguono una scena post-crediti da un'anteprima o da immagini nere: in dubbio il contenuto restante viene conservato.

Per i casi non riconosciuti apri **Salti** nei comandi del player, scegli riassunto, intro narrativa, sigla iniziale o finale, imposta inizio/fine in secondi e salva sul dispositivo. Le intro narrative e i riassunti diversi tra episodi non vengono riconosciuti con certezza tramite il solo confronto audio. I salti non contano come minuti effettivamente guardati per la soglia del visto.

## Prova su telefono

La Smart TV resta la piattaforma principale. Su telefono il layout adattivo usa un menu hamburger in alto: tocca ☰ per aprirlo, scegli una voce oppure tocca lo sfondo per chiuderlo. Ricerca, filtri e comandi si adattano allo spazio disponibile. In **Impostazioni → Versione PC** puoi attivare il layout adattivo o tornare alle dimensioni TV; la preferenza resta sul dispositivo.

- **Android (APK, Android 8 o superiore):** installa `Release/AniPlayer-AndroidTV-debug.apk`, lo stesso pacchetto delle TV Android. Su telefono usa le dimensioni dello schermo e consente la rotazione; su Android TV mantiene il layout TV orizzontale. Per aggiornare reinstalla con la stessa firma.
- **Browser del telefono:** sul PC avvia `npm start`, poi apri `http://IP_DEL_PC:4200` dal telefono sulla stessa rete Wi-Fi. Consenti Node.js nel firewall per la rete privata. Usa l'IP locale del PC, non `localhost`. Il server di sviluppo deve restare acceso per fornire anche il proxy necessario alle richieste dei provider.

In **Esplora mobile**, la copertina e le quattro azioni restano in primo piano. Apri **Info anime** per leggere generi e descrizione o accedere agli episodi; **Filtri** mostra le selezioni attive e **?** spiega i gesti. Fai swipe sulla copertina: destra per Mi piace, sinistra per Non mi interessa, su per aggiungere/rimuovere dai preferiti, giù per saltare. Sul testo puoi scorrere normalmente la pagina. Restano disponibili i pulsanti, Annulla ultima azione e le frecce del telecomando sulla TV.

**Picture-in-Picture (PiP):** durante il video premi **PiP ↗** nei comandi del player. Nell'APK Android su telefono puoi anche premere Home mentre il video è in riproduzione. La finestrella mostra solo il video; toccala per tornare all'app. Android deve supportare e autorizzare il PiP per AniPlayer. Nel browser il pulsante compare solo quando le API PiP sono disponibili: il supporto varia per browser e dispositivo e può richiedere HTTPS. Le TV mantengono la riproduzione normale. [Documentazione Android](https://developer.android.com/develop/ui/views/picture-in-picture), [API PiP del browser](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestPictureInPicture).

Nel browser la riproduzione dipende dai formati e dalle regole CORS del servizio video. L'APK mobile è sperimentale: le verifiche responsive e la compilazione non sostituiscono una prova sul telefono reale.

## Installa AniPlayer sulla tua Smart TV

Scegli il **sistema operativo** della TV, non soltanto il marchio: per esempio, televisori dello stesso produttore possono usare Google TV oppure VIDAA. Lo trovi nelle informazioni del dispositivo.

| La tua TV / dispositivo | Guida | File da installare |
| --- | --- | --- |
| Samsung con Tizen 9.0 o superiore | [Samsung](#samsung-tizen) | `.wgt`, firmato per la tua TV |
| LG con webOS recente | [LG](#lg-webos) | `.ipk` |
| Android TV / Google TV | [Android e Google TV](#android-tv-e-google-tv) | `.apk` |
| Fire TV / Fire TV Stick con Fire OS compatibile | [Fire TV](#amazon-fire-tv-con-fire-os) | `.apk` |
| Fire TV con Vega, VIDAA o Roku | [Piattaforme non ancora supportate](#piattaforme-non-ancora-supportate) | Nessun pacchetto nativo disponibile |

**Prima di iniziare:** collega PC e TV alla stessa rete. Se nella pagina **Releases** del repository è presente il pacchetto per il tuo sistema, puoi scaricarlo; altrimenti scarica i sorgenti, apri un terminale nella cartella del progetto ed esegui `npm ci`, poi il comando di compilazione indicato sotto. La cartella `Release/` viene generata sul PC e non è inclusa nel repository.

I comandi seguenti si eseguono dalla cartella del progetto. Gli IP sono esempi: sostituiscili con quelli dei tuoi dispositivi. Le versioni LG e Android/Fire OS sono **sperimentali**: il pacchetto è compilato, ma resta necessario provarlo sul proprio modello.

### Samsung Tizen

**Servono:** PC Windows, Node.js, strumenti Samsung TV/SDB e un certificato Samsung autorizzato per il DUID della tua TV. Un WGT firmato per un altro dispositivo potrebbe non installarsi.

1. Installa gli strumenti Samsung e crea il tuo profilo di firma: [istruzioni per TV e certificati](#preparare-tv-e-certificati).
2. Sulla TV apri **Apps**, abilita **Developer Mode** e inserisci l’**IP del PC**. Su molti modelli il pannello si apre digitando `12345`; riavvia la TV quando richiesto.
3. Annota l’**IP della TV**, per esempio `192.168.1.50`.
4. Compila con il nome del tuo profilo, sostituendo `IlMioProfilo`:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\build-tizen.ps1 -Profile 'IlMioProfilo'
   ```

5. Per la **prima installazione**, quando non ci sono dati AniPlayer da conservare:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\deploy-tizen.ps1 -TvIp 192.168.1.50 -SkipBackup
   ```

6. Lo script installa e avvia AniPlayer. In seguito la trovi tra le app della TV.

**Per aggiornare:** ricompila con lo stesso certificato autore ed esegui il deploy **senza `-SkipBackup`**, così vengono salvati e ripristinati i dati. Non disinstallare l’app per un normale aggiornamento. [Dettagli e backup](#installazione-e-aggiornamenti).

### LG webOS

**Servono:** PC con Node.js, la CLI LG e l’app **Developer Mode** sulla TV. Non si installa copiando l’IPK su una chiavetta USB.

1. Installa **Developer Mode** dallo store della TV, accedi con un account LG Developer e attiva **Dev Mode Status**. Riavvia se richiesto.
2. Riapri Developer Mode, attiva **Key Server** e annota IP e **Passphrase** mostrati sulla TV.
3. Sul PC installa la CLI. Esegui anche `npm run webos:pack` se devi generare l’IPK:

   ```powershell
   npm install -g @webos-tools/cli@3.2.6
   npm run webos:pack
   ```

4. Registra la TV nella CLI. Nell’esempio l’alias è `miaLG`:

   ```powershell
   ares-setup-device --add miaLG -i "host=192.168.1.50" -i "port=9922" -i "username=prisoner"
   ares-novacom --device miaLG --getkey
   ```

   Quando viene richiesta, inserisci la Passphrase della TV.

5. Installa il pacchetto e avvia l’app:

   ```powershell
   ares-install --device miaLG Release/org.aniplayer.tv_2.2.0_all.ipk
   ares-launch --device miaLG org.aniplayer.tv
   ```

**Per aggiornare:** installa il nuovo IPK con lo stesso ID senza disinstallare prima. Non è incluso un backup automatico LG. Controlla la scadenza del Developer Mode nell’app LG e rinnova la sessione secondo le indicazioni del produttore. [Guida ufficiale LG](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app).

### Android TV e Google TV

**Serve:** una TV con Android 8 / API 26 o superiore e un metodo consentito dal dispositivo per installare APK esterni.

1. Procurati **`AniPlayer-AndroidTV-debug.apk`**. Per generarlo dal PC servono JDK 17 e Android SDK; esegui `npm run android:pack` e lo troverai in `Release/`.
2. Trasferisci l’APK sulla TV, per esempio tramite una chiavetta USB o un’app di trasferimento file.
3. Apri l’APK con un gestore file sulla TV. Se richiesto, autorizza l’installazione da quella sorgente e conferma **Installa**. I menu e i metodi disponibili variano tra modelli.
4. Apri **AniPlayer** dall’elenco delle app. Il PC non deve restare acceso per usare l’app.

**Alternativa dal PC con ADB:** abilita le opzioni sviluppatore e il debug sulla TV. Collega e autorizza il dispositivo seguendo la procedura indicata dalla TV; il debug wireless può richiedere pairing e porte diverse. Poi esegui:

```powershell
adb devices
adb -s INDIRIZZO_DISPOSITIVO install -r Release/AniPlayer-AndroidTV-debug.apk
adb -s INDIRIZZO_DISPOSITIVO shell am start -n org.aniplayer.tv/.MainActivity
```

Sostituisci `INDIRIZZO_DISPOSITIVO` con l’identificativo riportato da `adb devices`, ad esempio `192.168.1.50:5555` se il dispositivo usa quella porta. Non presumere che tutte le TV usino `5555`.

**Per aggiornare:** reinstalla l’APK sopra la versione precedente usando la stessa firma. Questa è una build debug per prove, non una release pubblicata negli store. [Requisiti di compilazione e dettagli Android](docs/MULTIPLATFORM.md#android-tv-google-tv-e-fire-os).

### Amazon Fire TV con Fire OS

**Prima controlla il sistema:** questa procedura vale per **Fire OS basato su Android API 26 o superiore**, non per **Vega OS**. Serve inoltre che il modello permetta ADB/sideload.

1. Procurati `AniPlayer-AndroidTV-debug.apk`, lo stesso file usato per Android TV. Per compilarlo usa `npm run fireos:pack`.
2. Sulla Fire TV apri **Impostazioni → La mia Fire TV → Opzioni sviluppatore** e attiva **Debug ADB**, se disponibile. Annota l’IP del dispositivo dalle informazioni di rete.
3. Sul PC, con Android Platform Tools/ADB installati, collegati e accetta l’autorizzazione sullo schermo della TV:

   ```powershell
   adb connect 192.168.1.50:5555
   adb devices
   ```

4. Installa e avvia AniPlayer:

   ```powershell
   adb -s 192.168.1.50:5555 install -r Release/AniPlayer-AndroidTV-debug.apk
   adb -s 192.168.1.50:5555 shell am start -n org.aniplayer.tv/.MainActivity
   ```

**Per aggiornare:** ripeti l’installazione con `-r` e la stessa firma, senza disinstallare prima. Se il dispositivo non espone le opzioni sviluppatore o non permette il sideload, questa procedura non è applicabile. [Guida ADB ufficiale Amazon](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html).

### Piattaforme non ancora supportate

**Vega OS, VIDAA e Roku:** non è disponibile un pacchetto nativo verificato. Non provare a installare l’APK Android su questi sistemi. Apple TV è esclusa. Per stato dei port e limiti consulta [MULTIPLATFORM.md](docs/MULTIPLATFORM.md).

## Indice

- [Funzioni](#funzioni)
- [Installazione per tipo di Smart TV](#installa-aniplayer-sulla-tua-smart-tv)
- [Altre piattaforme TV](#altre-piattaforme-tv)
- [Requisiti](#requisiti)
- [Avvio sul PC](#avvio-sul-pc)
- [Preparare TV e certificati](#preparare-tv-e-certificati)
- [Compilare il pacchetto](#compilare-il-pacchetto)
- [Installazione e aggiornamenti](#installazione-e-aggiornamenti)
- [Telecomando e navigazione](#telecomando-e-navigazione)
- [MyAnimeList](#myanimelist)
- [Sigle e prossimo episodio](#sigle-e-prossimo-episodio)
- [Impostazioni e dati locali](#impostazioni-e-dati-locali)
- [Problemi comuni](#problemi-comuni)
- [Sviluppo e struttura](#sviluppo-e-struttura)
- [Crediti e servizi utilizzati](#crediti-e-servizi-utilizzati)
- [Disclaimer: copyright e uso consentito](#disclaimer-copyright-e-uso-consentito)
- [Contributi e licenze](#contributi-e-licenze)

## Funzioni

- **Home:** continua a guardare, ultimi episodi, titoli in evidenza e anime già esplorati.
- **Catalogo:** ricerca, audio Tutti / SUB ITA / DUB ITA, generi multipli, tipo, stato, filtri sui visti e sulle scelte di esplorazione.
- **Ordinamento:** titolo, popolarità, valutazione, uscita crescente/decrescente e casuale con rimescolamento.
- **Esplora:** scheda grande con trama e informazioni, mi piace, non mi interessa, preferiti, salta e annullamento dell’ultima azione. Disattivabile nelle impostazioni.
- **Player:** Samsung AVPlay o HTML5, ripresa, timeline, comandi multimediali, salto intro e prossimo episodio con focus automatico.
- **Visti:** spunta manuale e completamento basato sulle parti effettivamente guardate, conservate tra sessioni.
- **MAL:** lettura da username pubblico oppure collegamento autorizzato per inviare i progressi; dashboard e lista personale con ricerca e filtri.
- **Personalizzazione:** voci e ordine del menu, interruttori per le opzioni, gestione delle copie locali e dell’account ricordato.

Il funzionamento dipende dalla disponibilità dei provider, dai domini e dalle restrizioni di rete/CORS. AniPlayer non include file video e non ospita i contenuti.

## Altre piattaforme TV

Per installare scegli la tua piattaforma nella [guida rapida in cima al README](#installa-aniplayer-sulla-tua-smart-tv). Per architettura, strumenti di compilazione e verifiche effettuate consulta [MULTIPLATFORM.md](docs/MULTIPLATFORM.md).

## Requisiti

### Sviluppo nel browser

- Git, Node.js e npm.
- Versioni Node ammesse da `package.json`: `^22.22.3`, `^24.15.0` oppure `>=26.0.0`. Per questa guida puoi usare Node 24 da 24.15.0 in poi.
- Browser moderno. AVPlay è disponibile solo sulla TV; nel browser si usa HTML5.

### Strumenti per Samsung Tizen

- PC Windows e PowerShell: gli script inclusi sono scritti per questo ambiente.
- Samsung Tizen SDK / estensione Tizen per Visual Studio Code, strumenti Samsung TV, SDB e gestione certificati.
- Profilo di firma Samsung valido per la TV.
- TV con Developer Mode attivo e raggiungibile dal PC nella stessa rete.

Gli script cercano gli strumenti qui:

```text
%USERPROFILE%\.tizen-extension-platform\server\sdktools\data\tools\sdb.exe
%USERPROFILE%\.tizen-extension-platform\server\sdktools\data\tools\tizen-core\tz.exe
```

Se il tuo SDK è installato altrove, aggiorna `$tz` in [build-tizen.ps1](tools/build-tizen.ps1) e `$toolRoot` in [deploy-tizen.ps1](tools/deploy-tizen.ps1). Per il solo backup puoi impostare `SDB_PATH` al percorso di `sdb.exe`.

## Avvio sul PC

Clona il repository usando il suo URL GitHub, apri PowerShell nella cartella del progetto ed esegui:

```powershell
node --version
npm --version
npm ci
npm start
```

Apri **http://localhost:4200**. Il server ascolta su tutte le interfacce: da un altro dispositivo della LAN puoi usare `http://IP_DEL_PC:4200`, se il firewall lo permette.

Per verificare i sorgenti e compilare:

```powershell
npm run test:all
```

Esegue controllo TypeScript, test e build di produzione. L’output web è in `dist/aniplayer/browser/`: non è ancora un pacchetto installabile sulla TV.

Con `npm start`, le richieste ai provider e alle API configurate passano dal proxy di sviluppo Angular per evitare i blocchi CORS del browser. Dopo modifiche al proxy riavvia il server. Il proxy non disabilita TLS, non aggira verifiche o errori dei siti e non viene caricato dai pacchetti TV di produzione. Sorgenti video/CDN non configurati possono ancora avere limitazioni CORS. Il comportamento del browser non certifica quello di AVPlay sulla TV.

## Preparare TV e certificati

1. Installa gli strumenti Samsung TV e il gestore certificati: [TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html), [certificati Samsung](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).
2. Crea un profilo di firma con certificato autore e distributore. Registra il DUID della TV tra i dispositivi autorizzati seguendo il gestore certificati.
3. Sulla TV apri Apps e abilita Developer Mode. Su molti modelli il pannello si apre digitando `12345` nella schermata Apps; la procedura può variare con il firmware.
4. In Developer Mode inserisci l’**IP del PC**, non quello della TV, e riavvia la TV come richiesto.
5. Annota l’**IP della TV**: servirà per SDB e deploy.
6. Collegati con Device Manager e autorizza l’installazione sul dispositivo, se richiesto. Vedi la [guida Samsung per la TV](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html).

Verifica la connessione sostituendo l’IP dell’esempio con quello della TV:

```powershell
$sdb = Join-Path $env:USERPROFILE '.tizen-extension-platform/server/sdktools/data/tools/sdb.exe'
& $sdb connect 192.168.1.50:26101
& $sdb devices
```

La TV deve comparire tra i dispositivi connessi. Evita reti ospiti con isolamento tra dispositivi; PC e TV devono potersi raggiungere.

## Compilare il pacchetto

Per rigenerare **tutte le versioni** (Samsung, LG, APK Android/Fire OS e browser), dalla cartella del progetto:

```powershell
npm run build:all
```

Il comando esegue prima i controlli e compila Angular una sola volta, poi prepara i pacchetti in sequenza. Richiede gli SDK delle piattaforme e un profilo Samsung valido. I pacchetti vengono salvati in `Release/`, la versione browser in `dist/platforms/web/`. Se un passaggio fallisce, il comando si interrompe.

Per inviare il pacchetto Samsung appena generato alla TV configurata (`192.168.1.103`):

```powershell
npm run dist
```

Il deploy esegue **backup prima dell'installazione**, ripristina i dati e avvia AniPlayer. Se il backup fallisce, non installa. Per aggiornare anche la build Samsung prima dell'invio usa `npm run dist -- -Build`; per un IP diverso usa `npm run dist -- -TvIp 192.168.1.50`. I backup restano privati in `tools/local-private/` e non vanno pubblicati.

Il profilo predefinito è `SamsungS90F`. **I certificati non sono inclusi:** usa il nome del tuo profilo, ad esempio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\build-tizen.ps1 -Profile 'IlMioProfilo'
```

Se il tuo profilo si chiama esattamente `SamsungS90F`:

```powershell
npm run tizen:pack
```

Lo script verifica TypeScript e test, compila Angular, prepara `tizen/`, incorpora il CSS globale per la CSP Samsung, firma e verifica il pacchetto. Il risultato è:

```text
Release/AnimePlayer.wgt
```

`-SkipChecks` salta typecheck e test, ma ricompila comunque Angular: usalo solo dopo le verifiche sulla stessa versione dei sorgenti.

`tizen/` è anche un’area di staging: i contenuti generati vengono sostituiti a ogni build. Modifica l’interfaccia in `src/`, non nei file compilati di `tizen/` o `dist/`.

## Installazione e aggiornamenti

Gli IP negli esempi vanno sostituiti con quello della tua TV.

### Prima installazione

Dopo aver creato il WGT con il tuo profilo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\deploy-tizen.ps1 -TvIp 192.168.1.50 -SkipBackup
```

**Usa `-SkipBackup` solo per la prima installazione, senza dati preesistenti da conservare.** Il backup richiede un’app già installata: su una TV nuova può fallire prima del deploy.

### Aggiornamento con conservazione dei dati

Compila con lo **stesso certificato autore**, conserva l’identità dell’app e poi esegui:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\deploy-tizen.ps1 -TvIp 192.168.1.50
```

Il deploy ferma l’app, salva le chiavi `autv.*`, installa, ripristina i dati e riapre AniPlayer. Se il backup fallisce, interrompe l’installazione. Non usare `-SkipBackup` per aggirare un errore quando hai dati da conservare.

Il backup è in `tools/local-private/tv-userdata.json`. Prima di aggiornare, conserva separatamente una copia del backup precedente: il nuovo backup usa lo stesso nome di file.

Identità corrente, condivisa da manifest e script:

```text
Application ID: tOIM55JMUl.AnimePlayer
Package ID:     tOIM55JMUl
```

Cambiare identità o disinstallare può interrompere la continuità dei dati. Per una tua distribuzione, se cambi questi ID aggiorna insieme `tizen/config.xml`, `tools/deploy-tizen.ps1` e `tools/tv-storage.mjs`.

È disponibile anche `-Build` sul deploy, ma compila con il profilo predefinito `SamsungS90F`. Con un profilo diverso, esegui prima il packaging con `-Profile`, poi il deploy senza `-Build`.

### Backup e ripristino manuali

Con app installata e TV connessa:

```powershell
node tools/tv-storage.mjs backup 192.168.1.50:26101
node tools/tv-storage.mjs restore 192.168.1.50:26101
```

Questi comandi avviano una sessione di debug. Chiudi eventuali altri debugger; lo script di deploy gestisce automaticamente arresto e riapertura dell’app.

## Telecomando e navigazione

| Comando | Azione |
| --- | --- |
| Frecce | Sposta il focus tra menu, schede e pulsanti; nei filtri Destra/Sinistra segue la riga. |
| OK | Attiva il comando. Su un input entra in modifica e apre la tastiera. |
| Su/Giù durante la modifica di un input | Esce dalla modifica per continuare la navigazione. |
| Return / Indietro | Chiude input, pannelli o dialoghi; dai dettagli torna indietro. Dalle schermate principali chiede conferma per uscire. |
| Play/Pausa | Controlla la riproduzione. |
| Avanti/Indietro multimediale | Sposta la riproduzione di 30 secondi. |
| Stop | Chiude il player e salva il progresso. |

Nel player, Return annulla prima lo spostamento sulla timeline o chiude un pannello; poi nasconde i comandi e, premuto ancora, chiude il player. Sulla timeline, Sinistra/Destra prepara uno spostamento e OK lo conferma.

### Ricerca e filtri

1. Apri **Catalogo**, raggiungi il campo di ricerca e premi OK per scrivere.
2. Scegli i filtri. I generi permettono selezione multipla; premi **Fatto** per chiudere il pannello.
3. Premi **Applica filtri e cerca** o **Cerca**.

I filtri dei visti sono **Tutti**, **Mai visti**, **Con episodi da vedere**. Quelli di esplorazione distinguono già esplorati, mi piace, non mi interessa e mai esplorati.

L’ordine casuale resta stabile tra pagine fino a **Rimescola**. Per l’uscita, l’app prova a recuperare date complete da AniList tramite gli ID MAL e le conserva in cache; senza date complete o in caso di errore usa anno e stagione. La data visibile sulla scheda permette di verificare la precisione disponibile.

### Esplora

Con il focus sulla scheda grande:

| Tasto | Scelta |
| --- | --- |
| Sinistra | Non mi interessa |
| Destra | Mi piace |
| Su | Aggiunge o rimuove dai preferiti |
| Giù | Salta |
| OK | Apre il dettaglio |

In Esplora, **Return/Esc** porta al menu laterale; puoi anche premere il pulsante **Menu** in alto. La freccia Sinistra sulla scheda salva invece Non mi interessa. Dal menu, un ulteriore Indietro mostra la conferma di uscita.

Le scelte sono locali e non modificano MAL. Mi piace e preferiti sono indipendenti. Puoi annullare l’ultima azione; nel dettaglio trovi **Elimina scelta** per riportare il titolo tra i mai esplorati. Per sfogliare le scelte salvate usa i filtri del catalogo.

## MyAnimeList

### Visti da username, senza login

Apri **Impostazioni → Visti da username MAL → Allinea i visti · Senza login**, inserisci lo username e importa. La lista MAL deve essere pubblica.

Questa modalità mostra i progressi in AniPlayer e abilita **I miei anime**, con dashboard e lista personale. Non modifica MAL. Per aggiornare la copia locale, ripeti l’allineamento.

### Collegare l’account per inviare i progressi

Apri **Impostazioni → Aggiorna MAL automaticamente**. Dopo il consenso puoi attivare o mettere in pausa gli invii con lo switch.

Il percorso consigliato usa telefono e PC, evitando i limiti del browser TV e il taglio degli URL lunghi da parte di SmartThings:

1. Sul PC esegui `npm run mal:relay` dalla cartella del progetto e lascia aperto il terminale.
2. Sulla TV inserisci l’indirizzo LAN del PC stampato dal comando, per esempio `http://192.168.1.10:8766`.
3. Premi **Collega dal telefono** e scansiona il QR con il telefono sulla stessa rete.
4. Dalla pagina sul telefono apri MAL, accedi e premi **Allow**.
5. Dopo il reindirizzamento copia **tutto l’URL dalla barra del browser**, inclusi `code` e `state`, anche se la pagina locale non si apre.
6. Torna alla pagina del relay sul telefono, incolla il link e premi **Invia alla TV**. AniPlayer completa il collegamento e mostra il risultato sulla TV.

Il relay serve solo durante il collegamento e ascolta sulla porta **8766**. Autorizza il firewall sulla rete privata, se necessario; non esporlo su Internet. Il callback locale usa invece **8765**: non scambiare le due porte. Nessun server deve rispondere sul telefono a `127.0.0.1:8765`.

### Configurare una propria applicazione MAL

È incluso un Client ID pubblico preconfigurato. Per una tua distribuzione registra la tua applicazione su [MyAnimeList API Config](https://myanimelist.net/apiconfig):

- **App Type:** `other`.
- **App Redirect URL:** registra `http://127.0.0.1:8765/callback` per il percorso telefono/PC. Per il metodo con browser TV è previsto anche `aniplayer://mal/callback`.
- In AniPlayer apri **Altri metodi e configurazione**, inserisci Client ID e Redirect URI corrispondente e salva.

Se redistribuisci i sorgenti con un tuo ID predefinito, aggiorna anche `MAL_PUBLIC_CLIENT_ID` in `src/app/core/mal.service.ts`: la lettura da username usa questa costante; OAuth usa la configurazione salvata sulla TV. Il Client Secret non viene usato e non va inserito nel codice.

Una richiesta dura circa 15 minuti. Non mescolare QR, callback e richieste diverse. I metodi alternativi con callback incollato sulla TV sono nella stessa pagina; per URL molto lunghi usa il relay.

### Progressi, disconnessione e cancellazione

- Il visto automatico richiede almeno il **75% di copertura effettiva** e l’arrivo vicino alla fine o all’ending riconosciuto. Saltare direttamente in fondo non basta.
- Con account collegato, **Segna visto** aggiorna anche MAL. Togliere il visto richiede conferma.
- MAL memorizza un numero progressivo: togliere il visto all’episodio N riporta il progresso al massimo a N−1, rendendo non visti anche i successivi. Non gestisce spunte indipendenti per episodio.
- **Disconnetti · Ricorda account** conserva l’autorizzazione locale. **Riconnetti** la riutilizza finché MAL permette il rinnovo.
- **Dimentica account e autorizzazione** rimuove l’accesso locale e richiede un nuovo consenso al prossimo collegamento.
- Eliminare le copie scaricate non cancella la lista sul sito MAL. Username pubblico e account autorizzato si gestiscono separatamente.

Approfondimenti: [Login MAL](docs/MAL_LOGIN.md) e [libreria personale](docs/LIBRARY_DISCOVERY.md).

## Sigle e prossimo episodio

L’app combina AniSkip, verifica della durata, confronto audio tra episodi e impronte locali. Il riconoscimento audio richiede WebCodecs con AAC compatibile e risposte HTTP Range utilizzabili dal server.

La preanalisi dei preferiti si attiva dalle impostazioni, lavora una serie alla volta e si sospende durante la visione. **Salta intro** riceve il focus quando compare. Dal comando **Sigla** del player puoi correggere inizio/fine, disabilitare lo skip per l’episodio o ricalcolarlo.

Se esiste un episodio successivo disponibile, **Prossimo episodio** compare già selezionato:

- all’inizio dell’ending AniSkip, se compatibile;
- usando lo stesso offset dell’intro riconosciuta tramite audio/impronta rispetto ad AniSkip, quando gli intervalli sono coerenti;
- in assenza di dati utilizzabili, negli ultimi **180 secondi o nell’ultimo 10%**, scegliendo il periodo più breve.

L’offset dell’ending è una stima: tagli dopo l’intro possono renderlo impreciso. Il pulsante richiede OK; lo switch **Episodio successivo** controlla invece l’avanzamento automatico alla fine del video.

Dettagli dell’algoritmo e dei requisiti: [INTRO_AUDIO.md](docs/INTRO_AUDIO.md).

## Impostazioni e dati locali

Gli interruttori mostrano **Attivo/Disattivo** e si azionano con OK. Puoi cambiare ordine e visibilità del menu; **Impostazioni** resta accessibile. **I miei anime** compare con un account MAL attivo o un allineamento pubblico.

Preferiti, cronologia, copertura video, scelte, impostazioni e accesso MAL sono nel LocalStorage della TV, con prefisso `autv.`. Non esiste un account AniPlayer che sincronizzi questi dati tra dispositivi.

**I backup possono contenere token MAL.** Non pubblicare `tools/local-private/`, callback OAuth, certificati `.p12`/`.pfx`, password o copie del profilo utente. I backup, i pacchetti WGT e le principali directory generate sono già esclusi da Git. Una build firmata può essere distribuita separatamente tramite GitHub Releases, se appropriato alla propria distribuzione.

## Problemi comuni

| Problema | Cosa controllare |
| --- | --- |
| Node incompatibile durante `npm ci` | Verifica `node --version` e i requisiti di `package.json`. |
| SDK, `tz.exe` o SDB non trovati | Controlla i percorsi nei requisiti e adatta gli script alla tua installazione. |
| Profilo di firma mancante / installazione non autorizzata | Usa il tuo `-Profile`, verifica certificati e DUID della TV. |
| TV non visibile in SDB | Developer Mode, IP del PC configurato sulla TV, riavvio, IP della TV e comunicazione sulla LAN. |
| Backup fallito alla prima installazione | Solo se non ci sono dati preesistenti, segui il percorso con `-SkipBackup`. |
| Backup in timeout su app già installata | Chiudi altri debugger, ferma l’app e riprova. Conserva il backup precedente; non aggirare la protezione per aggiornare dati importanti. |
| Provider HTTP 403/500 o non raggiungibili | Controlla indicatori in alto e diagnostica. Può essere un errore o una verifica lato provider. |
| Catalogo presente ma nessun video | Serve una corrispondenza AnimeWorld verificata. Controlla rete, versione audio e motore video. |
| Richieste/video bloccati nel browser | CORS e formati supportati possono differire dalla TV. |
| MAL 400 dopo il consenso | Verifica Client ID e Redirect URI, crea una nuova richiesta e usa il callback del suo QR. Prova il percorso telefono/PC. |
| SmartThings tronca il callback | Incollalo nel relay sul telefono anziché sulla TV. |
| Telefono non raggiunge il relay | Processo aperto, IP del PC corretto e porta 8766 consentita dal firewall sulla LAN. |
| Sigla non riconosciuta | Verifica WebCodecs/AAC, AniSkip, HTTP Range e CORS; usa la correzione manuale. |
| Modifiche ai sorgenti non visibili sulla TV | Ricompila e reinstalla il WGT: cambiare `src/` non aggiorna l’app già installata. |

## Sviluppo e struttura

Stack: **Angular 22.2.5**, TypeScript 6, componenti standalone, Signals e SCSS. Non serve un backend per il normale uso; il relay MAL è opzionale e temporaneo.

| Comando | Uso |
| --- | --- |
| `npm ci` | Dipendenze dal lockfile. |
| `npm start` | Server di sviluppo sulla porta 4200. |
| `npm run typecheck` | Controllo TypeScript. |
| `npm test` | Test di struttura, logica, navigazione, MAL, relay e impronte audio. |
| `npm run build` | Build web di produzione. |
| `npm run build:dev` | Build web di sviluppo. |
| `npm run test:all` | Typecheck, test e build web. |
| `npm run tizen:pack` | Build e firma col profilo predefinito. |
| `npm run tizen:deploy -- -TvIp 192.168.1.50` | Deploy con backup dell’app esistente. |
| `npm run mal:relay` | Relay temporaneo per il collegamento MAL. |

```text
src/app/
  app.component.*       Shell, menu e dialogo di uscita
  pages/                Home, catalogo, dettaglio, Esplora, MAL, impostazioni…
  components/           Player, schede, switch, QR e loader
  core/                 Provider, navigazione, player, storage, MAL e analisi audio
  frasi-caricamento.ts  Testi personalizzabili del caricamento
src/assets/             Icone, logo, font e dipendenze statiche
src/styles.scss         Stili globali e overlay
tizen/config.xml       Manifest, identità, privilegi e CSP
tools/                 Packaging, installazione, backup e relay
tests/                 Test automatici Node
docs/                  Approfondimenti tecnici
```

In VS Code verifica `.vscode/settings.json`: il percorso del progetto Tizen deve corrispondere al tuo checkout.

I test automatici non sostituiscono prove hardware. Dopo modifiche al player o alla navigazione verifica sulla TV video/audio, focus, timeline, ripresa, standby, MAL e aggiornamento con conservazione dei dati.

## Crediti e servizi utilizzati

Grazie ai progetti e ai servizi su cui si appoggia AniPlayer:

| Servizio | Utilizzo in AniPlayer |
| --- | --- |
| [AnimeUnity](https://www.animeunity.co/) | Catalogo, ricerca, copertine, informazioni sugli anime e ultimi episodi. |
| [AnimeWorld](https://www.animeworld.ac/) | Ricerca delle corrispondenze, elenco episodi e sorgenti per la riproduzione. |
| [AniSkip](https://aniskip.com/) | Intervalli delle sigle iniziali e finali, usati insieme alle verifiche di durata e al riconoscimento locale. |
| [MyAnimeList](https://myanimelist.net/) | Lista personale, progressi, statistiche e aggiornamento dei visti tramite API e autorizzazione OAuth. |
| [AniList](https://anilist.co/) | Date di uscita recuperate tramite API per migliorare l’ordinamento del catalogo. |

AniPlayer è un progetto indipendente, non affiliato, approvato o sponsorizzato dai servizi elencati. Nomi, marchi, copertine e contenuti appartengono ai rispettivi titolari. La disponibilità delle integrazioni dipende dai servizi esterni.

### Codice e librerie

- [ani-cli-it](https://github.com/nicolagalassi/ani-cli-it): riferimento per il flusso di acquisizione AnimeWorld, come descritto in [THIRD_PARTY.md](THIRD_PARTY.md); licenza inclusa in [LICENSE.ani-cli-it](LICENSE.ani-cli-it).
- [Angular](https://angular.dev/): framework dell’applicazione.
- [QRCode.js](https://github.com/davidshimjs/qrcodejs), di David Shim e Kazuhiko Arase: generazione dei QR per il collegamento MAL; [licenza inclusa](src/assets/vendor/LICENSE.qrcodejs).

Per i riconoscimenti e le licenze del codice incluso o derivato consulta [THIRD_PARTY.md](THIRD_PARTY.md).

## Disclaimer: copyright e uso consentito

AniPlayer è un client indipendente che interagisce con servizi di terze parti. Il repository non include né ospita i file video riprodotti. La presenza di un’integrazione, di un collegamento o di un risultato di ricerca **non certifica che il contenuto sia distribuito con il consenso dei titolari dei diritti**.

Il software deve essere utilizzato esclusivamente per accedere a contenuti la cui fruizione sia autorizzata e consentita dalla normativa applicabile e dalle condizioni dei servizi interessati. Non è consentito utilizzare il progetto per violare diritti d’autore, eludere protezioni o accedere senza autorizzazione a contenuti o servizi. La disponibilità gratuita di un contenuto su Internet non equivale a un’autorizzazione al suo utilizzo.

Gli autori non concedono diritti sui contenuti di terzi e non garantiscono la legittimità, la disponibilità o l’accuratezza delle fonti esterne. Gli utenti devono verificare di avere le autorizzazioni necessarie. Questa indicazione non esclude eventuali responsabilità degli autori o dei distributori previste dalla legge.

Nomi, marchi, immagini e opere appartengono ai rispettivi titolari. Per segnalare una possibile violazione relativa a materiale presente nel repository, apri una segnalazione indicando il materiale interessato e i riferimenti utili, senza pubblicare dati personali o credenziali.

**Questo disclaimer non costituisce consulenza legale, non rende leciti usi non autorizzati e non sostituisce una valutazione delle effettive funzioni e modalità di distribuzione del progetto.**

## Contributi e licenze

Per segnalare un problema indica modello e firmware TV, schermata, passi per riprodurlo, risultato atteso e messaggio di errore. Per problemi video aggiungi versione audio, numero episodio e motore usato. Evita token, callback, password e backup personali.

Per una modifica esegui `npm run test:all` e descrivi le verifiche effettuate, distinguendo test automatici, browser e TV reale.

Riconoscimenti e licenze delle componenti incluse o derivate: [THIRD_PARTY.md](THIRD_PARTY.md) e [LICENSE.ani-cli-it](LICENSE.ani-cli-it). Al momento manca un file `LICENSE` generale del progetto: pubblicare il repository non assegna automaticamente una licenza ai sorgenti e agli asset; prima di redistribuirli verifica le rispettive condizioni.

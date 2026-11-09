# Revisione grafica Samsung S90F (CSS/Tizen)

Questa versione corregge la Home estremamente piccola, la sidebar senza layout e le copertine enormi
viste sulla TV. La build Angular ottimizzata poteva differire il CSS con `media=print` e
un attributo `onload` inline, che viene bloccato dalla CSP della web app Tizen.

Correzioni:
- `optimization.styles.inlineCritical=false` in produzione, senza cambiare la CSP degli script.
- CSS completo incorporato in `tizen/index.html` durante il packaging, con controllo del WGT.
- Viewport TV impostato a 1920 px, come la precedente app funzionante.
- Deploy: stop dell'app prima di backup, installazione e restore; non disattivare il backup.

**Per usare la correzione, ricompilare sempre il WGT**: il vecchio pacchetto installato non cambia modificando solo i sorgenti.

```powershell
npm install
npm run typecheck
npm test
npm run tizen:pack
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\deploy-tizen.ps1 -TvIp 192.168.1.84
```

Prima del deploy archiviare separatamente il backup `tools/local-private/` della versione precedente.
Se l'app è già installata, eseguire `sdb shell 0 kill tOIM55JMUl` se il backup incontra ancora timeout.

**Stato verifiche:** i test statici controllano la configurazione e gli script; nessuna compilazione Angular o prova TV eseguita qui.

---

# AniPlayer Angular 22 — Samsung Tizen S90F

**Stato: anteprima tecnica / migrazione in corso, non release verificata sulla TV.**

Versione Angular: **22.2.5** (ultima stabile verificata l'8 novembre 2026). TypeScript 6.0, SCSS, componenti standalone e servizi DI.

## Che cosa c'è

- Un'app Angular con **11 pagine standalone distinte** (`src/app/pages/`), ciascuna con `*.page.ts`, `*.page.html` e `*.page.scss`; player e schede sono componenti riutilizzabili. Nessuna dipendenza da `js/main.js`.
- Home e catalogo da AnimeUnity, ricerca con filtri, dati dei dettagli e titoli collegati.
- Ricerca corrispondenze AnimeWorld per ID MAL/AniList quando disponibili, sorgenti MP4 HTTPS, scelta della lingua audio se abbinata.
- Player con Samsung AVPlay e fallback HTML5; pausa/play, seek ±30s, timeline con anteprima da telecomando, resume, successivo e avanzamento video.
- Telecomando Samsung: frecce, OK, Return, tasti Play/Pausa, Stop, avanti/indietro; focus spaziale.
- Preferiti, cronologia, episodi visti e dati persistenti nelle chiavi `autv.*`.
- AniSkip v2, verifica della durata, riconoscimento AAC/FFT per confronto tra episodi, impronte audio persistenti, preanalisi dei preferiti e fallback manuale (richiede WebCodecs/HTTP Range per il riconoscimento audio).
- MyAnimeList: OAuth PKCE, configurazione Client ID, callback, sincronizzazione lista, aggiornamenti progressivi senza voti. **Non collaudato con account reale in questa versione.**
- Script PowerShell per build Tizen, firma col profilo `SamsungS90F`, installazione SDB e backup/ripristino LocalStorage via CDP.

## Cosa NON è ancora equivalente all'app originale

I moduli AniSkip, lettura MP4, riconoscimento AAC/FFT e preanalisi dei preferiti sono stati portati in servizi Angular e verificati con test sintetici, ma **non sono ancora stati provati su MP4 reali della Samsung S90F**. Non risultano ancora portati o verificati integralmente: laboratorio VixCloud, diagnostica estesa, gestione avanzata degli episodi/range e tutte le correzioni MAL dell'app originale. Il CSS e i loghi sono adattati allo stile originale, ma **non è stato verificato che siano pixel-identici**. La compatibilità reale AVPlay, il focus su S90F, l'OAuth MAL e la build Angular richiedono test reali. **Non sostituire l'app originale prima di averli conclusi.**

## Requisiti PC Windows

- Node.js compatibile con Angular 22: `^22.22.3` o `^24.15.0` o `^26.0.0` (seguire anche angular.dev/reference/versions).
- npm e strumenti Samsung Tizen SDK con Samsung TV Extension.
- Profilo certificati Tizen `SamsungS90F`, già usato per firmare il progetto originale.
- Samsung S90F con Developer Mode e SDB raggiungibile in rete.

## Sviluppo browser

```powershell
npm install
npm run typecheck
npm test
npm start
```

Nel browser viene usato `<video>` HTML5. L'accesso ai provider reali dipende da rete e CORS. Nessun video fittizio viene mostrato come funzionante.

## Generare il pacchetto Samsung

```powershell
npm run tizen:pack
```

Lo script `tools/build-tizen.ps1` esegue controlli, build Angular, copia gli asset compilati in `tizen/`, compila e firma tramite `tz.exe` e genera `Release/AnimePlayer.wgt`.

Se lavori manualmente:

```powershell
./tools/build-tizen.ps1 -Profile SamsungS90F
```

Il certificato non è incluso nell'archivio. Usa lo stesso certificato e Application ID dell'installazione originale per mantenere aggiornabilità e dati.

## Installare sulla TV

Collega PC e TV, attiva Developer Mode sulla Samsung, controlla che SDB la veda, poi:

```powershell
./tools/deploy-tizen.ps1 -TvIp 192.168.1.84 -Port 26101
```

L'IP è soltanto il valore predefinito dell'installazione originale: sostituiscilo con quello attuale. Per compilare e installare in una sola operazione:

```powershell
./tools/deploy-tizen.ps1 -TvIp 192.168.1.84 -Build
```

Il deploy salva e ripristina le sole chiavi `autv.*` via debugger. Se il backup non riesce, si interrompe prima dell'installazione. Il file `tools/local-private/tv-userdata.json` contiene **anche gli eventuali token MAL**: è escluso da Git e va mantenuto privato. L'operazione è da verificare sul modello S90F prima dell'uso su dati importanti.

## Struttura

```
src/app/
  app.component.{ts,html}               shell, sidebar, outlet per pagina
  pages/home/                           home.page.{ts,html,scss}
  pages/catalog/                        catalog.page.{ts,html,scss}
  pages/anime-detail/                   anime-detail.page.{ts,html,scss}
  pages/related/                        related.page.{ts,html,scss}
  pages/favorites/                      favorites.page.{ts,html,scss}
  pages/history/                        history.page.{ts,html,scss}
  pages/settings/                       settings.page.{ts,html,scss}
  pages/mal/                            mal.page.{ts,html,scss}
  pages/diagnostics/                    diagnostics.page.{ts,html,scss}
  core/app-facade.service.ts            caricamento e stato condiviso tra pagine
  core/page-base.ts                     binding comune, navigazione e azioni condivise
  components/anime-card.component.ts    scheda anime
  components/player.component.*        controlli e overlay video
  core/catalog.service.ts              AnimeUnity
  core/animeworld.service.ts            AnimeWorld
  core/playback.service.ts             AVPlay/HTML5 e progressi
  core/remote.service.ts               telecomando e focus
  core/intro.service.ts                AniSkip v2, correzioni, stato disponibilità
  core/mp4-duration.ts                 durata video MP4 via Range
  core/audio-fingerprint.ts            parser audio AAC, FFT, matching, inferenza
  core/intro-detector.service.ts       consenso episodi, impronte, cache
  core/intro-prefetch.service.ts       preanalisi favoriti e cancellazione
  core/storage.service.ts              LocalStorage compatibile
  core/mal.service.ts                  OAuth MAL e sincronizzazione
  core/navigation.service.ts           navigazione
  core/tizen.service.ts                device API
src/styles.scss                         stile
src/assets/images                      icone e logo
src/index.html                          entry point

tizen/config.xml                        identità Tizen conservata
tools/build-tizen.ps1                   packaging + firma
tools/deploy-tizen.ps1                  SDB + aggiornamento
tools/tv-storage.mjs                    salvataggio dati privati
```

## Test essenziali sulla S90F prima della sostituzione

1. Su ogni pagina naviga con tutte le frecce; OK apre e Return torna senza perdere il focus.
2. Avvia Naruto DUB episodio 7 via AnimeWorld e verifica video, audio, durata, pause, seek e chiusura.
3. Con video pulito, OK mostra i comandi; Return li nasconde; Return di nuovo chiude il player.
4. Apri la timeline: frecce mostrano l'anteprima, OK esegue il seek, Return annulla.
5. Lascia il video 10 secondi, chiudi e riapri per verificare resume e cronologia; prova stop e standby TV.
6. Verifica i video SUB con sottotitoli, il percorso MAL OAuth sul browser Samsung e la sincronizzazione.
7. Verifica l'installazione di aggiornamento senza perdita di preferiti, token e cronologia.

I test Node inclusi controllano contratti e struttura, **non sostituiscono test hardware o una vera build Angular**.

## Correzione dipendenze (rev. 2)

Lo ZIP precedente ometteva `@angular/forms`: questa revisione lo include in `package.json` (22.2.5), con un test che verifica la dipendenza. Su un checkout precedente eseguire `npm install @angular/forms@22.2.5 --save-exact`. Per Angular 22.2.5 occorre Node >=22.22.3 (serie 22), >=24.15.0 (serie 24) oppure >=26.

## Revisione modulare 3 — fix WGT e pagine

- Ogni pagina ha un componente Angular standalone, template HTML e foglio SCSS dedicati. Le azioni di ricerca/filtri del catalogo, episodi del dettaglio, impostazioni, MAL e diagnostica sono dentro i relativi file TypeScript.
- `app.component` ora gestisce solo shell, menu, errori globali e il componente player; `AppFacadeService` coordina le chiamate dei provider, lo stato e la navigazione condivisa.
- La navigazione torna a selezionare un elemento del contenuto **dopo** il termine dei caricamenti asincroni, evitando di anticipare il focus mentre la pagina non è ancora pronta.
- `tools/build-tizen.ps1` ora riconosce `tizen/Release/tizen.wgt` (il nome effettivo mostrato dall'SDK), verifica che il WGT contenga `index.html`, `config.xml` e le firme, e lo copia come `Release/AnimePlayer.wgt`. Se vengono prodotti più WGT interrompe l'esecuzione per non distribuire quello sbagliato.
- Questo cambio non altera l'Application ID originale (`tOIM55JMUl.AnimePlayer`) né il profilo di firma (`SamsungS90F`).
- 11 test strutturali passati; controllo TypeScript eseguito con stub di tipi Angular. Non è stato possibile eseguire `ng build` in questo ambiente per mancato accesso al registro npm. Sul PC dell'utente la versione precedente aveva già superato `ng build`, ma **la nuova versione richiede un nuovo collaudo locale**.

### Compilazione e installazione revisione 3

```powershell
npm install
npm run typecheck
npm test
npm run tizen:pack
# Verifica il file Release/AnimePlayer.wgt prima del deploy
./tools/deploy-tizen.ps1 -TvIp <INDIRIZZO_IP_DELLA_TV>
```

**Per conservare la grafica attuale**, le regole esistenti sono inizialmente rimaste in `src/styles.scss`, mentre ogni pagina possiede un proprio file SCSS per gli interventi futuri. L'esatta equivalenza visiva rispetto alla vecchia app non è certificata.


## Revisione video/loader/Home

- Video AVPlay: quando il player è aperto, `html` e `body` diventano trasparenti
  e la shell Angular viene nascosta per consentire al piano video nativo di
  apparire dietro i controlli. **Da verificare sulla S90F** (audio/timeline
  funzionavano, schermo nero sulla build precedente).
- Home: banner hero ripristinato, usando il primo anime in evidenza
  oppure il primo anime del catalogo come fallback.
- Telecomando: quando non esiste un pulsante più in alto nella pagina,
  la freccia Su scorre fino all'inizio per mostrare anche il contenuto
  non focalizzabile, senza saltare verso la sidebar.
- Caricamento: componente `AnimeLoaderComponent` riproduce il loader
  shuriken/stellina con scintille dell'originale. Frasi originali in
  **`src/app/frasi-caricamento.ts`**; modificabili come semplice elenco,
  cambio ogni **5 secondi** durante il caricamento.
- Backup: `tools/tv-storage.mjs` usa l'Application ID completo
  `tOIM55JMUl.AnimePlayer` per l'avvio CDP.

I moduli avanzati di riconoscimento audio, impronte e preanalisi sono stati **implementati** come sorgenti Angular, ma il loro funzionamento con WebCodecs e server Range deve essere collaudato sulla TV. Consultare `docs/INTRO_AUDIO.md`.
Prima dell'installazione, conservare il backup `tools/local-private/tv-userdata.json`
(se presente) fuori dalla cartella progetto e non condividere i token MAL.


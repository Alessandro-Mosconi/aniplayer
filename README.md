# AniPlayer

<img src="src/assets/images/aniplayer-icon-512.png" alt="Icona AniPlayer" width="110" />

AniPlayer è un’app per Smart TV per esplorare anime, guardare episodi e tenere traccia dei progressi. È pensata per il telecomando e si adatta anche a computer e telefoni.

Il catalogo usa AnimeUnity, mentre gli episodi vengono cercati su AnimeWorld. Il collegamento a MyAnimeList è facoltativo.

![Home di AniPlayer su una TV simulata](docs/screenshots/home-tv.png)

*Home su TV simulata a 1920×1080.*

Dal menu apri **Catalogo**; per **Esplora** attiva prima la funzione in **Impostazioni → Catalogo**. **I miei anime** compare dopo l’importazione di una lista pubblica o il collegamento MyAnimeList.

| Catalogo | Esplora | I miei anime |
| --- | --- | --- |
| ![Ricerca e filtri del catalogo](docs/screenshots/catalog-tv.png) | ![Esplora un anime alla volta](docs/screenshots/explore-tv.png) | ![Dashboard con statistiche dimostrative](docs/screenshots/dashboard-tv.png) |

[Guarda tutte le schermate](docs/SCHERMATE.md), comprese quelle di [profili e avatar](docs/SCHERMATE.md#profili), impostazioni, preferiti e cronologia. I dati personali mostrati sono dimostrativi.

## Installa sulla tua Smart TV

Scegli il sistema operativo della TV nelle impostazioni del dispositivo. PC e TV devono essere sulla stessa rete per l’installazione tramite rete. I pacchetti, se disponibili, si trovano nelle **Releases** del repository; altrimenti vanno compilati dai sorgenti.

### Samsung · Tizen

La versione di riferimento richiede **Tizen 9.0 o superiore**. Servono un PC Windows, il Samsung TV SDK e un certificato autorizzato per la propria TV.

1. Attiva **Developer Mode** sulla TV e crea un profilo di firma Samsung. [Preparazione di TV e certificati](docs/GUIDA.md#preparare-tv-e-certificati).
2. Compila il pacchetto WGT con il tuo profilo e installalo sulla TV. Per la prima installazione segui la [guida Samsung passo per passo](docs/GUIDA.md#samsung-tizen).
3. Per gli aggiornamenti usa lo stesso certificato e conserva i dati con il backup. [Aggiornamento e ripristino](docs/GUIDA.md#aggiornamento-con-conservazione-dei-dati).

Per la TV già configurata in questo progetto, `npm run dist` installa il pacchetto disponibile, eseguendo prima il backup. Per ricompilarlo prima dell’invio usa `npm run dist -- -Build`. Lo script usa come valori predefiniti l’IP `192.168.1.103` e il profilo `SamsungS90F`; per altre TV consulta la guida.

### LG · webOS

Installa l’app **Developer Mode** sulla TV, attivala e configura la CLI LG sul PC. Poi installa il pacchetto `.ipk` e avvia AniPlayer. [Guida LG passo per passo](docs/GUIDA.md#lg-webos).

Per un gestore di repository webOS compatibile, aggiungi `https://alessandro-mosconi.github.io/aniplayer/repo.json`: il repository offre l'ultima release stabile e il relativo IPK. La disponibilità degli aggiornamenti dipende dal gestore installato sulla TV.

Se dopo l’installazione l’icona non apre l’app, riavvia la TV e riprova.

### Android TV e Google TV

Su Android 8 o superiore, trasferisci `AniPlayer-AndroidTV-debug.apk` sulla TV, aprilo con un gestore file e autorizza l’installazione se richiesta. È possibile installarlo anche con ADB. [Guida Android TV](docs/GUIDA.md#android-tv-e-google-tv).

### Amazon Fire TV · Fire OS

Per Fire OS basato su Android API 26 o superiore, usa lo stesso APK Android e installalo tramite ADB, se il dispositivo consente il sideload. [Guida Fire TV](docs/GUIDA.md#amazon-fire-tv-con-fire-os).

**Compatibilità:** Samsung S90F è il dispositivo di riferimento. Le versioni LG, Android TV e Fire OS sono sperimentali e vanno provate sul proprio dispositivo. Non sono disponibili pacchetti nativi verificati per Vega OS, VIDAA o Roku; Apple TV è esclusa. [Stato delle piattaforme](docs/MULTIPLATFORM.md).

## Prova su PC o telefono

Installa una versione di Node.js compatibile con `package.json`, apri un terminale nella cartella del progetto ed esegui:

```bash
npm ci
npm start
```

Sul PC apri **http://localhost:4200**. Per provare dal telefono collegato alla stessa rete, apri `http://IP_DEL_PC:4200` e lascia acceso il server sul PC. Il server di sviluppo include un proxy per le richieste ai servizi; alcuni video potrebbero comunque essere limitati dal browser.

Su Android puoi anche installare l’APK sperimentale usato per Android TV. [Istruzioni per telefono e PiP](docs/GUIDA.md#prova-su-telefono) · [Avvio e verifiche su PC](docs/GUIDA.md#avvio-sul-pc).

## Come si usa

- **Telecomando:** usa le frecce per spostarti, **OK** per scegliere e **Return** per tornare indietro. Premi OK su un campo per scrivere.
- **Home:** «Scopri gli anime» propone una selezione casuale da più parti del catalogo, privilegiando serie diverse e riducendo le ripetizioni tra un mescolamento e l'altro. Usa **Mescola** per cambiarla o **Vedi tutti** per aprire il catalogo con lo stesso ordinamento casuale: la striscia mostra una selezione diversificata di quel catalogo.
- **Catalogo:** cerca per titolo o scegli filtri, generi e voto minimo, poi premi **Applica filtri**. Puoi ordinare per titolo, uscita dell’anime, popolarità o valutazione, anche in modo casuale. **Ultimi episodi** mostra invece gli anime presenti negli aggiornamenti di AnimeUnity, dal più recente. Nelle impostazioni puoi abilitare l’esclusione dei generi: premi OK su un genere per passare tra incluso, escluso e neutro.
- **Esplora:** la funzione è sperimentale e disattivata per impostazione predefinita; puoi abilitarla nelle impostazioni. Mostra un anime alla volta: sulla scheda usa sinistra/destra per esprimere una preferenza, su per i preferiti, giù per saltare e OK per i dettagli. Return torna alla schermata precedente. Su telefono puoi fare swipe sulla copertina.
- **Player:** riprendi gli episodi e, quando disponibili, salta riassunto, sigla iniziale o finale. Dopo un salto hai cinque secondi per annullarlo. I pulsanti `SUB`/`ITA` cambiano versione audio quando disponibili.
- **Impostazioni:** scegli una categoria per gestire menu, catalogo, badge, riproduzione, MyAnimeList e dati salvati. In **Badge** puoi scegliere gli indicatori da mostrare: sono tutti attivi inizialmente, tranne AniSkip.

[Guida completa all’uso e al telecomando](docs/GUIDA.md#telecomando-e-navigazione) · [Come funzionano i salti](docs/GUIDA.md#salta-riassunti-e-sigle).

## MyAnimeList

Le due funzioni sono indipendenti:

1. **Visti da username:** in **Impostazioni → MyAnimeList → Allinea i visti · Senza login** inserisci uno username con lista pubblica. AniPlayer importa i progressi e mostra **I miei anime**, senza modificare la lista MAL.
2. **Aggiornamento automatico:** in **Impostazioni → MyAnimeList → Collega account MAL** collega l’account e autorizza AniPlayer. Potrai inviare i progressi a MAL, mettere in pausa gli aggiornamenti o disconnetterti.

Per il collegamento tramite telefono e PC, avvia `npm run mal:relay` sul PC e segui le istruzioni mostrate sulla TV. [Procedura completa e problemi comuni](docs/GUIDA.md#myanimelist).

## Per chi sviluppa

| Comando | Cosa fa |
| --- | --- |
| `npm run test:all` | Controlla TypeScript, esegue i test e compila il sito. |
| `npm run build:all` | Genera i pacchetti Samsung, LG, Android/Fire OS e browser; richiede gli SDK e la firma Samsung. |
| `npm run dist` | Installa sulla Samsung configurata, con backup e ripristino dei dati. |
| `npm run mal:relay` | Avvia temporaneamente il collegamento MAL tramite telefono. |

Guide: [installazione, backup e risoluzione problemi](docs/GUIDA.md) · [piattaforme](docs/MULTIPLATFORM.md) · [login MAL](docs/MAL_LOGIN.md) · [algoritmo dei salti e metadati](docs/ALGORITMO_SALTI.md) · [riconoscimento audio](docs/INTRO_AUDIO.md) · [aggiornare gli screenshot](docs/screenshots/README.md).

Il repository webOS viene pubblicato su GitHub Pages dal workflow `Pubblica repository webOS`. Nelle impostazioni del repository, configura Pages con sorgente **GitHub Actions**, quindi avvia il workflow manualmente per la prima pubblicazione. Prima di pubblicare ogni release stabile `vX.Y.Z`, allega l'IPK `org.aniplayer.tv_X.Y.Z_all.ipk` alla bozza: il workflow calcola il suo SHA-256 e collega il download della release. Se manca il pacchetto, la pubblicazione fallisce lasciando online la versione precedente; dopo averlo aggiunto, riesegui il workflow manualmente. Le prerelease non vengono offerte.

## Crediti e utilizzo

AniPlayer usa [AnimeUnity](https://animeunity.cx/) per il catalogo, [AnimeWorld](https://www.animeworld.ac/) per gli episodi, [AniSkip](https://aniskip.com/) per gli intervalli di salto, [MyAnimeList](https://myanimelist.net/) per liste e progressi e [AniList](https://anilist.co/) per date e copertine. Grazie anche ad [ani-cli-it](https://github.com/nicolagalassi/ani-cli-it), [Angular](https://angular.dev/) e [QRCode.js](https://github.com/davidshimjs/qrcodejs). [Crediti e licenze delle componenti](THIRD_PARTY.md).

AniPlayer è un progetto indipendente: non ospita video e non è affiliato ai servizi elencati. Usa l’app solo per contenuti e servizi ai quali hai diritto di accedere. Nomi, immagini e opere appartengono ai rispettivi titolari. [Disclaimer completo](docs/GUIDA.md#disclaimer-copyright-e-uso-consentito).

Il progetto non ha ancora una licenza generale; consulta [THIRD_PARTY.md](THIRD_PARTY.md) per le componenti incluse e derivate.



### Profili locali

All'avvio viene riaperto l'ultimo profilo usato; il pulsante con avatar nel menu permette di creare,
rinominare, eliminare o cambiare profilo. L'eliminazione richiede conferma e deve
rimanere almeno un profilo; se elimini quello attivo, l'app passa a un altro.
I nomi sono univoci (anche ignorando maiuscole e
spazi ripetuti). Ogni profilo ha preferiti, Continua a guardare, episodi visti,
impostazioni, scelte Esplora e account/lista MyAnimeList separati. I dati già
presenti rimangono nel profilo iniziale, senza copie o cancellazioni.
Per i profili, TinyTools propone nomi casuali come `CrispyBird`: l'app rimuove i separatori, evita nomi duplicati e usa un generatore locale se il servizio non risponde. Puoi generare il nome con il pulsante nel campo, scegliere **Avatar casuale** o **Personaggio casuale**, oppure usare **Nome e avatar casuali**.
Il cambio profilo ricarica l'app per reinizializzare servizi e account; le
operazioni ancora in corso restano legate al profilo di origine.

Preanalisi, fingerprint, rilevamenti e cache delle sigle restano condivisi.
I profili sono salvati sul dispositivo: non sono account cloud.

In Home, **Continua a guardare** esclude gli anime di cui è stato completato l'ultimo episodio disponibile; la cronologia li conserva. Dal dettaglio puoi rimuovere un titolo solo dalla striscia oppure dalla cronologia. In **Impostazioni → Dati e rete** puoi sospendere il salvataggio della cronologia per il profilo attivo. [Come funziona la cronologia](docs/GUIDA.md#cronologia-e-continua-a-guardare).

Gli avatar usano l'API SVG DiceBear: il selettore carica tutti gli stili da
`https://api.dicebear.com/10.x` e mostra quattro anteprime per stile. **Esplora**
apre la galleria dello stile, con 50 varianti iniziali e caricamenti progressivi
fino a 240. La stellina salva gli stili preferiti per profilo; il filtro **Preferiti**
li raccoglie. Il catalogo viene
salvato localmente; se non disponibile, viene usata una lista di riserva.
Le generazioni sono distanziate di almeno 1,2 secondi. Si salvano stile, versione
e seed, senza legare l'immagine al nome del profilo. Gli avatar DiceBear precedenti
usano l'API 9.x; gli avatar locali originali restano compatibili. In caso di errore
immagine viene mostrato un avatar locale, senza cambiare la scelta salvata.

La scheda **Personaggi anime** usa AniList per cercare serie e scegliere i personaggi come immagini profilo. Le serie sono raggruppate per franchise, ordinabili e salvabili tra le preferite; **Esplora** mostra fino a 25 personaggi iniziali e consente di caricarne altri. Dal dettaglio di un anime, **Avatar** apre i personaggi disponibili per il profilo attivo. Le immagini sono ritagliate in formato quadrato; la ricerca e le immagini richiedono Internet e i risultati sono conservati temporaneamente nella cache locale.

L'API pubblica non richiede chiavi, ammette 50 richieste/secondo per SVG ed e'
gratuita per uso non commerciale. Per uso commerciale o limiti superiori DiceBear
richiede un'istanza propria. Disponibilita', limiti e disegni possono cambiare.
Vedi https://www.dicebear.com/integrations/http-api/ e le licenze dei singoli stili,
raggiungibili dal selettore. Non sono incluse librerie DiceBear nel bundle.

[Guida ai profili](docs/GUIDA.md#profili) · [Schermate dei profili](docs/SCHERMATE.md#profili).

## Pubblicare una release su GitHub

La versione dell'app è quella di `package.json` ed è visibile in fondo alle impostazioni. Per preparare una release, dalla cartella del progetto:

```bash
npm version patch --no-git-tag-version
# In alternativa: npm version minor --no-git-tag-version o npm version major --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin HEAD
git push origin vX.Y.Z
```

Sostituisci `X.Y.Z` con la versione effettivamente scritta da npm. La versione attuale è una prerelease: `npm version patch` la porta alla versione stabile corrispondente; per incrementare una prerelease usa `npm version prerelease --no-git-tag-version`. Il tag deve corrispondere esattamente alla versione, incluso l'eventuale suffisso.

Il tag avvia GitHub Actions: esegue verifiche e build e crea una **bozza** nella pagina Releases con `AniPlayer-web.zip` e note generate automaticamente. Controlla il risultato e le note, allega eventualmente i pacchetti TV prodotti e verificati seguendo le guide, quindi pubblica la bozza. La build web è un insieme di file statici e può richiedere una configurazione server/proxy per accedere ai servizi; non è un pacchetto TV. I pacchetti Tizen richiedono SDK e firma Samsung; l'APK generato dagli script attuali è una build debug e webOS richiede la CLI LG. Le versioni nei manifest nativi sono separate e vanno aggiornate prima di compilare quei pacchetti; per Android incrementa anche `versionCode` a ogni aggiornamento.

# Salti: riconoscimento, allineamento e metadati

Questo documento descrive il comportamento implementato, non garantisce che una sigla sia riconosciuta su ogni dispositivo o episodio. I tempi sono espressi in **secondi**. L'app conserva localmente i metadati tecnici dei salti, condivisi tra i profili della stessa installazione; preferiti e impostazioni appartengono invece al profilo attivo.

## Tipi di salto e provenienza

| Tipo | Chiave nell'esportazione | Possibili fonti |
| --- | --- | --- |
| Riassunto | `riassunto` | AniSkip, AniSkip allineato alla sigla iniziale, correzione manuale |
| Intro narrativa o altro inizio | `intro_narrativa` | Intervallo manuale |
| Sigla iniziale | `sigla_iniziale` | AniSkip, audio, impronta audio, correzione manuale |
| Sigla finale | `sigla_finale` | AniSkip, AniSkip allineato, audio, impronta audio, correzione manuale |

Una proposta AniSkip indica un intervallo riferito a una versione dell'episodio: non prova che corrisponda alla versione del video riprodotto. Il riconoscimento audio cerca invece una corrispondenza tra tracce audio; non identifica il nome di una canzone e può risultare inconcludente.

Nel player `A` indica AniSkip, `A?` una proposta, `AUD` il confronto audio, `A+AUD` un risultato audio che usa la durata AniSkip o un intervallo AniSkip allineato tramite audio, `✎` una correzione manuale e `!` un conflitto. Nel popup la sezione **Nel video** distingue la verifica in corso, l'intervallo riconosciuto, la ricerca senza corrispondenze e il dato non verificato. Una ricerca incompleta o non disponibile non dimostra che la sigla non esista.

## Sigla iniziale

All'apertura dell'episodio, quando la durata del video è nota:

1. Una correzione manuale valida ha precedenza. Se la sigla è stata disattivata per quell'episodio, il relativo salto non viene proposto. Una correzione viene controllata rispetto alla durata del file.
2. Se il riconoscimento è attivo e c'è un risultato audio salvato valido per la stessa versione video e con durata compatibile entro due secondi, il player lo riutilizza senza ricalcolarlo.
3. L'app consulta AniSkip. Un candidato la cui durata dell'episodio differisce di oltre tre secondi, oppure per cui ci sono candidati discordanti, richiede verifica; un risultato compatibile può essere usato subito. Il player può mostrare anche una proposta provvisoria mentre sono disponibili solo i dati del servizio.
4. Se il riconoscimento audio è attivo e supportato, e non è già stata applicata una correzione o una verifica salvata, parte il confronto anche se AniSkip colloca la sigla nei primi secondi. Il pulsante AniSkip utilizzabile resta disponibile durante il confronto.
5. Con una posizione candidata o un'impronta disponibile, la ricerca comincia attorno al riferimento con un margine di 30 secondi, poi passa a 120 secondi e infine alla ricerca estesa. In assenza di un riferimento parte direttamente dalla ricerca estesa. Il ripiego copre i primi 480 secondi; un riferimento che finisce oltre questa finestra conserva una finestra attorno alla sua posizione. Il confronto può essere annullato e nel player ha un limite di 120 secondi.
6. Il risultato verificato sostituisce la proposta. Se la ricerca non trova una corrispondenza o si interrompe, l'app non inventa una nuova posizione: resta disponibile l'eventuale proposta AniSkip valida. Un fallimento di rete, decoder o timeout non è una prova che la sigla sia assente.

I dati tecnici del rilevamento e le eventuali correzioni sono identificati anche per serie, versione audio ed episodio. Cambi di durata, sorgente o versione audio possono rendere non utilizzabile un risultato precedente.

## Come funziona il confronto audio

L'app legge parti dell'audio AAC nel file MP4 con richieste HTTP Range; non scarica intenzionalmente l'intero episodio. Sono necessari supporto WebCodecs `AudioDecoder`/`EncodedAudioChunk`, AAC compatibile e risposte della sorgente utilizzabili tramite Range e CORS. Ogni lettura ha un limite di 32 MiB e una finestra massima di 480 secondi.

L'analisi costruisce descrittori spettrali su 24 bande ogni 0,25 secondi. Se è disponibile una durata utilizzabile da AniSkip, prova una corrispondenza di quella durata; il valore non rende automaticamente corretta la posizione AniSkip. Senza una durata disponibile cerca un segmento ripetuto di circa 45–150 secondi. I controlli valutano qualità, copertura, contrasto temporale e corrispondenze alternative; un jingle corto o un picco ambiguo non bastano.

Per stabilire una nuova corrispondenza servono in genere **due episodi di riferimento diversi e concordi**, scelti tra un massimo di quattro episodi vicini. Se esiste già un'impronta valida di un'altra puntata della stessa serie e versione audio, l'app può usarla per riconoscere l'episodio corrente senza dover ottenere due nuovi confronti. Deve comunque leggere e analizzare audio dell'episodio corrente: il tempo dipende da dispositivo, rete e finestra cercata.

Quando si riconosce una nuova sigla ripetuta, può essere salvata una nuova impronta; se cambia sigla, la vecchia può non corrispondere e la ricerca torna a confrontare altri episodi. Non è assicurato il riconoscimento quando mancano riferimenti concordi, la durata suggerita non è adatta o la sorgente non è leggibile. Le impronte iniziali sono limitate alle ultime 12 in totale, non 12 per serie; quelle più vecchie possono essere rimosse.

## Riassunto e sigla finale: offset e conflitti

Se la sigla iniziale è stata riconosciuta con audio, AniSkip contiene una sigla iniziale di durata compatibile e i riferimenti appartengono a un'edizione coerente, l'app può calcolare:

```text
offset = inizio sigla iniziale nel video − inizio sigla iniziale AniSkip
```

Esempio: AniSkip `02:02`, audio `01:51` → offset `−11 s`. L'app può applicare lo stesso spostamento agli intervalli AniSkip del riassunto e della sigla finale. Il popup dell'iniziale mostra la **differenza rilevata**; per gli altri intervalli può mostrare l'**offset applicato**. Una differenza rilevata non garantisce che sia applicabile a ogni altra parte del video.

L'allineamento verifica compatibilità delle durate, edizioni candidate, limiti del video e intervalli ragionevoli. Sospende il salto interessato in caso di conflitti, per esempio riferimenti discordanti o riassunto sovrapposto alla sigla riconosciuta. Una finale che termina appena oltre il file può essere limitata alla durata effettiva nei casi previsti dal controllo. Le scene successive alla fine dell'intervallo restano riproducibili.

Per la **finale**, una correzione manuale valida ha precedenza; segue una finale riconosciuta dall'audio e salvata, poi l'eventuale intervallo AniSkip compatibile o allineato. Se non c'è una sigla iniziale riconosciuta, AniSkip può comunque fornire una finale compatibile senza offset. La presenza di una finale AniSkip utilizzabile impedisce attualmente di avviare la sua analisi audio automatica: la finale AniSkip non è quindi sempre verificata o ritarata.

Se manca una finale utilizzabile, durante la riproduzione l'analisi può partire negli ultimi sette minuti, per video più lunghi di tre minuti. Richiede che il riconoscimento sia attivo, supportato e che la versione AnimeWorld sia identificabile; ha un limite di 90 secondi. Cerca prima eventuali impronte valide, poi confronta fino a quattro episodi vicini, normalmente negli ultimi cinque minuti. Se il confronto tra episodi non raggiunge il consenso, non crea una finale verificata. L'analisi audio non è in grado di distinguere con certezza eventuali scene dopo i titoli di coda.

## Uso dei pulsanti

Quando più intervalli sono attivi, il player controlla nell'ordine riassunto, intro narrativa, sigla iniziale, finale. La sigla iniziale può essere proposta fino a cinque secondi prima del suo inizio; per gli altri salti l'intervallo deve essere iniziato. Il salto va alla fine dell'intervallo; non accredita come guardata la parte saltata. Se la finale arriva al termine del file e c'è un episodio successivo, può avviare il passaggio successivo secondo la logica del player. Il comando **Annulla salto** resta disponibile per circa tre secondi.

## Preanalisi dei preferiti

La preanalisi della sigla iniziale è attiva per default, se sono abilitati sia il riconoscimento sia la preanalisi. Lavora sui preferiti del profilo attivo, un episodio alla volta, dando precedenza a quelli non visti e alternando le serie. Si sospende quando il player è aperto, l'app va in background o la funzione viene disattivata. Non continua ad app chiusa e non apre video nascosti.

Controlla periodicamente le puntate disponibili, circa ogni 30 minuti; gli errori dei singoli lavori possono essere riprovati dopo sei ore, con comando manuale nelle impostazioni. I risultati negativi preparati hanno una durata di sette giorni per la preanalisi. Quando un titolo viene rimosso dai preferiti, non vengono pianificati nuovi lavori per quel titolo; i risultati audio e le impronte già salvati separatamente non sono cancellati automaticamente. Una serie segnata come preferita non garantisce che ogni episodio sia stato analizzato o riconosciuto.

## Esportazione dei metadati

Da **Impostazioni → Dati e rete → Esporta metadati**, l'app prepara `aniplayer-metadati.json`. Un QR apre sul telefono il ricevitore Decimen; la TV trasmette poi il file con una sequenza di QR animati. La barra sulla TV rappresenta la prima sequenza mostrata, non i dati effettivamente letti: la ricezione e l'eventuale tempo stimato sono visibili sul telefono. La TV non riceve una conferma automatica e continua a trasmettere fino alla chiusura manuale.

Il file è un JSON UTF-8 con questa struttura semplificata:

```json
{
  "formato": "aniplayer-metadati",
  "versione": 2,
  "esportato_il": "2026-11-15T11:00:00.000Z",
  "unita_tempi": "secondi",
  "serie": [
    {
      "identita": {
        "id": 123,
        "mal_id": 456,
        "anilist_id": 789,
        "titolo": "Nome anime",
        "slug": "nome-anime",
        "audio": "sub"
      },
      "episodi": [
        {
          "numero": "5",
          "id": "ep-5",
          "durata_secondi": 1440,
          "salti": {
            "sigla_iniziale": {
              "aniskip": [
                { "inizio": 122, "fine": 212, "durata_episodio": 1451, "aggiornato": 1760000000000 }
              ],
              "calcolato": {
                "inizio": 111,
                "fine": 201,
                "origine": "audio_con_durata_aniskip",
                "metodo": "episodes",
                "aggiornato": 1760000001000
              },
              "stato_calcolo": "trovato"
            },
            "sigla_finale": {
              "aniskip": [
                { "inizio": 1311, "fine": 1401, "durata_episodio": 1451, "aggiornato": 1760000000000 }
              ],
              "allineamento": {
                "inizio": 1300,
                "fine": 1390,
                "origine": "aniskip_allineato_audio",
                "offset_secondi": -11,
                "nota": "Ricalcolato dai dati disponibili al momento dell’esportazione."
              }
            }
          }
        }
      ]
    }
  ],
  "dati_originali": {
    "introDetections": {},
    "introPrepared": {},
    "introFingerprints": {},
    "introPrefetch": {},
    "introCorrections": {},
    "angularIntroCorrections": {},
    "skipSegments": {},
    "skipTimesCache": {},
    "aniskipAvailability": {},
    "endingDetections": {},
    "endingFingerprints": {}
  }
}
```

`serie` è una vista leggibile ricostruita dai dati disponibili: i campi possono mancare. La chiave `aniskip` è una lista perché possono esserci più candidati; una proposta non indica necessariamente l'intervallo effettivamente usato. `calcolato.origine` vale `audio` oppure `audio_con_durata_aniskip`; `metodo` può indicare il confronto tra episodi o un'impronta. `manuale` può contenere `inizio`, `fine`, `disattivato` e `aggiornato`. `allineamento` è **ricalcolato al momento dell'esportazione** quando esistono dati sufficienti: non certifica che quell'intervallo sia stato usato durante una riproduzione precedente. I timestamp `aggiornato` sono millisecondi Unix; `esportato_il` è una data ISO 8601.

L'indice raggruppa le versioni note per slug e audio e può contenere anche dati identificati solo tramite MAL. Non tutti i dati esistenti sono associabili con certezza: l'export non scarica né analizza tutti gli episodi al momento dell'operazione e non inventa ciò che manca. `dati_originali` conserva le raccolte complete presenti al momento dell'esportazione, comprese le impronte, i candidati in cache e i record che la vista leggibile non riesce ad associare; account e cronologia non sono inclusi. Il ripristino/importazione di questo file nell'app non è ancora implementato.

## Codice di riferimento

- [playback.service.ts](../src/app/core/playback.service.ts): priorità, pulsanti, analisi a runtime e salti.
- [intro.service.ts](../src/app/core/intro.service.ts): AniSkip, correzioni e segmenti manuali.
- [intro-detector.service.ts](../src/app/core/intro-detector.service.ts) e [audio-fingerprint.ts](../src/app/core/audio-fingerprint.ts): ricerca e impronte audio.
- [ending-detector.service.ts](../src/app/core/ending-detector.service.ts) e [skip-alignment.ts](../src/app/core/skip-alignment.ts): finale e allineamento.
- [intro-prefetch.service.ts](../src/app/core/intro-prefetch.service.ts): preanalisi dei preferiti.
- [metadata-export.ts](../src/app/core/metadata-export.ts) e [optical-backup.ts](../src/app/core/optical-backup.ts): indice leggibile e raccolte originali esportate.

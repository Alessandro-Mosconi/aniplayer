# Riconoscimento intro e preanalisi — AniPlayer Angular

Per una descrizione completa delle priorità, dei salti, dell'offset e del formato JSON esportato, vedi [ALGORITMO_SALTI.md](ALGORITMO_SALTI.md).

## Flusso a runtime

1. Episodio aperto: verifica correzione `autv.introCorrections` con chiave che contiene MAL ID, provider, slug, audio e numero episodio. Se disabilitato, non viene proposto alcuno skip.
2. Se esiste un riconoscimento audio in `autv.introDetections` / `autv.introPrepared` con durata compatibile (±2 s), usa il risultato direttamente.
3. Chiede AniSkip v2 con `episodeLength`, usando l'eventuale intervallo per ricavare **la lunghezza della sigla**, non presumendo che l'offset sia identico nel video AnimeWorld. Candidati discordanti o differenza di durata >3 s sono soltanto suggerimenti da rivedere.
4. Se il riconoscimento è attivo e `AudioDecoder` WebCodecs e AAC-LC sono supportati, legge la traccia audio MP4 tramite HTTP Range (fino a 32 MiB e 480 s per episodio), calcola impronte FFT a intervalli di 250 ms su 24 bande spettrali e confronta fino a 4 episodi vicini. Parte anche per una proposta AniSkip all'inizio del video. Cerca inizialmente entro 30 secondi dalla proposta, poi allarga a 120 secondi e infine ai primi otto minuti; per un riferimento più tardo conserva una finestra attorno a quel riferimento.
5. Con impronta locale preesistente valida può riconoscere la sigla anche da una singola impronta; senza, servono **almeno due episodi diversi che concordino** sull'offset (entro 6 s e, nell'inferenza, sulla fine entro 8 s).
6. Se è disponibile la durata AniSkip, il matcher richiede correlazione media ≥0,60, frame validi ≥90%, frame con score ≥0,50 almeno 80%, distinzione temporale ≥0,12; respinge picchi alternativi troppo vicini. Senza AniSkip cerca segmenti ripetuti di 45–150 secondi con le stesse verifiche conservative.
7. Memorizza risultati verificati e, se la cache può essere scritta, impronte compresse in `autv.introFingerprints`, formato v3 (max 12 modelli). Cache rilevamenti max 200, cache preparati max 250.
8. La proposta AniSkip resta utilizzabile mentre l'analisi è in corso e rimane disponibile se il confronto non conferma la sigla. Il player ne segnala la provenienza (`A` o `A?`); usa `AUD` per il riconoscimento audio e `A+AUD` quando l'audio verifica una durata AniSkip. Il pulsante **manuale** «Avanza di …» usa solo la durata suggerita quando manca un intervallo utilizzabile.

## Preanalisi dei preferiti

- Attiva di default, disabilitabile nelle Impostazioni. Non avvia mai un video nascosto: consulta soltanto metadati e HTTP Range.
- Un solo job per volta, avviato quando la TV è visibile e il player non è aperto; abort immediato quando il player si apre o la TV passa in background.
- Analizza prima gli episodi non visti, controlla nuove puntate circa ogni 30 minuti, riprova gli errori dopo 6 ore. Timeout di 120 s per lavoro. Cache negativa di 7 giorni.
- Le serie si associano via slug audio verificato e/o ID MAL/AniList; versioni SUB e DUB non vengono mescolate.
- Se la TV non espone AudioDecoder o il CDN blocca Range/CORS, la preanalisi mostra il motivo e non scarica episodi interi.

## Esportazione sul telefono

In **Impostazioni → Dati e rete → Esporta metadati**, apri il ricevitore Decimen sul telefono scansionando il QR iniziale, avvia la fotocamera e poi scegli **Mostra metadati** sulla TV. Inquadra il codice animato fino al completamento indicato sul telefono e scarica il file JSON. La barra sulla TV indica solo la prima sequenza trasmessa: il progresso di ricezione e la stima del tempo sono sul telefono. Il file elenca per serie ed episodio gli intervalli AniSkip, audio, manuali e gli eventuali allineamenti ricostruibili; `dati_originali` conserva anche le raccolte originali e le impronte. I dati non disponibili non vengono inventati. L'esportazione non include account o cronologia. L'importazione non è ancora disponibile nell'app.

Il protocollo QR usa codice MIT di [Decimen Optical Transfer](https://github.com/tongatron/decimen-optical-transfer); la licenza originale è in `src/app/core/optical/LICENSE.txt`.

## Cosa è cambiato

- Recupero delle risposte HTTP Range multiple con verifica puntuale del `Content-Range` e fallback su intervalli singoli limitati; prima della decodifica si verifica che tutti i byte necessari siano presenti.
- I fallimenti temporanei di rete o CORS **non** diventano un `not-found` permanente.
- Durante il prefetch le statistiche leggono le cache dal LocalStorage una volta per aggiornamento, anziché rileggere gli stessi JSON per ogni episodio.
- Riconoscimento e prefetch sono modulari: `audio-fingerprint.ts`, `mp4-duration.ts`, `intro.service.ts`, `intro-detector.service.ts`, `intro-prefetch.service.ts`.

## Test

`npm test` verifica gli invarianti del progetto e test spettrali sintetici (due episodi concordi, audio non simile, segmento ripetuto 60 s, jingle breve escluso). `npm run typecheck` esegue il controllo TypeScript reale con le dipendenze Angular installate.

**Restano indispensabili test di integrazione reali sulla Samsung S90F:** AVPlay con immagine/audio; supporto WebCodecs AAC; CDN con 206 multipart o fallback singolo; impronte riutilizzate dopo riavvio; sospensione del prefetch mentre si guarda; tasti direzionali e input nel catalogo. I test sintetici non certificano i file video e la TV.

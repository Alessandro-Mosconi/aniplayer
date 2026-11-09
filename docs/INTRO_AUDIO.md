# Riconoscimento intro e preanalisi — AniPlayer Angular

## Flusso a runtime

1. Episodio aperto: verifica correzione `autv.introCorrections` con chiave che contiene MAL ID, provider, slug, audio e numero episodio. Se disabilitato, non viene proposto alcuno skip.
2. Se esiste un riconoscimento audio in `autv.introDetections` / `autv.introPrepared` con durata compatibile (±2 s), usa il risultato direttamente.
3. Chiede AniSkip v2 con `episodeLength`, usando l'eventuale intervallo per ricavare **la lunghezza della sigla**, non presumendo che l'offset sia identico nel video AnimeWorld. Candidati discordanti o differenza di durata >3 s sono soltanto suggerimenti da rivedere.
4. Se `AudioDecoder` WebCodecs e AAC-LC sono supportati, legge la traccia audio MP4 tramite HTTP Range (fino a 32 MiB e 360 s per episodio), calcola impronte FFT a intervalli di 250 ms su 24 bande spettrali e confronta fino a 4 episodi vicini.
5. Con impronta locale preesistente valida può riconoscere la sigla anche da una singola impronta; senza, servono **almeno due episodi diversi che concordino** sull'offset (entro 6 s e, nell'inferenza, sulla fine entro 8 s).
6. Se è disponibile la durata AniSkip, il matcher richiede correlazione media ≥0,60, frame validi ≥90%, frame con score ≥0,50 almeno 80%, distinzione temporale ≥0,12; respinge picchi alternativi troppo vicini. Senza AniSkip cerca segmenti ripetuti di 45–150 secondi con le stesse verifiche conservative.
7. Memorizza risultati verificati e, se la cache può essere scritta, impronte compresse in `autv.introFingerprints`, formato v3 (max 12 modelli). Cache rilevamenti max 200, cache preparati max 250.
8. Se nessuna analisi conferma la sigla, non abilita il pulsante automatico. Il pulsante **manuale** «Avanza di …» usa esclusivamente la durata suggerita da AniSkip ed è etichettato come non verificato.

## Preanalisi dei preferiti

- Attiva di default, disabilitabile nelle Impostazioni. Non avvia mai un video nascosto: consulta soltanto metadati e HTTP Range.
- Un solo job per volta, avviato quando la TV è visibile e il player non è aperto; abort immediato quando il player si apre o la TV passa in background.
- Analizza prima gli episodi non visti, controlla nuove puntate circa ogni 30 minuti, riprova gli errori dopo 6 ore. Timeout di 120 s per lavoro. Cache negativa di 7 giorni.
- Le serie si associano via slug audio verificato e/o ID MAL/AniList; versioni SUB e DUB non vengono mescolate.
- Se la TV non espone AudioDecoder o il CDN blocca Range/CORS, la preanalisi mostra il motivo e non scarica episodi interi.

## Cosa è cambiato

- Recupero delle risposte HTTP Range multiple con verifica puntuale del `Content-Range` e fallback su intervalli singoli limitati; prima della decodifica si verifica che tutti i byte necessari siano presenti.
- I fallimenti temporanei di rete o CORS **non** diventano un `not-found` permanente.
- Durante il prefetch le statistiche leggono le cache dal LocalStorage una volta per aggiornamento, anziché rileggere gli stessi JSON per ogni episodio.
- Riconoscimento e prefetch sono modulari: `audio-fingerprint.ts`, `mp4-duration.ts`, `intro.service.ts`, `intro-detector.service.ts`, `intro-prefetch.service.ts`.

## Test

`npm test` verifica gli invarianti del progetto e test spettrali sintetici (due episodi concordi, audio non simile, segmento ripetuto 60 s, jingle breve escluso). `npm run typecheck` esegue il controllo TypeScript reale con le dipendenze Angular installate.

**Restano indispensabili test di integrazione reali sulla Samsung S90F:** AVPlay con immagine/audio; supporto WebCodecs AAC; CDN con 206 multipart o fallback singolo; impronte riutilizzate dopo riavvio; sospensione del prefetch mentre si guarda; tasti direzionali e input nel catalogo. I test sintetici non certificano i file video e la TV.

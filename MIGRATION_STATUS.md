# Stato migrazione AniPlayer Angular — 8 novembre 2026

## Revisione: riconoscimento intro e telecomando

Il modulo originale è stato **portato funzionalmente** in servizi TypeScript Angular, conservando il modello FFT e i formati dati di LocalStorage. **Non è ancora una migrazione con equivalenza confermata sulla Samsung S90F**: mancano test di riproduzione e analisi AAC con MP4 reali sul dispositivo.

- **AniSkip v2**: query per episodio/durata, ricerche senza filtro, verifica intervalli discordanti e cambio durata, badge con probe on-demand.
- **AAC/FFT**: lettura MP4 con HTTP Range singoli e multipli, parsing AAC, AudioDecoder WebCodecs, FFT a 24 bande/2048 punti e finestre 0,25 s, normalizzazione per guadagno.
- **Decisioni prudenti**: verifiche 90% copertura valida, 80% match sopra 0,50, correlazione media almeno 0,60, contrasto temporale, verifica tra due episodi; inferenza 45–150 s senza AniSkip, confronto con impronte audio persistenti.
- **Cache originale**: `autv.introCorrections`, `autv.aniskipAvailability`, `autv.introDetections`, `autv.introPrepared`, `autv.introFingerprints` e `autv.introPrefetch`, formato versione 3.
- **Preanalisi preferiti**: un lavoro alla volta, checkpoint di cancellazione e interruzione mentre il player è aperto/TV in background; limite 120 s per lavoro; errori con retry 6 ore; cache dei negativi per 7 giorni.
- **Player**: ordine correzione locale → rilevamento già verificato → nuova analisi; fallback AniSkip di durata solamente manuale quando non verificato, disattivazione episodio e correzione.
- **UI**: selettore versioni SUB ITA/DUB ITA *solo se disponibili e verificate*, trama con focus/scroll da telecomando, uscita dal search input verso filtri, ripristino corretto del focus dopo ricerca, «Vedi tutti» in Home, AVPlay `<object>` non più permanentemente nascosto.

### Limiti di verifica e disponibilità

- Test audio sintetici e test strutturali superati, analisi su MP4 reali Samsung **non eseguita**.
- Il decoding FFT richiede AudioDecoder/EncodedAudioChunk WebCodecs e server MP4 con `206 Partial Content`, CORS e codec AAC-LC. Se il sistema non li offre, nessun tentativo di analisi finge un risultato; resta AniSkip con verifiche di durata e correzioni locali.
- Un browser può supportare AVPlay ma non WebCodecs AAC. Non è garantita la disponibilità sulla S90F.
- Il lato dati, MAL e diagnostica dell'app Angular NON sono ancora certificati come identici in ogni dettaglio all'originale.
- Non disponibile localmente il registry npm per eseguire `ng build`. Il pacchetto va compilato e firmato sul PC Windows.
- Non alterare/cancellare `tools/local-private/tv-userdata.json` del backup precedente.

Consulta `docs/INTRO_AUDIO.md` per i dettagli su algoritmo, cache, criteri di qualità e prove sulla TV.

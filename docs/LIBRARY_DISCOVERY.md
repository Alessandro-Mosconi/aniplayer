# Dashboard, lista personale e scoperta

## I miei anime

La voce compare quando è collegato l'account MAL oppure è configurato l'allineamento da username. La disconnessione dell'unico account autenticato la nasconde; l'allineamento pubblico resta indipendente. Se le due fonti sono entrambe attive, si sceglie quale profilo visualizzare: le liste non vengono unite.

La dashboard mostra anime iniziati, completati, in corso, episodi visti, media dei voti assegnati agli anime guardati, distribuzione degli stati e generi più presenti tra i titoli iniziati. Il tempo è stimato moltiplicando i progressi MAL per la durata media disponibile; viene dichiarato quanti episodi hanno una durata nota. Non rappresenta il tempo effettivamente trascorso nel player.

La mia lista usa titoli, copertine, formati, generi e date importati da MAL. Supporta ricerca anche nei titoli alternativi, stato, formato, selezione multipla dei generi, progressi e ordine. Ricerca e filtri operano sull'intera lista; vengono visualizzati 30 elementi per pagina. Stato dei filtri e pagina vengono conservati tornando dai dettagli.

Le vecchie importazioni prive di titoli vengono aggiornate all'apertura della dashboard. Una lista esplicitamente eliminata rimane vuota fino a un aggiornamento richiesto dall'utente. L'apertura del dettaglio cerca un abbinamento nel catalogo tramite ID MAL; non viene inventato uno slug né aperta automaticamente una serie che coincide solo nel titolo.

## Filtri del catalogo

- **Visti:** Tutti, Mai visti, Con episodi da vedere. I progressi combinano la fonte MAL selezionata e gli episodi locali, senza contare due volte quelli già compresi nel progresso MAL. Un episodio locale fuori ordine conta come un episodio visto, non come tutti quelli precedenti. Con episodi da vedere richiede un totale noto superiore agli episodi già visti e include anche serie non iniziate con episodi disponibili.
- **Esplorati:** Tutti, Già esplorati, Mi piace, Non mi interessa, Mai esplorati. Le liste positive già salvate vengono filtrate localmente, senza scansionare il catalogo remoto.
- **Uscita:** più recenti o più antichi. AnimeUnity espone anno e stagione, non una data completa per ogni titolo. L'ordine raggruppa correttamente tutti i risultati per anno e stagione, con titolo come spareggio; non ordina soltanto i 30 elementi della pagina corrente. Vedi tutti da Ultimi episodi apre il catalogo con Uscita · Più recenti.
- **Casuale:** costruisce una sequenza casuale stabile di pagine e titoli, senza duplicati dovuti al cambio pagina. Rimescola o una nuova ricerca cambiano il seed. Il filtro SUB viene applicato alle pagine miste per evitare di dover scorrere tutto il catalogo prima del primo risultato casuale.

I filtri locali che richiedono la scansione remota mostrano un conteggio progressivo, senza dichiararlo come totale esatto. Se una passata non riempie la pagina, Continua ricerca riprende dalla posizione raggiunta e non salta i risultati intermedi.

## Esplora

Esplora mostra copertina grande, titolo, trama, generi, tipo e anno. Si può aprire dal menu, dalla Home o usando i filtri correnti del catalogo. Dal menu propone normalmente anime mai visti e mai esplorati in ordine casuale.

Con il focus sulla scheda:

- Sinistra: Non mi interessa e passa al successivo.
- Destra: Mi piace e passa al successivo.
- Su: aggiunge o rimuove il preferito, mantenendo la scheda.
- Giù: salta al successivo.
- OK: apre i dettagli.
- Return: torna alla schermata precedente.

La presentazione della scheda registra il titolo come esplorato; Salta resta una scelta neutra. Un Mi piace non aggiunge automaticamente ai preferiti. Le varianti audio con lo stesso ID MAL condividono una sola scelta. Le reazioni sono salvate in `autv.explored` sulla TV e non modificano MAL.

Home mostra gli ultimi esplorati con la scelta salvata. La dashboard include conteggi e collegamenti alle scelte locali, separati dalle statistiche del profilo MAL. Nelle impostazioni si possono eliminare le scelte di esplorazione; preferiti, cronologia e account restano indipendenti.

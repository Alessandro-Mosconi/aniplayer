# Login MyAnimeList

## Due funzioni separate

**Visti da username · Senza login** legge la lista pubblica tramite l'API ufficiale e il Client ID pubblico incluso nell'app. L'utente inserisce solo lo username: non servono login, QR, callback o token utente. Il pulsante Allinea i visti importa i progressi in `autv.malPublicData`; episodi e cronologia locali restano separati. La lista MAL deve essere pubblica. Cambiare username sostituisce la lista pubblica solo dopo un'importazione completa riuscita. Rimuovere questo allineamento non scollega l'account OAuth e non cancella i visti locali.

**Aggiorna MAL automaticamente** usa il collegamento OAuth per inviare gli episodi guardati da AniPlayer e lo stato watching/completed. Il collegamento esistente viene mantenuto negli aggiornamenti dell'app; è possibile mettere in pausa gli invii senza scollegare l'account. Scollegare OAuth non rimuove l'allineamento da username. Le impostazioni tecniche e i metodi alternativi di collegamento sono raccolti dietro Altri metodi e configurazione.

La coda `autv.malOutbox` può essere nulla dopo il collegamento oppure avere il formato della vecchia app con accountId/events: entrambi vengono gestiti. Una coda del vecchio formato appartenente a un altro account non viene inviata. Un errore di importazione successivo all'accesso non annulla il collegamento riuscito.

## Disconnessione, riconnessione e cancellazione

- **Disconnetti · Ricorda account** interrompe le richieste automatiche e conserva l'accesso salvato e il nome dell'account sulla TV, anche dopo la chiusura dell'app. Non revoca l'autorizzazione su MAL e non elimina le liste scaricate.
- **Riconnetti** verifica l'accesso salvato, rinnova il token se necessario e riprende il collegamento senza QR o callback quando MAL permette ancora il rinnovo. Se l'autorizzazione è scaduta o revocata, si usa Autorizza di nuovo.
- **Elimina tutti i dati MAL scaricati** cancella le due copie importate, autenticata e pubblica, conservando account e username. La lista autenticata non si riscarica automaticamente finché non si richiede un aggiornamento o una riconnessione. Le operazioni in corso non possono ripristinare una lista appena eliminata.
- **Elimina aggiornamenti in attesa** svuota solo la coda degli invii locali. Un aggiornamento già inviato a MAL non può essere annullato da questo pulsante.
- **Dimentica account e autorizzazione** elimina token, lista autenticata e aggiornamenti in attesa sulla TV. Il successivo collegamento richiede OAuth. Non elimina la lista pubblica separata, la cronologia o i visti locali e non modifica la lista sul sito MAL.

La sezione username offre anche Elimina dati scaricati da username, che mantiene lo username pronto per un nuovo allineamento, e Dimentica username, che rimuove l'associazione pubblica.

AniPlayer è un client pubblico: registrazione MAL di tipo `other`, OAuth Authorization Code con PKCE `plain`, senza Client Secret nell'app.

Riferimento ufficiale: https://myanimelist.net/apiconfig/references/authorization

## Diagnosi del 400

Il login al sito e il consenso OAuth sono passaggi distinti. Il 400 su `/submission/authorization` dopo Allow indica che MAL non ha completato l'autorizzazione. Da solo non identifica il parametro rifiutato e non dimostra un problema del browser Samsung, del CAPTCHA o del tipo di applicazione.

Il QR permette di provare lo stesso flusso sul telefono. Non trasferisce automaticamente il risultato alla TV.

## Prova con ritorno manuale locale

1. Nella configurazione dell'app MAL aggiungere, su una nuova riga, `http://127.0.0.1:8765/callback`. Conservare anche il redirect precedente e salvare. Il tipo resta `other`.
2. Su AniPlayer premere **Ho registrato l'URL locale · Mostra nuovo QR**. Il pulsante imposta il redirect locale e genera una nuova richiesta con PKCE e state salvati sulla TV.
3. Scansionare il nuovo QR e autorizzare. Non riutilizzare una vecchia scheda o un vecchio QR.
4. Se MAL emette il callback, il browser tenta di aprire l'indirizzo locale con `code` e `state`. Non viene avviato alcun server: una pagina di connessione non riuscita a quell'indirizzo è prevista. Copiare l'indirizzo completo dalla barra e incollarlo nel campo callback di AniPlayer, anche usando la tastiera remota del telefono se disponibile.
5. Premere **Completa il collegamento** entro 15 minuti. La TV verifica protocollo, host, porta, percorso e state prima di scambiare il codice su HTTPS. Il callback non deve essere pubblicato o incluso nei report.

Questa è una prova alternativa, non una soluzione già verificata con l'account reale. Se il 400 resta su MAL prima del redirect, non c'è ancora un callback da incollare. Se invece appare un errore durante lo scambio token sulla TV, quello è un passaggio diverso da diagnosticare.

Il ritorno HTTP locale serve solo a rendere visibile il callback: nessuna richiesta API o token viene inviata in HTTP. Non è un server condiviso tra telefono e TV.

## SmartThings taglia il testo: trasferimento tramite PC

Il relay opzionale evita di inserire il callback usando la tastiera TV. Sul PC avviare `npm run mal:relay` e lasciare aperto il processo. Nella pagina MAL di AniPlayer inserire l'indirizzo LAN del PC mostrato dal comando, quindi premere **Collega tramite PC**. Il Redirect URI deve essere quello già registrato su MAL: per la prova manuale usare `http://127.0.0.1:8765/callback`.

Il nuovo QR apre una pagina del PC sul telefono. Da lì aprire MAL, autorizzare, copiare l'indirizzo di ritorno e incollarlo nella pagina del PC, poi premere **Invia alla TV**. La TV riceve il callback e completa lo scambio. Telefono, PC e TV devono raggiungersi sulla rete locale; il firewall deve consentire al processo Node l'accesso sulla rete privata.

Il relay mantiene le richieste solo in memoria per 15 minuti, usa indirizzi casuali distinti per telefono e TV e controlla il callback rispetto alla richiesta. I token MAL sono scambiati e conservati dalla TV. Il relay trasporta l'URL di autorizzazione (che include il challenge PKCE plain) e il callback, senza scriverli nei log o su disco. Fermare il processo al termine del collegamento. Il traffico LAN del relay usa HTTP; le richieste MAL restano HTTPS. Il client TV ammette soltanto indirizzi locali o privati per il relay.

## App di tipo web

La configurazione attuale non usa un Client Secret e non implementa un backend riservato. Passare a `web` richiederebbe adattare l'architettura e gestire il segreto sul server; non è una correzione dimostrata per questo 400. Non inserire il Client Secret nei file Angular, nel widget TV o nella chat.

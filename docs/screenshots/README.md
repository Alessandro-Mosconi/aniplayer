# Screenshot del README

Le immagini sono catture dell’app nel browser con schermo TV simulato webOS a **1920×1080**. Non sono prove su una TV fisica. Preferiti, cronologia e dati MAL sono dimostrativi; non servono credenziali o account personali.

## Aggiornare le immagini

1. Installa le dipendenze con `npm ci` se necessario.
2. Avvia l’app con `npm start` dalla radice del progetto e lascia aperto il terminale.
3. In un secondo terminale, sempre dalla radice, esegui:

   ```sh
   node tools/capture-screenshots.mjs
   ```

4. Controlla le immagini in questa cartella e il README prima di pubblicare. Lo script sostituisce i file esistenti mantenendo gli stessi nomi e collegamenti.

Per aggiornare solo scelta profili, modifica, conferma di eliminazione, catalogo avatar, personaggi anime e relative gallerie, imposta `ANIPLAYER_SCREENSHOTS=profiles` prima di lanciare lo script. Le schermate usano tre profili dimostrativi e non accedono ai dati salvati sulla TV.

Serve Google Chrome. Su Windows viene cercato nel percorso standard; per un altro percorso imposta `CHROME_PATH`. Se il server usa una porta diversa da 4200, imposta `ANIPLAYER_SCREENSHOT_URL`.

Esempio PowerShell:

```powershell
$env:ANIPLAYER_SCREENSHOT_URL = 'http://127.0.0.1:4217'
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:ANIPLAYER_SCREENSHOTS = 'profiles' # facoltativo: solo schermate dei profili
node tools/capture-screenshots.mjs
```

Lo script usa un profilo Chrome isolato e dati dimostrativi; non legge il browser abituale né i backup della TV. Esplora viene attivata solo per la cattura. Per le schermate dei profili servono le immagini DiceBear; per i personaggi anime serve AniList e per le altre schermate servono anche i provider del catalogo. Se una risorsa non risponde, la schermata può mostrare gli avvisi o le immagini di riserva dell'app. Ricontrolla sempre la resa visiva: la simulazione non sostituisce una prova su TV fisica.

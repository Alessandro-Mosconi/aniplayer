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

Serve Google Chrome. Su Windows viene cercato nel percorso standard; per un altro percorso imposta `CHROME_PATH`. Se il server usa una porta diversa da 4200, imposta `ANIPLAYER_SCREENSHOT_URL`.

Esempio PowerShell:

```powershell
$env:ANIPLAYER_SCREENSHOT_URL = 'http://127.0.0.1:4217'
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node tools/capture-screenshots.mjs
```

Lo script apre un profilo Chrome isolato, naviga nell’app e inserisce dati dimostrativi solo nella sessione di cattura. Non legge il profilo del browser abituale né i backup della TV. Il catalogo e le immagini richiedono una connessione ai provider; se il caricamento fallisce lo script si interrompe. Ricontrolla sempre la resa visiva, perché contenuti e layout possono cambiare.

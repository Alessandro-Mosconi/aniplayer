# Riconoscimenti e licenze

La logica di acquisizione AnimeWorld di AniPlayer è basata sul flusso studiato nel progetto [ani-cli-it](https://github.com/nicolagalassi/ani-cli-it), distribuito con licenza GNU GPL-3.0. La copia della licenza è nel file `LICENSE.ani-cli-it`.

Angular: MIT (https://github.com/angular/angular/blob/main/LICENSE).

QRCode.js: MIT, David Shim e Kazuhiko Arase (https://github.com/davidshimjs/qrcodejs). Copia locale in `src/assets/vendor/qrcode.js`; licenza in `src/assets/vendor/LICENSE.qrcodejs`. Riutilizzata dal progetto AniPlayer originale.

Gli avatar dei profili sono forniti dall'[API DiceBear](https://www.dicebear.com/). Gli stili appartengono ai rispettivi autori e possono avere licenze diverse: la pagina dello stile nel selettore collega autore e licenza. L'API pubblica ha proprie condizioni d'uso; non sono incluse librerie DiceBear nel bundle.

I suggerimenti di soprannomi usano l'[API TinyTools](https://tinytools.cc/en/api), con un generatore locale di riserva.

I loghi e gli asset inclusi derivano da materiali disponibili nella conversazione dell'utente; le font originarie e i binari del progetto precedente non sono inclusi.

Il contenitore Android include il Gradle Wrapper 8.9, distribuito dal progetto [Gradle](https://github.com/gradle/gradle/tree/v8.9.0) con licenza Apache-2.0. La licenza si trova in `platforms/android/GRADLE-LICENSE`. La CLI LG resta uno strumento di sviluppo esterno e non viene inclusa nel bundle Angular.

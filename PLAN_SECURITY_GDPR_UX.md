# Piano migliorie: GDPR, Sicurezza, UX/UI, Widget

Analisi del 2026-10-18 su `main` (web 5.8.2, android 5.3.2).
Perimetro: informative e trattamento dati, sicurezza, UX/UI web, widget Android e Windows.
Fuori perimetro (va bene com'è): architettura backend su Google Sheets/Drive API.

Legenda priorità: **P0** da fare subito · **P1** prossimo ciclo · **P2** quando c'è tempo.
Effort: S (< 2h) · M (mezza giornata) · L (1-2 giorni).

---

## 0. Cosa viene salvato davvero sul server (inventario dati)

Prima di scrivere l'informativa serve sapere cosa c'è. Oggi il server persiste in `habitikami-web/data/` (volume Docker):

| File | Contenuto | Fonte nel codice |
|------|-----------|------------------|
| `users.json` | email → `spreadsheetId`, `enabled_tabs`, `default_tab`, `temptations` (id, label, icona, colore, categoria: es. "Smoking", "Snacking") | `server.js:26`, `server.js:597-690`, `server.js:755-767` |
| `apikeys.json` | API key **in chiaro** → email, spreadsheetId, `createdAt`, `refreshToken` OAuth cifrato AES-256-GCM | `server.js:28`, `server.js:803-872` |
| `risc-revoked.json` | email → evento di sicurezza Google, timestamp, motivo | `server.js:1495` |
| stdout / log Docker | email in chiaro ad ogni login, refresh, registrazione sheet, generazione API key | `server.js:455`, `server.js:537`, `server.js:590`, `server.js:862-864` |

Dati che **transitano** dal server senza essere salvati:
- contenuto dei fogli (export, contatori, colori) per widget e `/api/export`;
- **conversazioni AI** (diario emozioni, ristrutturazione cognitiva, protocollo anti-panico) verso Anthropic o Google Gemini tramite `/api/anthropic/chat` e `/api/gemini/chat`, con la API key personale dell'utente nel body (`server.js:1413-1490`).

Dati solo lato client (localStorage): access token, **refresh token**, email, spreadsheetId (`habitikami_session_v3`), API key Gemini/Anthropic, preferenze UI.

Terze parti coinvolte: Google (OAuth, Sheets, Drive), Cloudflare Web Analytics (beacon in `index.html:60`), Anthropic e Google Gemini (solo se l'utente attiva l'area AI), GitHub API (controllo aggiornamenti app Android), hosting del server.

> Nota importante: le abitudini tracciate (fumo, umore, panico, schede CBT/ACT) sono **dati relativi alla salute** (art. 9 GDPR, categorie particolari). Restano nel foglio Google dell'utente, ma passano dal server (export/widget/proxy AI) e vengono inviate a fornitori AI extra-UE quando l'utente usa l'area Help. Questo va dichiarato e, per l'area AI, va raccolto un consenso esplicito.

---

## 1. GDPR: conformità delle informative

### 1.1 Verdetto

`PrivacyPolicy.tsx` e `TermsOfService.tsx` **non sono conformi** agli artt. 12-13 GDPR. Non sono "sbagliate" nel tono, ma mancano gli elementi obbligatori e descrivono meno dati di quelli realmente trattati.

### 1.2 Gap rilevati

| # | Gap | Riferimento GDPR | Dove |
|---|-----|------------------|------|
| G1 | Titolare del trattamento non identificato (nome, contatto). "Contact the developer via GitHub or email if provided" non basta. | art. 13(1)(a) | `PrivacyPolicy.tsx:64-68` |
| G2 | Base giuridica assente. "By using Habitikami you agree" non è un consenso valido e non è necessario: la base corretta per email + sheet ID è l'esecuzione del servizio richiesto (art. 6(1)(b)). | art. 13(1)(c) | `PrivacyPolicy.tsx:18-20` |
| G3 | Elenco dati incompleto: mancano preferenze (tab, temptations con etichette), API key e refresh token cifrato, record RISC, log con email, dati in transito (export, AI). | art. 13(1)(c), 5(1)(a) | `PrivacyPolicy.tsx:25-31` |
| G4 | Destinatari non dichiarati: Cloudflare Analytics, Anthropic, Google Gemini, hosting. | art. 13(1)(e) | tutto il file |
| G5 | Trasferimenti extra-UE non dichiarati (Anthropic e Google sono USA; servono garanzie: DPF / SCC). | art. 13(1)(f) | tutto il file |
| G6 | Periodo di conservazione assente. Oggi i dati **non vengono mai cancellati**: nessun endpoint di cancellazione account, `users.json` cresce solo. | art. 13(2)(a), 5(1)(e) | `server.js` (manca route) |
| G7 | Diritti dell'interessato non elencati (accesso, rettifica, cancellazione, portabilità, opposizione, reclamo al Garante). Nessun modo self-service per esercitarli. | art. 13(2)(b)-(d), 15-21 | tutto il file |
| G8 | Dati sanitari (art. 9) non menzionati; nessun consenso esplicito prima di inviare contenuti CBT/anti-panico ai provider AI. | art. 9(2)(a) | `HelpView.tsx`, `SchedeCompiler.tsx` |
| G9 | "Last updated: `new Date()`" mostra sempre la data di oggi: è fuorviante e impedisce di dimostrare quale versione l'utente ha visto. | art. 12(1), 5(2) accountability | `PrivacyPolicy.tsx:13`, `TermsOfService.tsx:13` |
| G10 | Informativa solo in inglese mentre l'app è IT/EN e il pubblico è italiano. | art. 12(1) "linguaggio semplice e chiaro" | nessuna chiave i18n |
| G11 | Dice "exclusively Google Sheets" ma l'app usa anche Drive (cartella `habitikami-worksheets`, documenti delle schede). | art. 5(1)(a) trasparenza | `PrivacyPolicy.tsx:36`, `HabitService.ts:1447-1730` |
| G12 | Storage locale (localStorage con token e API key) e analytics non dichiarati. Nessun banner necessario (storage tecnico + analytics cookieless), ma vanno descritti. | ePrivacy art. 5(3), Linee guida Garante cookie 2021 | `index.html:60`, `HabitService.ts:16` |
| G13 | Privacy/Termini raggiungibili solo dal footer della landing: dopo il login non c'è alcun link. | art. 12(1) facilmente accessibile | `LandingPage.tsx:310-316`, menu in `App.tsx` |

### 1.3 Piano GDPR

**P0 · S · G1, G2, G9, G10** Riscrivere l'informativa come contenuto i18n (IT + EN) con data/versione fissa.
- Spostare i testi in `src/i18n/it.ts` / `en.ts` (o in due file markdown `public/legal/privacy.{it,en}.md` renderizzati con `renderMarkdown.tsx`).
- Costante `PRIVACY_VERSION = '2026-10-xx'` e `Last updated` letto da lì.
- Sezioni obbligatorie (struttura da seguire):
  1. Titolare e contatti (nome, email dedicata, es. privacy@kambei.dev).
  2. Dati trattati, divisi in: (a) account (email, sheet ID, preferenze), (b) credenziali tecniche (API key, refresh token cifrato), (c) dati di sicurezza (RISC), (d) dati in transito (contenuto fogli, conversazioni AI), (e) log tecnici, (f) storage locale del browser, (g) analytics cookieless.
  3. Finalità e base giuridica per ciascun gruppo: servizio richiesto art. 6(1)(b); sicurezza art. 6(1)(f); AI/schede: consenso esplicito art. 9(2)(a) + 6(1)(a); analytics: legittimo interesse 6(1)(f).
  4. Destinatari: Google LLC, Cloudflare Inc., Anthropic PBC e Google (solo area AI, solo su attivazione), fornitore hosting (nome e paese).
  5. Trasferimenti extra-UE e garanzie (Data Privacy Framework / clausole standard; link alle policy dei fornitori).
  6. Conservazione: account finché attivo o fino a cancellazione; API key fino a revoca; RISC 12 mesi; log N giorni (vedi S9); dati in transito non conservati.
  7. Diritti e come esercitarli: sezione "Account e privacy" nell'app + email; diritto di reclamo al Garante (www.garanteprivacy.it).
  8. Revoca accesso Google (link già presente) e cosa succede ai dati dopo.
  9. Minori: servizio non destinato a minori di 14 anni (soglia italiana, art. 2-quinquies Codice Privacy).
  10. Modifiche all'informativa: come vengono comunicate.
- Termini: stessa cosa per la data; aggiungere legge applicabile e foro (Italia), e un richiamo al fatto che l'area AI non è un servizio sanitario né sostituisce un professionista (disclaimer già presente nei prompt? verificarlo e metterlo anche nei Termini).

**P0 · M · G6, G7** Endpoint e UI di cancellazione account + accesso ai propri dati.
- `DELETE /api/user/account` (Bearer, `validateOrigin`, `apiLimiter`): rimuove la voce in `users.json`, tutte le API key dell'utente, la voce in `risc-revoked.json`; revoca il refresh token su `https://oauth2.googleapis.com/revoke`; risponde 204. Non tocca il foglio Google (è dell'utente): dirlo chiaramente nella UI.
- `GET /api/user/me`: restituisce esattamente ciò che il server ha su di te (email, sheet ID, preferenze, se esiste una API key e quando è stata creata). È il "diritto di accesso" self-service.
- UI: nuova sezione **Account e privacy** nelle impostazioni (vedi UX U2) con: dati memorizzati, "Scarica i miei dati" (JSON da `/api/user/me` + `/api/export`), "Elimina account" con conferma in due passi, link a Informativa e Termini, link "Revoca accesso Google".

**P0 · S · G8** Consenso esplicito prima del primo uso dell'area AI / schede.
- Modale al primo click su "Avvia sessione" o su una scheda: spiega che i contenuti possono riguardare la salute, che vengono inviati al provider scelto (nome, paese) tramite il server Habitikami che non li conserva, e che i documenti compilati vengono salvati nel Drive dell'utente.
- Checkbox non preselezionata + pulsante "Accetto e continuo". Salvare `aiConsent: { version, timestamp }` in `users.json` (serve come prova, art. 7(1)) e in localStorage per non richiederlo a ogni dispositivo.
- Ritirabile da "Account e privacy" (cancella le API key AI locali e il flag).

**P1 · S · G3, S9** Minimizzazione: smettere di salvare ciò che non serve.
- `temptations` in `users.json` è un fallback della riga di intestazione del foglio (`server.js:755-767`). Toglierlo: il foglio è già la fonte di verità e contiene etichette sanitarie ("Smoking").
- Log: sostituire l'email nei `console.log` con un hash troncato (`sha256(email).slice(0,8)`) o con il solo esito. Vedi anche S9 per la rotazione.

**P1 · S · G13, G12** Link a Informativa/Termini nel menu utente e nella pagina Help; riga sotto il pulsante di login: "Accedendo accetti i Termini e dichiari di aver letto l'Informativa" (presa d'atto, non consenso).

**P2 · S** Documento interno `docs/REGISTRO_TRATTAMENTI.md` (art. 30: non obbligatorio per un singolo sviluppatore senza trattamenti rischiosi sistematici, ma dieci righe con dati, finalità, destinatari, conservazione e misure di sicurezza rendono tutto difendibile) e `docs/DATA_BREACH.md` (cosa fare entro 72 ore: chi avvisare, come revocare le chiavi).

---

## 2. Sicurezza

Lo stato di partenza è buono per un progetto personale: PKCE + state, verifica firma `id_token`, RISC, refresh token cifrati at rest, rate limiting, helmet, CORS con allowlist, origin check sulle route mutanti, validazione dello spreadsheet ID, receiver Android non esportati, PendingIntent immutabili. I punti sotto sono quelli che restano.

### 2.1 Findings

| # | Pri | Finding | Rischio | Dove |
|---|-----|---------|---------|------|
| S1 | P0 | **Access token Google accettato senza controllo di `aud`.** `getEmailFromToken` chiama `userinfo`, che risponde per qualunque token con scope `email`, anche emesso per un'altra app. Un token rubato a un'altra applicazione dello stesso utente funziona su `/api/user/*`, `/api/export`, `/api/counter/*`, proxy AI. Con `/api/user/apikey` l'attaccante genera una API key persistente. | Token substitution / confused deputy | `server.js:352-360`, usato in `server.js:568`, `611`, `705`, `783`, `808`, `880`, `937`, `1419`, `1455` |
| S2 | P0 | **Refresh token e access token in `localStorage`**, con CSP disabilitata. Qualunque XSS (anche da una dipendenza) ruba una credenziale a lunga vita. Le API key AI dell'utente sono nello stesso posto. | Account takeover persistente | `HabitService.ts:16,242`, `server.js:234-242`, `aiProvider.ts:8-9` |
| S3 | P0 | **API key widget salvate in chiaro** in `apikeys.json`. Chi legge il volume `data/` (backup, host compromesso) ha tutte le chiavi utilizzabili. | Furto massivo chiavi | `server.js:156-166`, `server.js:913-923` |
| S4 | P1 | Nome del parametro `counter` in `/api/counter/increment` non validato: finisce nell'intestazione del foglio. Un valore con `\|` o prefisso `_config` corrompe la codifica delle temptations/preferenze. Inoltre `String.fromCharCode(65 + idx)` rompe oltre la colonna Z. | Corruzione dati via widget/API key | `server.js:1319-1385` |
| S5 | P1 | Segreto OAuth in una variabile `VITE_*`. Vite inlinea tutte le `VITE_*` se il bundle referenzia `import.meta.env` intero; il Dockerfile oggi non passa il segreto al build, ma `.env.example` e il README invitano a metterlo nello stesso `.env` usato da `npm run build` in locale. | Leak segreto nel bundle (build locali) | `.env.example:4`, `server.js:177,406`, `Dockerfile:12-15` |
| S6 | P1 | Nessun `.dockerignore`: `COPY . .` porta nel builder `.env`, `data/`, `node_modules`, script di diagnosi. | Segreti nei layer immagine | `habitikami-web/Dockerfile:9` |
| S7 | P1 | Immagine base `node:20-alpine`: Node 20 è fuori supporto da aprile 2026. `googleapis@128` (2023) e `express@4` sono vecchi; nessun `npm audit`/Dependabot in CI. | CVE non patchate | `Dockerfile:2,16`, `package.json`, `.github/workflows/*` |
| S8 | P1 | Android: API key in `SharedPreferences` in chiaro con `android:allowBackup="true"` → finisce nel backup cloud Google e in `adb backup`. | Esfiltrazione chiave dal backup | `AndroidManifest.xml:7`, `WidgetConfigActivity.kt:52-56`, `StatsWidgetConfigActivity.kt:149-153`, `HabitStatsConfigActivity.kt` |
| S9 | P1 | Log con email in chiaro su stdout; driver Docker `json-file` senza rotazione → log illimitati e non cancellabili per utente. | Conservazione PII incontrollata | `server.js` (vedi §0), `compose.yml` |
| S10 | P1 | Logout non revoca il refresh token presso Google: il token resta valido se già copiato. | Sessione sopravvive al logout | `App.tsx:384`, `HabitService.ts:246` |
| S11 | P2 | Traefik con `--api.insecure=true` (dashboard non pubblicata ma API insicura attiva). | Esposizione accidentale dashboard | `compose.yml:7` |
| S12 | P2 | `/api/risc/events` senza rate limit (verifica firma ok, ma può essere usato per far lavorare la CPU). | DoS leggero | `server.js:1544` |
| S13 | P2 | Android: nessuna `network_security_config`; URL server libero; su API 26-27 il cleartext è permesso di default. | Chiave inviata in HTTP se l'utente sbaglia URL | `AndroidManifest.xml`, config activities |
| S14 | P2 | Action GitHub non pinnate a SHA (`softprops/action-gh-release@v2`, ecc.). | Supply chain CI | `.github/workflows/*.yml` |
| S15 | P2 | Zero test automatici: nessuna rete di sicurezza sulle route auth. | Regressioni silenziose | repo |
| S16 | P2 | Documentazione stale: `README-EXPORT.md` descrive `EXPORT_API_TOKEN` e `?token=` che il codice non supporta più; `nginx.conf` e `docker-entrypoint.sh` non sono più usati dal Dockerfile; `test_export.js`, `diagnose_weekend.js` nella root web. | Confusione, superfici dimenticate | `habitikami-web/` |

### 2.2 Piano sicurezza

**P0 · S · S1** Verificare l'audience dell'access token.
- Nuova `verifyAccessToken(token)`: `GET https://oauth2.googleapis.com/tokeninfo?access_token=…`, controllare `aud === VITE_GOOGLE_CLIENT_ID` (o `azp`), `expires_in > 0`, `email_verified`. Restituire `{ email }`. Cache in memoria per `(token → email, exp)` per non chiamare Google a ogni richiesta.
- Sostituire tutte le chiamate a `getEmailFromToken` sui Bearer in ingresso. Tenere `getEmailFromToken` solo come fallback interno dopo lo scambio del code.

**P0 · M · S3** Hash delle API key.
- Salvare `sha256(key)` come chiave di `apikeys.json`; mostrare la chiave in chiaro solo nella risposta di `POST /api/user/apikey` (già così in UI). `masked_key` si calcola dai primi/ultimi caratteri salvati a parte (`prefix: 'hk_ab12'`).
- Script di migrazione una tantum all'avvio: se una chiave non inizia con il formato hash, rehash e riscrivi. Avvisare gli utenti che le chiavi esistenti restano valide (l'hash si calcola dal valore che il widget manda).
- `authenticate`: `apiKeys[sha256(apiToken)]`.

**P0 · L · S2** Togliere il refresh token dal browser (sessione server-side).
- `/api/auth/exchange` non restituisce più `refresh_token`: lo cifra (funzione già esistente) e lo salva in `data/sessions.json` sotto un `sessionId` casuale (32 byte) inviato come cookie `httpOnly; Secure; SameSite=Lax`.
- `/api/auth/refresh` legge il cookie, decifra, rinnova e restituisce solo `access_token` + `expires_in`. Il client continua a tenere l'access token in memoria (durata 1h) e può restarlo in localStorage come oggi, ma la perdita è limitata nel tempo.
- `clearSession` → `POST /api/auth/logout` che cancella la sessione e revoca su Google (chiude anche S10).
- Poi riabilitare la CSP in helmet: `default-src 'self'; script-src 'self' https://apis.google.com https://accounts.google.com https://static.cloudflareinsights.com; connect-src 'self' https://*.googleapis.com https://accounts.google.com https://cloudflareinsights.com; frame-src https://accounts.google.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'`. Partire in `Content-Security-Policy-Report-Only` per una settimana, poi enforce. Le tre `dangerouslySetInnerHTML` su stringhe i18n (`HelpView.tsx:325-336`, `OnboardingPage.tsx:167`) vanno sostituite con componenti o `renderMarkdown`, così non serve `unsafe-inline` per gli script.

**P1 · S · S4** Validare `counter`: `^[A-Za-z0-9 _\-]{1,40}$`, rifiutare prefisso `_config`; calcolare la lettera di colonna con una funzione A..Z, AA..AZ.

**P1 · S · S5, S6, S16** Igiene config e repo.
- Rinominare `VITE_GOOGLE_CLIENT_SECRET` → `GOOGLE_CLIENT_SECRET` (server.js, Dockerfile commenti, README-EXPORT, `.env.example`), mantenendo per una release un fallback con warning.
- Aggiungere `habitikami-web/.dockerignore`: `node_modules`, `dist`, `data`, `.env*`, `*.md`, `test_export.js`, `diagnose_weekend.js`, `nginx.conf`, `docker-entrypoint.sh`.
- Rimuovere `nginx.conf`, `docker-entrypoint.sh`, `test_export.js`, `diagnose_weekend.js`; aggiornare `README-EXPORT.md` all'auth attuale (API key per utente, niente `EXPORT_API_TOKEN`).

**P1 · S · S7** Aggiornare base image a `node:22-alpine` (LTS fino ad aprile 2027) o `node:24-alpine`; `npm audit --omit=dev` nel workflow web; abilitare Dependabot (`.github/dependabot.yml` per npm, gradle, github-actions). Aggiornare `googleapis` all'ultima major (API Sheets/Drive v4/v3 invariate).

**P1 · S · S8, S13** Android.
- `android:allowBackup="false"` oppure `dataExtractionRules` che esclude `habitikami_widget.xml`.
- Spostare URL e token in `EncryptedSharedPreferences` (`androidx.security:security-crypto`) con un helper unico `WidgetConfigStore` usato da tutte le config activity e i provider (oggi la stessa coppia di chiavi è scritta in tre activity diverse).
- Nelle config activity accettare solo URL `https://` (eccetto `http://10.0.2.2`/`localhost` in debug build) e aggiungere `android:usesCleartextTraffic="false"`.

**P1 · S · S9** Log: hash dell'email nei log (vedi G3); in `compose.yml` `logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }`; dichiarare in informativa la retention risultante (~qualche settimana).

**P2 · S · S11, S12, S14** Rimuovere `--api.insecure=true` da Traefik; `rateLimit` anche su `/api/risc/events` (es. 60/min); pinnare le action a SHA con commento della versione.

**P2 · M · S15** Test minimi con `vitest` + `supertest` su: exchange con `id_token` non valido → 400; Bearer con `aud` sbagliato → 401 (dopo S1); API key sconosciuta → 401; `counter` malformato → 400; `DELETE /api/user/account` rimuove tutto. Eseguirli in `build-web.yml` prima del build Docker.

---

## 3. UX / UI web

| # | Pri | Effort | Miglioria | Dove |
|---|-----|--------|-----------|------|
| U1 | P0 | S | Informativa e Termini tradotti e raggiungibili dal menu utente (collegato a G10, G13). Aggiungere `lang` dinamico su `<html>` (oggi fisso `en` in `index.html:2`). | `main.tsx`, `App.tsx` menu, `LanguageContext.tsx` |
| U2 | P0 | M | Sezione **Account e privacy** nelle impostazioni: email, link "Apri il mio foglio Google", API key widget, chiavi AI, consenso AI (stato + ritiro), "Scarica i miei dati", "Elimina account", versione app, link legali. Oggi API key e chiavi AI sono dentro il tab Help: poco intuibile. | `HelpView.tsx` (estrarre `SettingsView.tsx`), `App.tsx` |
| U3 | P1 | S | Logout: cancellare anche le chiavi AI in localStorage (o chiedere "Rimuovere anche le chiavi AI salvate su questo dispositivo?"). Su dispositivi condivisi oggi restano. | `App.tsx:384`, `aiProvider.ts:46` |
| U4 | P1 | S | Onboarding manuale: accettare l'URL completo del foglio e estrarre l'ID con regex `/\/d\/([a-zA-Z0-9_-]{10,100})/`. Copiare solo l'ID dalla barra è il punto in cui gli utenti sbagliano. | `OnboardingPage.tsx`, `HelpView.tsx:handleSaveSpreadsheetId` |
| U5 | P1 | S | Dopo "Rigenera API key": avviso "I widget Android configurati smetteranno di funzionare: aggiorna la chiave nel widget". Oggi si rompono in silenzio. | `HelpView.tsx:handleGenerateApiKey` |
| U6 | P1 | M | Pairing widget Android senza digitare 67 caratteri: pulsante "Configura widget su questo telefono" che apre `web+habitikami://widget-config?key=…&url=…` (protocol handler già dichiarato in `manifest.json`), gestito da una activity Android che precompila e salva. Fallback: QR code da scansionare dal telefono quando si è su desktop. | `HelpView.tsx`, `manifest.json`, nuova `WidgetPairingActivity.kt` + intent-filter |
| U7 | P1 | S | Stringhe non tradotte: "What's New" (`App.tsx` menu), testi legali, template widget Windows. Audit rapido con `grep -n "\"[A-Z][a-z].* [a-z]" src/components` per trovare letterali. | vari |
| U8 | P2 | M | Passata di accessibilità: `aria-label` sui pulsanti solo-icona (header, griglia, temptation bar), `aria-pressed` sui toggle, focus visibile, contrasto del testo `muted-foreground/50`. Verificare con axe DevTools sulla preview. | `App.tsx`, `CheckboxGridView.tsx`, `TemptationBar.tsx`, `BottomNav.tsx` |
| U9 | P2 | S | Pagina di errore/offline: la SW serve `index.html` dalla cache ma se gapi non carica l'utente vede uno spinner infinito (`tryRestoreSession` attende `gapi.client` 2 s poi `resolve(false)` → landing). Mostrare un messaggio "Sei offline / Google non raggiungibile" con retry. | `HabitService.ts:258-266`, `App.tsx` |
| U10 | P2 | S | Riga sotto il pulsante di login con presa d'atto Termini/Informativa (vedi G13). | `LandingPage.tsx` |

---

## 4. Widget Android

| # | Pri | Effort | Miglioria | Dove |
|---|-----|--------|-----------|------|
| A1 | P0 | S | Sicurezza chiave: `allowBackup=false` + `EncryptedSharedPreferences` + helper unico (vedi S8). | manifest, config activities, provider |
| A2 | P1 | S | Errori parlanti: distinguere 401 ("Chiave non valida: tocca per riconfigurare", con PendingIntent alla config activity) da rete ("Offline, ultimo aggiornamento alle HH:MM" mostrando la cache). Oggi tutti i widget mostrano "Failed to load data". Far restituire ai client un `Result<T>` con il codice HTTP invece di liste vuote / `-1`. | `CounterApiClient.kt`, `HabitApiClient.kt`, tutti i `*WidgetProvider.kt` |
| A3 | P1 | S | Configurazione una sola volta: i widget senza config activity (Checklist, Weekly, Streak, Worst) mostrano "Configure counter widget first". Dare a tutti un tap che apre `WidgetConfigActivity` quando la config manca, e far sì che le config activity specifiche (Stats, HabitStats, MiniHeatmap) riusino URL/chiave già salvati senza richiederli. | `ChecklistWidgetProvider.kt:58`, `StatsWidgetConfigActivity.kt`, `HabitStatsConfigActivity.kt`, `MiniHeatmapConfigActivity.kt` |
| A4 | P1 | S | Localizzazione: spostare i letterali Kotlin ("Loading…", "Failed to load data", "Both fields are required", dialog aggiornamento) in `strings.xml` e aggiungere `values-it/strings.xml`. | `*.kt`, `res/values` |
| A5 | P1 | M | Pairing via deep link / QR (lato Android di U6): activity che riceve `web+habitikami://widget-config`, valida che `url` sia https, salva nello store cifrato, lancia `refreshAll` di tutti i provider. | nuova activity + manifest |
| A6 | P2 | S | Fascia di aggiornamento: `updatePeriodMillis` 30 min va bene; aggiungere un refresh immediato quando la TWA torna in foreground (broadcast da `MainActivity.onResume` o `WorkManager` one-shot) così dopo aver spuntato un'abitudine in app il widget non resta vecchio fino a 30 min. | `MainActivity.kt`, provider |
| A7 | P2 | S | Ridurre la duplicazione tra i 9 provider (ogni provider rifà `refreshAll`, `setupIntents`, loading state): una `BaseWidgetProvider` con `render(data)` astratto. Facilita A2 e A4. | `widget/*.kt` |
| A8 | P2 | S | `UpdateChecker`: mostrare il changelog della release nel dialog e aprire direttamente l'APK (`apkUrl`) invece della pagina release, con nota che Android chiederà il permesso installazione da fonti sconosciute. | `MainActivity.kt:66-85` |

## 5. Widget Windows 11 (PWA)

| # | Pri | Effort | Miglioria | Dove |
|---|-----|--------|-----------|------|
| W1 | P1 | S | I dati del widget vengono spinti al Service Worker **solo** da `HabitTable.tsx:185-190`: chi usa la vista griglia, compatta o focus ha un widget sempre vecchio. Spostare il `postMessage({type:'WIDGET_UPDATE'})` in `useSheetData.ts` (o in `App.tsx` dopo ogni refresh) così parte da qualunque vista. | `HabitTable.tsx:185-190`, `hooks/useSheetData.ts`, `App.tsx` |
| W2 | P1 | S | Azioni "Complete Next" e "Skip" aprono solo l'app; `?action=skip-next` non è gestito in `App.tsx`. O implementare l'azione (aprire l'app sulla vista Focus con la prossima abitudine selezionata) o togliere i pulsanti per non promettere ciò che non fa. | `sw.js:86-97`, `App.tsx`, `widgets/habit-summary.json:124-141` |
| W3 | P1 | S | Template in inglese fisso ("Completed", "Streak", "Next up", "days"). Rendere le etichette parte dei `data` inviati dalla app (già tradotti con `t()`), così il template usa `${labelCompleted}` ecc. | `habit-summary.json`, `sw.js`, punto di invio dati |
| W4 | P2 | S | Dati iniziali: `habit-summary-data.json` statico con "No habits yet". Finché l'utente non apre la app, il widget mostra zero. Aggiungere `nextHabitName: "Apri Habitikami per sincronizzare"` localizzato e un timestamp "aggiornato alle" nei dati, così è chiaro quando sono vecchi. | `public/widgets/data/habit-summary-data.json`, `sw.js:getWidgetData` |
| W5 | P2 | S | Screenshot reale del widget nel manifest (oggi è l'icona 512) e `short_name`/`description` localizzati tramite `manifest.json` per lingua o `lang`/`dir` nel manifest. | `manifest.json:52-80` |

---

## 6. Ordine consigliato di esecuzione

1. **Settimana 1 (P0, tutto S/M salvo S2):** G1-G2-G9-G10 informativa IT/EN con versione; S1 audience check; S3 hash API key; S4 validazione counter; A1 Android chiave cifrata + no backup; U1 link legali e `lang`.
2. **Settimana 2:** G6-G7 `/api/user/me`, `DELETE /api/user/account`, sezione Account e privacy (U2); G8 consenso AI; U3 logout pulito; S5-S6-S16 igiene config/repo; S7 Node 22 + audit + Dependabot.
3. **Settimana 3:** S2 sessione server-side + CSP in report-only (è il refactor più grande; farlo su branch dedicato e testarlo con TWA e desktop); S9 log; S10 revoca al logout (incluso in S2).
4. **Poi, in ordine di valore:** W1-W2-W3 (widget Windows corretto e tradotto), A2-A3-A4 (widget Android robusti e in italiano), U4-U5-U7, U6+A5 pairing, S15 test, S11-S14, U8-U10, A6-A8, W4-W5, registro trattamenti.

Ogni voce è pensata per essere un commit/PR autonomo con il proprio bump di versione in `CHANGELOG.md`.

## 7. Cose da decidere tu (non derivabili dal codice)

- Identità del titolare e email di contatto privacy da pubblicare nell'informativa.
- Paese/fornitore dell'hosting del container (serve per la sezione destinatari e trasferimenti).
- Retention dei log che vuoi dichiarare (proposta: 30 giorni con la rotazione di S9).
- Se mantenere il fallback service account per le API key senza refresh token (`server.js:997-1013`): è l'unico caso in cui un foglio deve essere condiviso con un account di terzi; se nessun utente lo usa più, rimuoverlo semplifica informativa e superficie.

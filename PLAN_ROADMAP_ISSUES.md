# Piano di implementazione: tutte le issue aperte

Stato al 2026-10-21 su `main` (web 5.9.6, android 5.3.4). 67 issue aperte; escluse #19 (iOS) e la migrazione DB (#17, già chiusa: si resta su Google Sheets). Restano **66 issue** raggruppate in **9 ondate** e **~32 PR**.

Convenzioni: una PR per riga, un commit per issue con `Closes #n`, bump versione e CHANGELOG per PR, sequenziali sullo stesso branch (dopo ogni merge riparto da `main`). Effort: S < 2h · M mezza giornata · L 1-2 giorni.

Vincoli di architettura che guidano le scelte (da `HabitService.ts`, `server.js`, `sw.js`):
- Le abitudini sono colonne dei fogli Weekdays/Weekend, identificate dal nome; le celle valgono `TRUE/FALSE/SKIP/HALF`. I metadati per abitudine stanno in `HabitMeta` (Habit | Description): è il posto naturale dove aggiungere colonne.
- I dati vengono letti un mese alla volta (`getDataSubset`): streak, correlazioni, proiezioni ed export hanno bisogno di una lettura multi-mese.
- Il mood vive solo in `localStorage` (`habitikami_mood_history`, max 100 voci): per correlarlo e per non perderlo va portato su foglio.
- Il server non ha scheduler né invio notifiche; conserva però il refresh token cifrato degli utenti con API key, quindi può leggere i fogli in background (già lo fa per i widget).
- Il service worker non ha handler `push`; nessun codice Notification. Il protocol handler `web+habitikami` è dichiarato ma non gestito.
- Nessun test automatico, lint non in CI.

---

## Ondata 0 · Fondamenta (sbloccano tutto il resto)

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 0.1 Test e lint in CI | #73, #91 | S | vitest + supertest, `server.js` esporta l'app senza `listen` in test; test su exchange/aud/API key/counter; `npm run lint` e `npm test` in `build-web.yml`. |
| 0.2 Lettura multi-mese + streak condivisi | prereq #1 #4 #5 #7 #18 #3 | M | `getRangeData(sheet, from, to)` in `HabitService` (una sola chiamata `A:ZZ` filtrata per date, con cache react-query `['sheetRange', …]`); modulo `utils/streaks.ts` con regole esplicite (vedi decisione D1) usato da `CheckboxGridView`, Focus, HabitTable (oggi manda `currentStreak: 0` al widget Windows) e, in parallelo, allineamento dell'algoritmo in `HabitStatsWidgetProvider.kt`. |
| 0.3 HabitMeta esteso + parser | prereq #14 #12 | M | Colonne `Type` (check/number), `Target`, `Unit`, `Slot` (morning/afternoon/evening/any), `Time` in `HabitMeta`, lette/scritte da `useHabitMeta`; `parser.ts` riconosce celle numeriche (`6`, `6/8`) → `{ value, target }`; `HabitData` tipizzato. Nessun cambio UI ancora. |
| 0.4 Mood su foglio | prereq #5, #6 | S | Nuovo foglio `Mood` (Date ISO | Timestamp | Mood | Anxiety | Label | Source); migrazione una tantum da localStorage; `MoodGraph` legge dal foglio con react-query. |

## Ondata 1 · UX rapide (tutte S, una PR)

| PR | Issue | Contenuto |
|----|-------|-----------|
| 1.1 UX quick wins | #57, #65, #66, #67, #69 | `lang` dinamico; logout che rimuove le chiavi AI; onboarding che accetta l'URL del foglio; avviso su rigenerazione API key; audit stringhe non tradotte (+ i 27 `t('x' as any)` e le due chiavi mancanti `graphsActiveDays`, `habitTableAllDone`). |

## Ondata 2 · Core abitudini

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 2.1 Streak | #1 | M | Badge streak corrente nell'intestazione colonna (tabella) e nella card (griglia), fiamma in Focus; milestone 7/30/100 con animazione (framer-motion) e memoria "già festeggiato" in localStorage; sezione "Streak più lunghe" in Graphs; `currentStreak` reale nel widget Windows. |
| 2.2 Abitudini quantitative | #14 | L | Tipo scelto in `AddHabitModal` e nel popup info; cella numerica con stepper/input in tabella e griglia (valore ≥ target = completata, altrimenti parziale); barra di progresso in Focus; grafico "valore nel tempo" in Graphs; export/widget: il valore grezzo resta nella cella, i widget Android considerano completata se ≥ target (lettura `HabitMeta` via `/api/export`, vedi 2.2b). |
| 2.2b Export con meta | #14 (server) | S | `/api/export` aggiunge `habitMeta` (type, target, slot) così widget e card leggono le stesse regole. |
| 2.3 Fasce orarie | #12 | M | Selettore fascia + orario opzionale nel popup info; raggruppamento per fascia in Focus con filtro "fascia corrente" (ora locale); tag colorato nell'intestazione; l'orario alimenta i promemoria (4.1). |
| 2.4 Note per abitudine/giorno | #13 | M | Nuovo foglio `HabitNotes` (Date | Habit | Note); long-press/click destro sulla cella apre l'editor; pallino indicatore nella cella; tooltip con il testo; ricerca nelle note dentro MobiusNotes (tab "Note abitudini"). |
| 2.5 Template di abitudini | #15 | M | `data/habitTemplates.ts` (Fitness, Produttività, Benessere mentale, Smettere di fumare) con nome, descrizione, colore, slot, tipo/target; scelta multipla durante l'onboarding dopo la creazione del foglio e da Impostazioni; applica via `addHabit` + `setHabitMeta` + `setHabitColor`. Template community: fuori perimetro (richiede backend condiviso). |

## Ondata 3 · Analytics

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 3.1 Correlazioni tra abitudini | #4 | M | Coefficiente phi per coppia su finestra selezionabile (1/3/6 mesi, via `getRangeData`); matrice heatmap in Graphs; lista "quando fai X tendi a fare Y" per |phi| ≥ 0.3 con almeno 20 giorni; suggerimento testuale. |
| 3.2 Correlazione mood-abitudini | #5 | M | Join per data tra foglio `Mood` e completamenti; differenza media del mood nei giorni con/senza abitudine; grafico a barre divergenti; top 3 abitudini "che fanno bene". |
| 3.3 Proiezioni | #7 | S | Regressione lineare sul completion rate degli ultimi 30 giorni, linea tratteggiata di proiezione in `CompletionTrends`; "al ritmo attuale raggiungi la streak di N tra K giorni" sotto il badge streak. |
| 3.4 Export CSV/PDF | #18 | M | Picker periodo; CSV lato client da `getRangeData` (abitudini + contatori + note + mood); PDF via `window.print` con stylesheet dedicato e grafici rasterizzati (`html-to-image`); download diretto. |
| 3.5 Report settimanale/mensile in app | #6 (parte 1) | M | Vista "Report" generata al volo: abitudini più/meno completate, streak attive, trend vs periodo precedente, contatori; condivisibile come immagine (riusa 5.2) e come PDF (3.4). Invio automatico: vedi 4.1 (push) e decisione D4 (email). |

## Ondata 4 · Notifiche, offline, promemoria

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 4.1 Push web | #11 | L | VAPID (`web-push`), `PushManager.subscribe` dalla sezione impostazioni, handler `push`/`notificationclick` in `sw.js`, subscription salvate in `data/push.json` per email; scheduler `node-cron` nel server (orari e fuso dell'utente) che invia: promemoria per abitudine (orario da `HabitMeta.Time` o da fascia), promemoria serale "ti mancano N abitudini" leggendo il foglio con il refresh token già cifrato (stesso meccanismo delle API key), silenzio per abitudine. Nella TWA le push Chrome arrivano come notifiche native: niente codice Android. Riepilogo settimanale via push chiude la parte "notifica" di #6. |
| 4.2 Offline con sincronizzazione | #16 | L | Persistenza cache react-query in IndexedDB (`@tanstack/query-persist-client-core` + idb); coda mutazioni offline (toggle cella, contatori, note) in IndexedDB replicata al ritorno online con `online` event + retry; conflitti: ultima scrittura vince per cella, con toast se il valore remoto è cambiato; indicatore online/offline nell'header; `sw.js` smette di cancellare la cache `widget-data` all'activate. |
| 4.3 Stato offline/Google non raggiungibile | #72 | S | Messaggio con retry al posto dello spinner (si integra con l'indicatore di 4.2). |

## Ondata 5 · Gamification e social

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 5.1 Achievement | #3 | L | Catalogo statico (`data/achievements.ts`: streak 7/30/100, settimana perfetta, 50/200 resistenze, 10 note, 30 giorni mood, …) valutato da `utils/achievements.ts` sui dati già caricati; stato sbloccato nel foglio `Achievements` (Id | UnlockedAt) per averlo su tutti i dispositivi; pagina "Trofei" (sbloccati/bloccati con progresso); toast + animazione allo sblocco; condivisione via 5.2. |
| 5.2 Card condivisibili | #10 | M | Componente card (streak, completion rate, achievement) renderizzato in DOM nascosto → PNG con `html-to-image`; 3 template; Web Share API con file (Android) o download; branding Habitikami. |
| 5.3 Accountability partner | #8 | L | Server: `data/shares.json` con token casuale → `{ ownerEmail, habits[], createdAt }`; `POST/DELETE /api/share` (Bearer) e `GET /api/share/:token` pubblico che calcola il riepilogo (streak e ultimi 14 giorni delle sole abitudini scelte) con il refresh token dell'owner; pagina pubblica `/p/:token` read-only; invito via link/QR; revoca. Notifiche al partner: push (4.1) se anche lui usa l'app, altrimenti niente. Dashboard "di entrambi": seconda fase, solo se entrambi sono utenti. |

## Ondata 6 · Widget

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 6.1 Widget Windows corretto e tradotto | #80, #81, #82 | S | `WIDGET_UPDATE` da `useSheetData`; azioni Complete Next/Skip gestite in `App.tsx` aprendo Focus; etichette tradotte nei dati. |
| 6.2 Widget Windows dati iniziali e manifest | #94, #83 | S | Testo iniziale localizzato, `updatedAt`, screenshot reale, nome/descrizione localizzati. |
| 6.3 Widget Windows: più widget e restyling | #35 | M | Secondo widget "Contatori di oggi" (tap = incremento via `/api/counter/increment` dal SW con l'API key) e terzo "Streak"; restyling Adaptive Card con colori abitudini. |
| 6.4 Android: errori e configurazione | #74, #93, #75, #76 | M | `ApiResult` con codice HTTP; 401 → "tocca per riconfigurare", offline → cache con orario; tap-to-configure; riuso URL/chiave nelle config activity. |
| 6.5 Android: localizzazione e refactor | #77, #101, #78, #79 | M | Stringhe in `strings.xml` + `values-it`; `BaseWidgetProvider`; refresh al ritorno in foreground; dialog aggiornamento con changelog e APK diretto. |
| 6.6 Pairing widget | #68, #90, #100 | M | Pulsante web che apre `web+habitikami://widget-config?key&url`; `WidgetPairingActivity` con intent-filter che valida https, salva nello store cifrato e aggiorna i widget; QR da desktop. |

## Ondata 7 · Sicurezza S2 (sessione server-side e CSP)

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 7.1 Prerequisiti CSP | #64, #89 | S | Via le `dangerouslySetInnerHTML` su stringhe i18n; CSP in report-only con `/api/csp-report`. |
| 7.2 Sessione server-side | #63, #88 | L | `data/sessions.json` + cookie httpOnly; client senza refresh token; migrazione sessioni v3 → v4; test su TWA e desktop. |
| 7.3 Chiusura | #99, #98 | S | CSP enforce dopo una settimana di report puliti; rimozione fallback refresh token nel body. |

## Ondata 8 · Accessibilità e AI

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 8.1 Accessibilità | #70, #71 | S | `aria-label`/`aria-pressed`, focus visibile, contrasto. |
| 8.2 API key AI più semplice | #25 | M | Wizard a passi con link diretto alla console del provider, validazione della chiave con una chiamata di prova, spiegazione costi; in più chiave condivisa lato server opzionale (`SERVER_AI_PROVIDER`/`SERVER_AI_KEY`) usata quando l'utente non ne ha una, con quota giornaliera per account (sensato in modalità privata). |

## Ondata 9 · GDPR (quando l'app torna aperta ad altri)

Dipende da #53 (decisioni del titolare). In modalità privata con un solo account non è urgente; la cancellazione dei dati altrui è già automatica (5.9.6).

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 9.1 Server dati e consenso | #58, #59, #87, #61, #92 | M | `/api/user/me`, `DELETE /api/user/account`, `ai-consent`, via `temptations` da users.json, test DELETE. |
| 9.2 Account e privacy in app | #60, #86, #95, #96, #55 | M | `SettingsView` estratto da Help; scarica/elimina dati; modale consenso AI e ritiro; link legali. |
| 9.3 Testi legali e documenti | #53, #54, #84, #85, #56, #97, #62 | M | i18n con versione fissa; informativa e termini riscritti; presa d'atto sotto il login; registro trattamenti e procedura data breach. |

---

## Ordine consigliato e perché

1. **Ondata 0** (4 PR, ~2 giorni): senza lettura multi-mese e metadati estesi, streak, quantitative, correlazioni ed export si farebbero due volte.
2. **Ondata 1** (1 PR, mezza giornata): valore immediato, zero rischio.
3. **Ondata 2** (6 PR, ~5 giorni): le feature che usi ogni giorno.
4. **Ondata 3** (5 PR, ~3 giorni): analytics sui dati ora disponibili.
5. **Ondata 4** (3 PR, ~4 giorni): push e offline sono i due lavori grossi lato infrastruttura.
6. **Ondata 6** (6 PR, ~4 giorni): widget; prima dell'ondata 5 perché i widget li usi già, le card e il partner no.
7. **Ondata 5** (3 PR, ~4 giorni): gamification e social.
8. **Ondata 7** (3 PR, ~3 giorni): sessione server-side. È P0 nel piano sicurezza, ma con app privata a un solo account il rischio reale è basso; la metto dopo le feature. Se preferisci, spostala subito dopo l'ondata 1.
9. **Ondate 8 e 9**: accessibilità, AI key, GDPR.

Totale indicativo: ~32 PR, ~26 giorni di lavoro effettivo.

## Decisioni che servono da te

- **D1 · Regole streak** (ondata 0.2, vale per web, widget Windows e Android): proposta `TRUE` e `HALF` continuano la streak, `SKIP` è neutro (non interrompe, non conta), `FALSE` o giorno mancante interrompe; i giorni del foglio "sbagliato" (weekend per un'abitudine solo feriale) non contano. Oggi web e Android fanno interrompere anche SKIP e HALF.
- **D2 · Formato cella quantitativa** (0.3): proposta valore nudo nella cella (`6`) con target in `HabitMeta`, così il foglio resta leggibile e sommabile; alternativa `6/8` nella cella.
- **D3 · Mood sul foglio** (0.4): confermi il nuovo foglio `Mood`? È il prerequisito per #5 e per avere il mood su più dispositivi.
- **D4 · Report via email** (#6): richiede SMTP (es. Resend/SendGrid, variabili `SMTP_*`). Proposta: report in app + push settimanale, email solo se la vuoi davvero.
- **D5 · Push**: ti va bene uno scheduler nel container (node-cron) e la coppia di chiavi VAPID in `.env`? I promemoria serali leggono il foglio con il refresh token già salvato per l'API key: servono quindi un'API key generata (già ce l'hai per i widget).
- **D6 · Accountability partner**: ok la pagina pubblica read-only via token (5.3) come prima versione, o preferisci solo utenti registrati?
- **D7 · Priorità sicurezza S2**: dopo le feature (proposta) o subito?
- **D8 · GDPR**: lasciarla per ultima finché l'app resta privata.

# Piano di implementazione: issue aperte

Stato al 2026-10-21 su `main` (web 5.9.6, android 5.3.4). 67 issue aperte.

**Fuori piano (restano aperte su GitHub):**
- #19 app iOS; migrazione DB (#17, già chiusa: si resta su Google Sheets).
- Sicurezza S2, 6 issue (#63, #88, #98, #64, #89, #99): sessione server-side e CSP. Il resto del piano sicurezza (S1, S3-S14, S16, Android) è già in produzione; S2 è l'unico blocco rimasto e si rimanda.
- GDPR, 17 issue (#53-#56, #58-#62, #84-#87, #92, #95-#97): rimandate finché l'app resta privata; la cancellazione automatica dei dati di altri account è già attiva (5.9.6).
- #8 accountability partner: richiede pagine pubbliche o utenti multipli; rimandato.

**Nel piano: 42 issue, 8 ondate, ~29 PR, ~23 giorni di lavoro effettivo.**

Convenzioni: una PR per riga, un commit per issue con `Closes #n`, bump versione e CHANGELOG per PR, sequenziali sullo stesso branch (dopo ogni merge riparto da `main`). Effort: S < 2h · M mezza giornata · L 1-2 giorni.

Vincoli di architettura che guidano le scelte (da `HabitService.ts`, `server.js`, `sw.js`):
- Le abitudini sono colonne dei fogli Weekdays/Weekend, identificate dal nome; le celle valgono `TRUE/FALSE/SKIP/HALF`. I metadati per abitudine stanno in `HabitMeta` (Habit \| Description): è il posto naturale per nuove colonne.
- I dati vengono letti un mese alla volta (`getDataSubset`): streak, correlazioni, proiezioni ed export richiedono una lettura multi-mese.
- Il mood vive solo in `localStorage` (max 100 voci): per correlarlo e averlo su più dispositivi va portato su foglio.
- Il server non ha scheduler né notifiche; conserva però il refresh token cifrato degli utenti con API key, quindi può leggere i fogli in background (già lo fa per i widget).
- Il service worker non ha handler `push`. Il protocol handler `web+habitikami` è dichiarato ma non gestito.
- Nessun test automatico, lint non in CI.

---

## Ondata 0 · Fondamenta (sbloccano tutto il resto)

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 0.1 Test e lint in CI | #73, #91 | S | vitest + supertest, `server.js` esporta l'app senza `listen` in test; test su exchange/aud/API key/counter; `npm run lint` e `npm test` in `build-web.yml`. Rete di sicurezza per le PR successive che toccano il server (export, push, counter). |
| 0.2 Lettura multi-mese + streak condivisi | prereq #1 #4 #5 #7 #18 #3 | M | `getRangeData(sheet, from, to)` in `HabitService` (una chiamata `A:ZZ` filtrata per date, cache react-query `['sheetRange', …]`); modulo `utils/streaks.ts` con regole esplicite (decisione D1) usato da `CheckboxGridView`, Focus, HabitTable (oggi manda `currentStreak: 0` al widget Windows); stesso algoritmo allineato in `HabitStatsWidgetProvider.kt`. |
| 0.3 HabitMeta esteso + parser | prereq #14 #12 | M | Colonne `Type` (check/number), `Target`, `Unit`, `Slot` (morning/afternoon/evening/any), `Time` in `HabitMeta`, lette/scritte da `useHabitMeta`; `parser.ts` riconosce celle numeriche → `{ value, target }`; `HabitData` tipizzato. Nessun cambio UI ancora. |
| 0.4 Mood su foglio | prereq #5, #6 | S | Nuovo foglio `Mood` (Date ISO \| Timestamp \| Mood \| Anxiety \| Label \| Source); migrazione una tantum da localStorage; `MoodGraph` legge dal foglio con react-query. |

## Ondata 1 · UX rapide (una PR)

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 1.1 UX quick wins | #57, #65, #66, #67, #69 | S | `lang` dinamico; logout che rimuove le chiavi AI; onboarding che accetta l'URL del foglio; avviso su rigenerazione API key; audit stringhe non tradotte (inclusi i 27 `t('x' as any)` e le chiavi mancanti `graphsActiveDays`, `habitTableAllDone`). |

## Ondata 2 · Core abitudini

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 2.1 Streak | #1 | M | Badge streak corrente nell'intestazione colonna (tabella) e nella card (griglia), fiamma in Focus; milestone 7/30/100 con animazione e memoria "già festeggiato" in localStorage; sezione "Streak più lunghe" in Graphs; `currentStreak` reale nel widget Windows. |
| 2.2 Abitudini quantitative | #14 | L | Tipo scelto in `AddHabitModal` e nel popup info; cella numerica con stepper/input in tabella e griglia (valore ≥ target = completata, altrimenti parziale); barra di progresso in Focus; grafico "valore nel tempo" in Graphs. |
| 2.2b Export con meta | #14 (server) | S | `/api/export` aggiunge `habitMeta` (type, target, slot) così i widget Android applicano le stesse regole di completamento. |
| 2.3 Fasce orarie | #12 | M | Selettore fascia + orario opzionale nel popup info; raggruppamento per fascia in Focus con filtro "fascia corrente"; tag nell'intestazione; l'orario alimenta i promemoria (4.1). |
| 2.4 Note per abitudine/giorno | #13 | M | Nuovo foglio `HabitNotes` (Date \| Habit \| Note); long-press/click destro sulla cella apre l'editor; pallino indicatore nella cella; tooltip; ricerca nelle note dentro MobiusNotes. |
| 2.5 Template di abitudini | #15 | M | `data/habitTemplates.ts` (Fitness, Produttività, Benessere mentale, Smettere di fumare) con nome, descrizione, colore, slot, tipo/target; scelta durante l'onboarding e da Impostazioni; applica via `addHabit` + `setHabitMeta` + `setHabitColor`. Template community: fuori perimetro. |

## Ondata 3 · Analytics

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 3.1 Correlazioni tra abitudini | #4 | M | Coefficiente phi per coppia su finestra 1/3/6 mesi; matrice heatmap in Graphs; lista "quando fai X tendi a fare Y" per \|phi\| ≥ 0.3 con almeno 20 giorni. |
| 3.2 Correlazione mood-abitudini | #5 | M | Join per data tra foglio `Mood` e completamenti; differenza media del mood nei giorni con/senza abitudine; grafico a barre divergenti; top 3 abitudini "che fanno bene". |
| 3.3 Proiezioni | #7 | S | Regressione lineare sul completion rate degli ultimi 30 giorni, linea tratteggiata in `CompletionTrends`; "al ritmo attuale raggiungi la streak di N tra K giorni". |
| 3.4 Export CSV/PDF | #18 | M | Picker periodo; CSV lato client da `getRangeData` (abitudini, contatori, note, mood); PDF via stylesheet di stampa con grafici rasterizzati (`html-to-image`); download diretto. |
| 3.5 Report settimanale/mensile | #6 | M | Vista "Report" generata al volo: abitudini più/meno completate, streak attive, trend vs periodo precedente, contatori; esportabile come immagine (6.2) e PDF (3.4). Invio automatico: push settimanale in 4.1. Niente email. |

## Ondata 4 · Notifiche e offline

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 4.1 Push web | #11, chiude #6 | L | VAPID (`web-push`), iscrizione dalle impostazioni, handler `push`/`notificationclick` in `sw.js`, subscription in `data/push.json` per email; scheduler `node-cron` nel server (orari e fuso dell'utente): promemoria per abitudine (da `HabitMeta.Time` o fascia), promemoria serale "ti mancano N abitudini" leggendo il foglio con il refresh token già cifrato, riepilogo settimanale, silenzio per abitudine. Nella TWA le push Chrome arrivano come notifiche native: niente codice Android. |
| 4.2 Offline con sincronizzazione | #16 | L | Cache react-query persistita in IndexedDB; coda mutazioni offline (celle, contatori, note) replicata al ritorno online con retry; conflitti: ultima scrittura vince per cella, con toast se il valore remoto è cambiato; indicatore online/offline nell'header; `sw.js` smette di cancellare la cache `widget-data`. |
| 4.3 Stato offline/Google non raggiungibile | #72 | S | Messaggio con retry al posto dello spinner, integrato con l'indicatore di 4.2. |

## Ondata 5 · Widget

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 5.1 Widget Windows corretto e tradotto | #80, #81, #82 | S | `WIDGET_UPDATE` da `useSheetData`; azioni Complete Next/Skip gestite in `App.tsx` aprendo Focus; etichette tradotte nei dati. |
| 5.2 Widget Windows dati iniziali e manifest | #94, #83 | S | Testo iniziale localizzato, `updatedAt`, screenshot reale, nome/descrizione localizzati. |
| 5.3 Widget Windows: più widget e restyling | #35 | M | Widget "Contatori di oggi" (tap = incremento via API key dal SW) e "Streak"; restyling Adaptive Card con i colori delle abitudini. |
| 5.4 Android: errori e configurazione | #74, #93, #75, #76 | M | `ApiResult` con codice HTTP; 401 → "tocca per riconfigurare", offline → cache con orario; tap-to-configure; riuso URL/chiave nelle config activity. |
| 5.5 Android: localizzazione e refactor | #77, #101, #78, #79 | M | Stringhe in `strings.xml` + `values-it`; `BaseWidgetProvider`; refresh al ritorno in foreground; dialog aggiornamento con changelog e APK diretto. |
| 5.6 Pairing widget | #68, #90, #100 | M | Pulsante web che apre `web+habitikami://widget-config?key&url`; `WidgetPairingActivity` che valida https, salva nello store cifrato e aggiorna i widget; QR da desktop. |

## Ondata 6 · Gamification

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 6.1 Achievement | #3 | L | Catalogo statico (`data/achievements.ts`: streak 7/30/100, settimana perfetta, 50/200 resistenze, 10 note, 30 giorni mood, …) valutato sui dati già caricati; stato sbloccato nel foglio `Achievements` (Id \| UnlockedAt) per averlo su tutti i dispositivi; pagina "Trofei" (sbloccati/bloccati con progresso); toast e animazione allo sblocco. |
| 6.2 Card condivisibili | #10 | M | Componente card (streak, completion rate, achievement) renderizzato in DOM nascosto → PNG con `html-to-image`; 3 template; Web Share API con file (Android) o download. Nessuna pagina pubblica: solo immagine. |

## Ondata 7 · Accessibilità e AI

| PR | Issue | Effort | Contenuto |
|----|-------|--------|-----------|
| 7.1 Accessibilità | #70, #71 | S | `aria-label`/`aria-pressed`, focus visibile, contrasto. |
| 7.2 API key AI più semplice | #25 | M | Wizard a passi con link diretto alla console del provider, validazione della chiave con una chiamata di prova, nota sui costi; chiave condivisa lato server opzionale (`SERVER_AI_PROVIDER`/`SERVER_AI_KEY`) usata quando l'utente non ne ha una, con quota giornaliera per account. |

---

## Ordine e stime

| Ondata | PR | Giorni |
|--------|----|--------|
| 0 Fondamenta | 4 | 2 |
| 1 UX rapide | 1 | 0.5 |
| 2 Core abitudini | 6 | 5 |
| 3 Analytics | 5 | 3 |
| 4 Notifiche e offline | 3 | 4 |
| 5 Widget | 6 | 4 |
| 6 Gamification | 2 | 3 |
| 7 Accessibilità e AI | 2 | 1.5 |
| **Totale** | **29** | **~23** |

I widget (5) vengono prima della gamification (6) perché li usi già tutti i giorni.

## Decisioni che servono da te

- **D1 · Regole streak** (0.2, vale per web, widget Windows e Android): proposta `TRUE` e `HALF` continuano la streak, `SKIP` è neutro (non interrompe, non conta), `FALSE` o giorno mancante interrompe; i giorni del foglio "sbagliato" (weekend per un'abitudine solo feriale) non contano. Oggi web e Android fanno interrompere anche SKIP e HALF.
- **D2 · Formato cella quantitativa** (0.3): proposta valore nudo nella cella (`6`) con target in `HabitMeta`, così il foglio resta leggibile e sommabile; alternativa `6/8` nella cella.
- **D3 · Mood sul foglio** (0.4): confermi il nuovo foglio `Mood`? Prerequisito per #5 e per avere il mood su più dispositivi.
- **D4 · Push** (4.1): ok a uno scheduler `node-cron` nel container e alla coppia di chiavi VAPID in `.env`? I promemoria serali leggono il foglio con il refresh token già salvato per l'API key dei widget.

Già deciso: niente email, niente pagine pubbliche, sicurezza S2 e GDPR rimandate.

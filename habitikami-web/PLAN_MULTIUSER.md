# Piano: Habitikami Multi-Utente (Plan B)

## Approccio scelto
- **Storage utenti**: File JSON (`data/users.json`) — zero dipendenze extra, persiste tramite volume Docker
- **Onboarding**: Self-service — il nuovo utente incolla il proprio Spreadsheet ID dopo il login
- **`owner@example.com`**: seeded automaticamente con `VITE_SPREADSHEET_ID` dall'env

---

## Architettura risultante

```
Browser                          Server (Express)                  Google
──────                           ────────────────                  ──────
1. Login Google ──code──────────► /api/auth/exchange
                                    verifica code con Google ──────► token
                                    chiede userinfo a Google ───────► { email }
                                    cerca email in users.json
                                    restituisce { access_token, spreadsheet_id, email }
2. Salva in localStorage
3. HabitService usa spreadsheet_id dell'utente
4. Tutte le API calls usano spreadsheet_id dal profilo
```

---

## File da modificare / creare

### Nuovi file
| File | Scopo |
|------|-------|
| `data/users.json` | Registro utenti `{ email → spreadsheet_id }` |
| `src/components/OnboardingPage.tsx` | UI per inserire Spreadsheet ID al primo login |
| `src/context/UserContext.tsx` | React context con `{ email, spreadsheetId }` |

### File modificati
| File | Cosa cambia |
|------|-------------|
| `server.js` | `/api/auth/exchange` restituisce anche `email` + `spreadsheet_id`; nuova route `POST /api/user/spreadsheet`; `/api/export` e `/api/counter/increment` usano spreadsheet dell'utente autenticato |
| `src/services/HabitService.ts` | `SPREADSHEET_ID` diventa variabile d'istanza settabile; `saveSession()` salva anche `spreadsheet_id` e `email`; `tryRestoreSession()` ripristina anche quelli |
| `src/App.tsx` | Aggiunge stato `userProfile`; mostra `OnboardingPage` se `spreadsheet_id` mancante; passa `email` all'header |
| `src/types.ts` | Aggiunge interfaccia `UserProfile` |
| `compose.yml` | Aggiunge volume `./data:/app/data` |
| `Dockerfile` | Crea directory `data/` nel runtime image |

---

## Dettaglio implementazione

### 1. `data/users.json`
```json
{
  "owner@example.com": "YOUR_SPREADSHEET_ID"
}
```
Seeded all'avvio del server se il file non esiste, usando `VITE_SPREADSHEET_ID` + `OWNER_EMAIL` dall'env.

### 2. `server.js` — `/api/auth/exchange`
Dopo lo scambio token, chiama `https://www.googleapis.com/oauth2/v3/userinfo` con l'access_token per ottenere l'email. Cerca l'email in `users.json`. Risponde con:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3599,
  "email": "user@example.com",
  "spreadsheet_id": "..." // null se utente non registrato
}
```

### 3. `server.js` — `POST /api/user/spreadsheet`
Endpoint autenticato (verifica access_token Google) per registrare/aggiornare il proprio spreadsheet_id.
```json
// Body: { "spreadsheet_id": "1abc..." }
// Auth: Bearer <access_token>
```

### 4. `server.js` — `/api/export` e `/api/counter/increment`
Leggono il Bearer token dall'header `Authorization`, verificano l'email con userinfo, cercano il loro `spreadsheet_id` in `users.json`.

### 5. `HabitService.ts`
`SPREADSHEET_ID` diventa `private spreadsheetId: string | null = null`.
`setUserProfile(spreadsheetId, email)` chiamato dopo il login.
Tutte le GAPI calls usano `this.spreadsheetId`.

### 6. `OnboardingPage.tsx`
Mostrata quando `email` c'è ma `spreadsheetId` è null. Input per incollare l'ID del foglio + pulsante salva che chiama `POST /api/user/spreadsheet`.

### 7. `App.tsx`
```
isCheckingSession → tryRestoreSession → { email, spreadsheetId }
  se spreadsheetId null → <OnboardingPage />
  altrimenti → <Dashboard />
```

---

## Sequenza dei passi di implementazione
1. Aggiungere `UserProfile` a `types.ts`
2. Creare `src/context/UserContext.tsx`
3. Modificare `server.js` (users.json, userinfo, nuove route)
4. Modificare `HabitService.ts` (spreadsheetId dinamico, saveSession, tryRestoreSession, auth)
5. Creare `src/components/OnboardingPage.tsx`
6. Modificare `src/App.tsx` (UserContext, onboarding flow, email in header)
7. Aggiornare `compose.yml` e `Dockerfile`
8. Creare `data/users.json` iniziale con il tuo account
9. Aggiungere `data/` al `.gitignore`
10. Scrivere guida utente `NEW_USER_GUIDE.md`

<img src="./assets/banner.svg" alt="Dernier — segnapunti per partite a carte" width="100%">

# Dernier

Segna punti per le partite a carte: anagrafica giocatori, registrazione mano per mano,
statistiche e classifica.

> [!NOTE]
> **Com'è nato questo progetto.** La *struttura* è stata pensata a mano, prima di scrivere
> una riga di codice: il modello dati, la catena `players → games → game_players → hands →
> hand_scores`, le regole di validazione e la forma delle API. È la spina dorsale che regge
> sia le statistiche sia i vincoli di integrità, ed è la ragione per cui il resto si è
> potuto scrivere in fretta.
>
> **Il resto è vibecoding.** Tutto il codice che implementa quello schema è nato in
> pair-programming con un assistente AI, molto "proviamo e vediamo". Trattalo come una base
> solida e leggibile da cui partire, non come un prodotto finito: non ci sono test automatici.

## Come si gioca

1. **Ci si siede al tavolo** — si sceglie chi partecipa alla partita.
2. **Si registra ogni mano** — chi fa `0` vince la mano, tutti gli altri pagano i punti
   delle carte rimaste in mano.
3. **Si chiude la partita** — vince chi ha pagato meno punti in totale.

```text
  ┌───────┐┌───────┐┌───────┐┌───────┐
  │A      ││K      ││Q      ││J      │
  │   ♠   ││   ♥   ││   ♦   ││   ♣   │
  │      A││      K││      Q││      J│
  └───────┘└───────┘└───────┘└───────┘
    paga     paga      paga     vince
```

<img src="./assets/divider.svg" alt="" width="100%">

## Stack

| Componente | Tecnologia               | Ruolo                                  |
|------------|--------------------------|----------------------------------------|
| Frontend   | Vue 3 + Vite + Vuetify 3 | SPA, UI, routing                       |
| Backend    | Node.js + Express + TS   | API REST, logica partite e statistiche |
| Database   | PostgreSQL 16            | Persistenza giocatori, partite, mani   |
| Infra      | Docker + Docker Compose  | Orchestrazione dei servizi             |

Nginx serve i file statici compilati e fa da reverse proxy verso il backend.

## Avvio rapido

Requisiti: Docker e il plugin Docker Compose.

```bash
docker compose up -d
```

Su un server pulito questo comando costruisce già le immagini. Dopo una modifica al
codice serve `docker compose up -d --build`.

L'app risponde su **http://localhost:8080**.

```bash
docker compose ps            # stato dei servizi
docker compose logs -f backend
docker compose down          # ferma tutto (i dati restano nel volume)
```

### Porte

| Servizio | Esposizione                  | Note                                    |
|----------|------------------------------|-----------------------------------------|
| frontend | `127.0.0.1:8080`             | unica porta pubblicata, solo loopback   |
| backend  | interna (`backend:3000`)     | raggiungibile solo da Nginx             |
| db       | interna (`db:5432`)          | raggiungibile solo dal backend          |

Il frontend chiama le API con path relativi (`/api/...`), quindi per il browser esiste
una sola origine: niente CORS e backend non esposto.

## Sviluppo locale

Serve un PostgreSQL raggiungibile su `localhost:5432` (basta avviare il solo servizio
`db` con `docker compose up -d db` e connettersi da fuori).

```bash
# backend — API su http://localhost:3000
cd backend && npm install && npm run dev

# frontend — dev server su http://localhost:5173, con proxy /api verso :3000
cd frontend && npm install && npm run dev
```

Il backend legge `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`
dalle variabili d'ambiente, con default che corrispondono a quelli di docker-compose.
Volendo si possono mettere in un `backend/.env`.

## Deploy dietro Cloudflare Tunnel

L'unica porta pubblicata è la loopback, quindi il tunnel può puntarci direttamente:

```yaml
ingress:
  - hostname: dernier.ghibiri.it
    service: http://localhost:8080
  - service: http_status:404
```

Nginx ascolta sulla 8080 (non sulla 80) sia dentro sia fuori dal container.

## Struttura

```
.
├── docker-compose.yml
├── backend/
│   ├── Dockerfile              # build multi-stage: tsc → dist, poi solo dipendenze di produzione
│   └── src/
│       ├── index.ts            # app Express, health check, gestione errori
│       ├── db/
│       │   ├── pool.ts
│       │   └── schema.sql      # creato al primo avvio del container Postgres
│       ├── routes/             # players.ts, games.ts, hands.ts
│       └── utils/              # HttpError, asyncHandler, parseId
└── frontend/
    ├── Dockerfile              # build multi-stage: vite → nginx
    ├── nginx.conf              # SPA fallback + proxy /api
    └── src/
        ├── api/client.ts       # wrapper fetch tipizzato
        ├── components/         # GameSummaryCard, PlayerCard, HandForm, ...
        ├── views/              # Home, Players, NewGame, GameDetail
        ├── plugins/vuetify.ts  # tema scuro verde/oro
        └── types.ts
```

<img src="./assets/divider.svg" alt="" width="100%">

## API

| Metodo | Endpoint                        | Descrizione                                      |
|--------|---------------------------------|--------------------------------------------------|
| GET    | `/api/health`                   | Stato del servizio e del database                |
| GET    | `/api/players`                  | Lista giocatori (`?include_inactive=true`)       |
| POST   | `/api/players`                  | Crea giocatore                                   |
| PUT    | `/api/players/:id`              | Modifica nome e/o stato attivo                   |
| DELETE | `/api/players/:id`              | Disattivazione logica (lo storico resta)         |
| GET    | `/api/players/:id/stats`        | Mani vinte, partite giocate/vinte, punti pagati  |
| GET    | `/api/games?limit=10`           | Ultime partite                                   |
| GET    | `/api/games/:id`                | Dettaglio: giocatori, mani, classifica           |
| POST   | `/api/games`                    | Crea partita con `{ player_ids: [...] }`         |
| PATCH  | `/api/games/:id/finish`         | Chiude la partita e calcola i totali             |
| POST   | `/api/games/:id/hands`          | Registra una mano con `{ scores: [...] }`        |

## Regole applicate dal backend

Le regole stanno nel backend, non solo nella UI.

- Una mano ha **esattamente un** giocatore con `points = 0`: è il vincitore.
- I punteggi devono coprire **tutti e soli** i giocatori della partita.
- Non si possono registrare mani su una partita già chiusa.
- La partita si chiude solo con almeno una mano giocata.
- Vince chi ha pagato **meno punti** in totale; a parità, chi ha vinto più mani, poi
  l'ID più basso.
- `DELETE /api/players/:id` disattiva, non cancella: i riferimenti storici restano validi.

Tutto ciò che tocca più tabelle (creazione mano, chiusura partita, creazione partita)
gira in una transazione con `SELECT ... FOR UPDATE` sulla riga della partita.

## Schema del database

```
players (id, name, created_at, is_active)
games   (id, started_at, ended_at, status, winner_id, total_points, total_hands)
          │
          ├── game_players (id, game_id, player_id, seat_order)
          └── hands (id, game_id, hand_number, winner_id)
                    └── hand_scores (id, hand_id, player_id, points)
```

`total_points` e `total_hands` vengono scritti alla chiusura della partita, ma l'API
li ricalcola in lettura dalle mani: così anche le partite in corso mostrano numeri
coerenti.

`schema.sql` viene eseguito da Postgres **una sola volta**, al primo avvio su volume
vuoto. Se modifichi lo schema, la modifica va applicata a mano al database esistente.

<img src="./assets/divider.svg" alt="" width="100%">

<sub>Vue 3 · Express · PostgreSQL · Docker — e una quantità sospetta di vibecoding.</sub>


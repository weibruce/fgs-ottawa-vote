# FGS Ottawa Vote — Officer Election Voting System

A self-hosted voting system for the Buddha's Light Temple (Ottawa) officer re-election. Members vote over HTTPS (phone / WeChat) on an on-site Wi-Fi network; admins manage the election through a web back office.

> 中文版本：[README.zh.md](README.zh.md)

## Features

- **Two-round voting by division** — the temple is split into 5 divisions (East / South / West / North / Central). Round 1 is division-based; the top candidate in each division becomes that division's chairperson / vice-chairperson. Round 2 covers the remaining temple-wide officer posts. A runoff (tie re-vote) is supported at the division level.
- **Officer appointments** — after the rounds are confirmed, winners are appointed and the roster is locked in the admin back office.
- **Identity verification** — voters enter name + FGS member card number. Names are normalized with OpenCC (Simplified/Traditional Chinese) before matching. The card number routes the voter to their division's candidate page. Duplicate voting is blocked (division + card number).
- **Proxy voting** — a checkbox lets a member cast a proxy vote on behalf of another member.
- **Real-time tally** — per-division results are served from Redis counters (with PostgreSQL backfill), polled every 2 seconds by the voter screen and the admin back office.
- **Single entry point** — one URL + one QR code for all five divisions, displayed on the venue screen; the system routes each voter to the right division.
- **Member list import** — Excel/CSV import (card number, name, division), template download, deduplication, and traditional/simplified dual storage of names.
- **Data export** — CSV / XLSX exports (members, votes, results, appointments) with anonymous masking, BOM for Excel, and Chinese filenames.
- **Admin back office** — 10 modules: dashboard, divisions, candidates, members, vote configuration, live tally, rounds, officer appointments, data export, settings.
- **Security** — admin JWT auth (bcrypt), forced password change on first login, write-lock on member/vote data while a round is open.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 18 |
| Cache / counters | Redis 8 |
| Name normalization | OpenCC (Simplified/Traditional) |
| Voter frontend | React 19 + Vite 8 + Tailwind CSS 4 + Recharts |
| Admin frontend | React 19 + Vite 8 + Tailwind CSS 4 |
| Reverse proxy | Nginx (HTTPS termination) — production only |

## Repository Layout

```
fgs-ottawa-vote/
├── backend/                  # FastAPI service (API + models + migrations)
│   ├── app/                  #   entry, config, models, schemas, services, routers
│   ├── alembic/              #   DB migrations
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── seed_demo.py          #   demo seed data (5 divisions / 300 members / 15 candidates / 203 votes)
│   └── README.md
├── frontend/
│   ├── voter/                # voter app (React + Vite, port 5173, proxies /api → :8000)
│   └── admin/                # admin back office (React + Vite)
├── scripts/
│   ├── start_all.sh          # one-command start/stop/status for PG + Redis + API
│   ├── pgctl.sh              # PostgreSQL control
│   └── redisctl.sh           # Redis control
├── docs/                     # design documents (Chinese)
│   ├── 01_requirements.md    #   requirements v1.1
│   ├── 02_architecture.md    #   architecture v1.1
│   ├── 03_dev_plan.md        #   development plan & progress
│   ├── 04_frontend_plan.md
│   └── 05_api_contract.md    #   API contract
└── img/
```

## Quick Start

The dev environment is set up for a **no-root, no-Docker** host: PostgreSQL and Redis are installed via `apt-get download` + `dpkg-deb -x` extraction and run locally (details in [docs/03_dev_plan.md](docs/03_dev_plan.md)).

### Prerequisites

- Python 3.14 with a virtualenv (backend uses `.venv`)
- Node.js 20+ (frontends)
- PostgreSQL 18 and Redis 8 data directories (see `scripts/pgctl.sh` / `scripts/redisctl.sh`)

### 1. Start the stack

```bash
# PostgreSQL + Redis + FastAPI (port 8000)
bash scripts/start_all.sh start

# check status / stop
bash scripts/start_all.sh status
bash scripts/start_all.sh stop
```

The script runs a health check on startup:

```
curl http://127.0.0.1:8000/api/health
```

### 2. Initialize the database

```bash
cd backend
.venv/bin/alembic upgrade head      # create tables
.venv/bin/python -m app.init_db     # create admin + 5 divisions
```

### 3. (Optional) Load demo data

```bash
cd backend
.venv/bin/python seed_demo.py
```

Seeds 5 divisions, 300 members, 15 candidates, 203 votes, a tie in the South division, and East-division appointments — for development and demonstration.

### 4. Run the frontends

```bash
# Voter app (http://localhost:5173, proxies /api to the backend)
cd frontend/voter
npm install
npm run dev

# Admin back office
cd frontend/admin
npm install
npm run dev
```

Vite dev servers bind to `0.0.0.0` so phones on the same LAN can open `http://<host-ip>:5173` directly. The API proxy target can be overridden with `API_PROXY_TARGET` (e.g. `API_PROXY_TARGET=http://127.0.0.1:8011 npm run dev`).

### 5. Log in

- Admin: `admin` / `admin123` — **password change is forced on first login**
- Voter: no account needed — scan the QR / open the link, then enter name + card number

## Key URLs

| What | URL |
|------|-----|
| API (dev) | http://127.0.0.1:8000 |
| Swagger docs | http://127.0.0.1:8000/docs |
| Health check | http://127.0.0.1:8000/api/health |
| Voter app (dev) | http://localhost:5173 |
| Vote screen (all 5 divisions) | http://localhost:5173/screen |
| Admin back office (dev) | http://localhost:5173 (admin build) |

In production, Nginx terminates HTTPS and routes: `/` → voter app, `/admin` → admin back office, `/api/*` → FastAPI.

## API Overview

Full contract: [docs/05_api_contract.md](docs/05_api_contract.md).

**Admin** (JWT required, `Authorization: Bearer <token>`):

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/admin/login | Login → JWT |
| POST | /api/admin/change-password | Change password |
| GET | /api/admin/dashboard/summary | Dashboard aggregates (turnout, proxy rate, per-division progress) |
| GET/POST/PUT/DELETE | /api/admin/divisions[...] | Division CRUD + overview |
| GET/POST/PUT/DELETE | /api/admin/candidates[...] | Candidate CRUD (per round/division) |
| GET/POST/PUT/DELETE | /api/admin/members[...] | Member CRUD, `/stats`, Excel/CSV import, template |
| GET/PUT | /api/admin/settings | Voting parameters + activity log |
| GET | /api/admin/settings/qr | Entry QR code |
| GET | /api/admin/tally, /admin/tally/overview, /admin/tally/voters | Live tally (anonymized) |
| GET/POST | /api/admin/rounds/{id}/progress, /runoff | Round progress + runoff |
| GET/POST/PUT/DELETE | /api/admin/appointments[...] | Officer appointments + confirm/lock |
| GET | /api/admin/exports/{kind}, /history, /download | CSV/XLSX exports |

**Voter** (public):

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/votes/confirm | Identity check (name + card) → voter token |
| POST | /api/votes/submit | Submit vote (1–2 candidates, division-checked) |
| GET | /api/votes/results/{round_id} | Real-time results |

## Configuration

`backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://fgs_app:fgs_vote_2026@127.0.0.1:5432/fgs_vote
REDIS_URL=redis://:fgs_redis_2026@127.0.0.1:6379/0
JWT_SECRET=...
JWT_EXPIRE_MINUTES=1440
```

Database: `fgs_vote` (UTF-8), application user `fgs_app`.

## Development Status

M1 (framework), M2 (core voting), and M3 (admin API + back-office wiring) are complete; the admin back office is fully connected to real APIs. M4 (hardening & deployment: security, load testing, Nginx, backup, rehearsal) is in progress. See [docs/03_dev_plan.md](docs/03_dev_plan.md) for the full plan and progress.

## License

Internal project — not for public distribution.

# Team Task Manager

Production-oriented full-stack app for teams to manage projects and tasks with **role-based access** (Admin vs Member), **JWT auth** (httpOnly cookie), **PostgreSQL** via **Prisma ORM**, and a **Next.js 15 (App Router)** UI (Tailwind, shadcn/ui).

## Features

- **Authentication**: Sign up (Member role), login, logout, JWT in httpOnly cookie, middleware-protected routes.
- **Dashboard**: Totals (all tasks / completed / pending / overdue), progress bar, recent projects, task table, admin **activity log**.
- **Projects** (Admin): create, edit, delete; add/remove members by email. **Members**: view projects they belong to.
- **Tasks** (Admin): full CRUD, assign to project members, filters (status, priority, project), search, pagination.
- **Tasks** (Member): see **assigned** tasks only; **status** updates only on own tasks.
- **UX**: Responsive layout with sidebar + mobile sheet, dark mode (next-themes), toasts, loading and empty states.

## Tech stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, React Hook Form, Zod, Axios.
- **Backend**: Next.js Route Handlers (REST), `jsonwebtoken` + `jose` (Edge middleware), bcrypt password hashing.
- **Database**: PostgreSQL, Prisma 7 (driver adapter + `pg`).
- **Deploy**: Documented for **Railway** (Postgres + web service).

## Project structure (high level)

```text
src/
  app/                 # App Router pages + api/** route handlers
  components/          # UI + layout
  generated/prisma/    # Prisma client (gitignored)
  lib/                 # prisma, auth, validations, api client, helpers
  middleware.ts        # JWT gate for app routes + auth redirect
  types/
prisma/
  schema.prisma
  seed.ts
  migrations/
```

## Prerequisites

- Node.js 20+
- Docker (optional, for local Postgres — see `docker-compose.yml` on port **5536**)

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string for HS256 signing |
| `NEXT_PUBLIC_API_URL` | Public app URL (e.g. `http://localhost:3000` locally, your Railway URL in prod). Use empty string or same origin if the browser calls APIs on the same host. |

## Local setup

```bash
npm install
cp .env.example .env
# Start Postgres (maps host 5536 → container 5432)
npm run docker:db
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Seed accounts**

- **Admin**: `admin@example.com` / `Admin123!`
- **Member**: `member@example.com` / `Member123!`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build & run |
| `npm run docker:db` | `docker compose up -d` |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed demo data |
| `npm run postinstall` | `prisma generate` |

## REST API

All JSON APIs expect appropriate auth cookie unless noted.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/signup` | Body: `{ name, email, password }` — creates **Member**, sets cookie |
| `POST` | `/api/auth/login` | Body: `{ email, password }` |
| `POST` | `/api/auth/logout` | Clears cookie |

### Projects

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/api/projects` | Member: member projects; Admin: all |
| `POST` | `/api/projects` | Admin |
| `GET` | `/api/projects/:id` | Project member or Admin |
| `PUT` | `/api/projects/:id` | Admin |
| `DELETE` | `/api/projects/:id` | Admin |
| `POST` | `/api/projects/:id/members` | Body `{ email }` — Admin |
| `DELETE` | `/api/projects/:id/members/:userId` | Admin (cannot remove owner) |

### Tasks

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/tasks` | Query: `page`, `limit`, `status`, `priority`, `search`, `projectId` |
| `POST` | `/api/tasks` | Admin; assignee must be project member |
| `PUT` | `/api/tasks/:id` | Admin full update; Member only `{ status }` on own task |
| `DELETE` | `/api/tasks/:id` | Admin |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard/stats` | Scoped stats + recent projects/tasks; admin gets `recentActivity` |

**Errors**: `400` validation (`issues` from Zod flatten), `401` unauthorized, `403` forbidden, `404` not found, `409` conflict.

## Railway deployment

1. Create a **PostgreSQL** plugin on Railway; copy its `DATABASE_URL`.
2. Create a **new service** from this repo (GitHub deploy or `railway up`).
3. Set variables on the **web** service:
   - `DATABASE_URL` — from Railway Postgres
   - `JWT_SECRET` — generate a strong secret (e.g. `openssl rand -base64 48`)
   - `NEXT_PUBLIC_API_URL` — your public Railway URL, e.g. `https://your-app.up.railway.app` (no trailing slash)
4. **Build command**: `npm run build` (default). **Start command**: `npm run start`.
5. After first deploy, run migrations against the production DB (Railway CLI or one-off command):

   ```bash
   DATABASE_URL="…from railway…" npx prisma migrate deploy
   DATABASE_URL="…" npx prisma db seed   # optional demo data
   ```

6. Ensure the service ** exposes HTTP** on the port Railway provides (`PORT` is set automatically; Next listens on it when started).

## Security notes

- Passwords hashed with bcrypt (12 rounds on signup; verify on login).
- JWT stored in **httpOnly** cookie; middleware uses **jose** on the Edge.
- Inputs validated with **Zod** on APIs.
- Prisma parameterizes queries; avoid raw SQL with user input.

## Screenshots

_Add screenshots of Dashboard, Projects, Tasks, and mobile nav after your first deploy and place them in e.g. `docs/screenshots/` — then link them here in your fork._

## License

Private / use per your organization.

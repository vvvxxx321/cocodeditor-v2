# Real-Time Collaborative Developer Platform

A browser-based code editor where team members edit the same files at the same time, chat, keep a version history, and run code in more than a dozen languages.

## Overview

Sharing code through commits and pull requests works well asynchronously, but it is slow when a few people want to work on the same file together — pairing, reviewing, teaching or debugging. This application gives a team a shared workspace in the browser:

- Users sign up, create or join a **team**, and create **projects** inside it.
- Opening a file in a project gives every collaborator a live, shared Monaco (VS Code) editor with remote cursors.
- Teammates see who is online and can message each other directly.
- Files can be snapshotted and restored, and code can be executed remotely through Judge0, without any local toolchain.

## Project Background and V2 Evolution

This repository is **V2** of [cocodeditor](https://github.com/vvvxxx321/cocodeditor), a real-time collaborative code editor originally built collaboratively by a two-person team. V1 established the product: Supabase authentication, teams and projects, a Monaco-based editor, Socket.IO chat and presence, and Judge0 code execution.

V2 is an engineering upgrade of that foundation. The user-facing product is largely the same; the work focused on what happens underneath when several people use it at once:

| Area | V1 | V2 |
|---|---|---|
| Concurrent editing | Whole file content broadcast over Socket.IO on each change; last writer wins | Yjs CRDT updates through a dedicated Hocuspocus server; concurrent edits merge |
| Persistence | Each keystroke written to `File.content` | Debounced, merge-on-write storage of the CRDT state plus a plain-text copy |
| Version history | — | Snapshots taken from the live document; restore applied as a forward edit |
| Authorization | Mostly client-side; client-supplied user ids trusted | Server-verified Supabase JWTs and team RBAC on REST, Socket.IO and the collab server |
| Code execution | Synchronous request that polled Judge0 inside the HTTP handler; host-shell endpoints | Durable, idempotent jobs on BullMQ processed by a separate worker; host execution removed |
| Scaling | Presence and chat history in process memory | Socket.IO Redis adapter, presence from room membership, chat history in Redis |
| Testing | Manual | Integration tests against real Postgres/Redis, browser E2E, GitHub Actions CI |

## Key Features

- **Real-time collaborative editing** — Monaco is bound to a Yjs document per file (`y-monaco`); remote cursors and selections use Yjs awareness.
- **Concurrent edit synchronization** — simultaneous inserts at the same position, random concurrent edits and offline edits converge on every client.
- **Persistent document state** — the CRDT state is stored in PostgreSQL and survives collab server restarts; V1 plain-text files are converted to Yjs on first open.
- **Version history** — manual snapshots, periodic automatic snapshots, and restore. Restoring is applied to the live document, so everyone connected sees it immediately.
- **Team authentication and role-based authorization** — Supabase email/password and OAuth (GitHub, Google) sign-in; `OWNER` / `ADMIN` / `MEMBER` / `VIEWER` roles enforced on the server. Viewers get a read-only editor and the server discards any edits they send.
- **Real-time communication** — direct messages with typing indicators, online/offline presence, and live file-tree updates over Socket.IO.
- **Multi-language code execution** — C, C++, Java, Python, JavaScript, TypeScript, Go, Rust, Ruby, PHP, C#, Kotlin and Swift via Judge0, with stdin, compile output and execution history.
- **Asynchronous execution and failure handling** — idempotent submissions, bounded retries with exponential backoff, timeouts, crash recovery, and a reconciler for jobs whose enqueue never succeeded.
- **Operational basics** — structured JSON logs with request ids and credential redaction, `/healthz` and `/readyz` probes.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Monaco Editor, React Router, Jotai/Zustand |
| Backend API | Node.js, Express, TypeScript, Prisma ORM, pino |
| Real-time collaboration | Yjs, Hocuspocus (server + provider), y-monaco |
| Real-time messaging | Socket.IO with `@socket.io/redis-adapter` |
| Storage | PostgreSQL (application data, CRDT state, versions, execution jobs), Redis (adapter pub/sub, chat history, job queue) |
| Job processing | BullMQ on Redis |
| External services | Supabase Auth, Judge0 (RapidAPI-hosted CE or self-hosted) |
| Testing / CI | Vitest, Supertest, Playwright, GitHub Actions |

## Architecture

The backend runs as three separate Node.js processes, all from the `backend/` package:

```
                      ┌──────────────────────────┐
                      │   Browser (React/Vite)   │
                      │ Monaco + y-monaco        │
                      └──┬──────────┬─────────┬──┘
           REST (JWT)    │          │ WS      │ WS (Yjs sync, JWT)
                         ▼          ▼         ▼
             ┌────────────────────────┐   ┌──────────────────────┐
             │ API server             │   │ Collab server        │
             │ Express + Socket.IO    │──▶│ Hocuspocus (Yjs)     │
             │ npm start              │   │ npm run collab       │
             └──┬──────────┬──────────┘   └─────────┬────────────┘
                │          │ adapter / chat /       │
                │          │ enqueue                │
                │          ▼                        │
                │     ┌─────────┐   ┌────────────────────────┐
                │     │  Redis  │◀─▶│ Execution worker       │──▶ Judge0
                │     └─────────┘   │ BullMQ, npm run worker │
                ▼                   └───────────┬────────────┘
           ┌──────────────────────────────────────────────┐
           │ PostgreSQL (Prisma)                          │
           └──────────────────────────────────────────────┘
```

**Collab server (Yjs / Hocuspocus)** — `backend/src/collab`. Owns document content. Each file is a Yjs document named `file:<fileId>`, synchronized over its own WebSocket server, not over Socket.IO. On connect it verifies the user's Supabase token and resolves their team role; viewers are marked read-only. Document state is loaded from and stored to PostgreSQL. It also exposes an internal HTTP endpoint, protected by a shared secret, that the API calls for snapshot and restore so they operate on the live in-memory document.

**API server (Express + Socket.IO)** — `backend/src/index.ts`. REST endpoints for teams, projects, files, versions and executions, each behind JWT authentication and an RBAC check. Socket.IO handles the non-document real-time traffic: presence, the project file list, file/folder creation events, direct messages and typing indicators. It no longer carries document edits.

**Redis** — three separate uses: (1) the Socket.IO Redis adapter, so room broadcasts and presence queries span all API instances; (2) shared, capped chat history; (3) the BullMQ queue. Scaling the API with the adapter does **not** scale the collab server — Hocuspocus is a separate process and currently runs as a single instance.

**PostgreSQL** — the durable source of truth: profiles, teams, memberships, projects, files, the Yjs state per file (`FileDocument`), versions (`FileVersion`) and execution jobs (`ExecutionJob`).

**Execution worker (BullMQ)** — `backend/src/worker`. Consumes execution jobs, submits code to Judge0, polls for the result and writes it to the job row. The API only creates the row and enqueues it; clients poll `GET /api/executions/:id`.

**Judge0** — the sandbox that actually compiles and runs user code. The application never executes user code on its own hosts.

## Key Engineering Decisions

**1. Whole-document sync was not safe for concurrent editing.** V1 sent the full file content on each change and stored whatever arrived last. When two people typed at once, one person's edits overwrote the other's, and every keystroke caused a database write.

**2. Yjs for document synchronization.** Yjs is a CRDT: clients exchange small updates that merge deterministically in any order, so concurrent and offline edits converge without a central lock. Hocuspocus provides the WebSocket server, auth hook and persistence hooks, and `y-monaco` binds the editor. Running it as a separate process keeps document traffic independent from the API.

**3. Redis for Socket.IO across instances.** V1 kept online users and chat history in in-process maps, which are wrong as soon as there are two API processes. With the Redis adapter, broadcasts reach sockets on every instance, presence is derived from room membership queried across instances, and chat history lives in Redis.

**4. Asynchronous execution through BullMQ.** Holding an HTTP request open while polling Judge0 ties up the API under load and loses the work if the process restarts. Now the request is persisted first, then queued. A separate worker pool handles Judge0 latency, retries and timeouts, and can be scaled on its own.

**5. Authentication, authorization, persistence and recovery.**
- *Auth*: Supabase access tokens are verified server-side (JWKS for asymmetric keys, the legacy HS256 secret where configured, or a Supabase `getUser` fallback). The same verifier is used by Express, Socket.IO and Hocuspocus, and identity always comes from the token, never from request payloads.
- *Authorization*: every project and file access is resolved to the caller's team role. Missing and inaccessible resources both return 404 so that resource ids do not leak.
- *Persistence*: document stores are debounced and use merge-on-write (`SELECT … FOR UPDATE`, then merge with the stored CRDT state), so a slower writer cannot regress a document. Restores are applied as new edits, not by replacing state, so connected clients keep their history.
- *Execution recovery*: each execution uses a client-supplied `Idempotency-Key` and its job id equals the row id, so retries do not create duplicates. Retryable Judge0 errors (network, 429, 5xx) back off and retry; 4xx errors fail without retry. Once a Judge0 token is stored, a restarted worker resumes polling instead of resubmitting. A crash in the short window between submission and storing the token can cause a second Judge0 submission (at-least-once execution), but never a second result row.

## Getting Started

### Prerequisites

- Node.js 22 and npm
- PostgreSQL 16
- Redis 7 (the `redis-server` binary is also needed by the backend test suite)
- A [Supabase](https://supabase.com) project for sign-in
- Judge0 access to run code: a RapidAPI key for Judge0 CE, or a self-hosted Judge0 instance

### 1. Install

```bash
git clone https://github.com/vvvxxx321/cocodeditor-v2.git
cd cocodeditor-v2
(cd backend && npm ci)
(cd frontend && npm ci)
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL connection strings |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Token verification (JWKS) and the `getUser` fallback |
| `SUPABASE_JWT_SECRET` | Only for Supabase projects still on the legacy HS256 signing secret |
| `REDIS_URL` | Socket.IO adapter, chat history, BullMQ |
| `COLLAB_PORT`, `COLLAB_INTERNAL_URL`, `COLLAB_INTERNAL_SECRET` | Collab server port and the shared secret for API → collab calls (set any long random value) |
| `CORS_ORIGINS` | Allowed frontend origins |
| `JUDGE0_API_URL` plus `JUDGE0_API_KEY`/`JUDGE0_API_HOST` (RapidAPI) or `JUDGE0_AUTH_TOKEN` (self-hosted) | Judge0 access |

`frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (API server), `VITE_COLLAB_URL` (collab WebSocket).

### 3. Set up the database

```bash
cd backend
npx prisma migrate deploy
```

The backend keeps a `Profile` row for each Supabase user. If `DATABASE_URL` points at your Supabase project's Postgres database, run [`user_profile_function.sql`](user_profile_function.sql) in the Supabase SQL editor. It adds a trigger that creates the `Profile` row on sign-up.

### 4. Run

Start each process in its own terminal:

```bash
cd backend && npm start          # API + Socket.IO   (http://localhost:3000)
cd backend && npm run collab     # Hocuspocus / Yjs  (ws://localhost:1234)
cd backend && npm run worker     # BullMQ execution worker
cd frontend && npm run dev       # Vite dev server   (http://localhost:5173)
```

## Testing

**Backend integration tests** (Vitest) run against a real local PostgreSQL test database and Redis. They start the collab server, API instances and workers in-process or as child processes, and use a fake Judge0 server and a per-run random JWT secret, so no external credentials are needed.

```bash
createdb cocodeditor_v2_test
cd backend
DATABASE_URL=postgresql://$USER@localhost:5432/cocodeditor_v2_test npx prisma migrate deploy
npm run typecheck
npm test
```

Defaults are `postgresql://$USER@localhost:5432/cocodeditor_v2_test` and `redis://127.0.0.1:6379/15`; override them with `TEST_DATABASE_URL` / `TEST_REDIS_URL`. The test helpers refuse to reset any database whose name does not contain `_test`. Coverage includes:

- token verification and RBAC on REST, Socket.IO and the collab server
- CRDT convergence under concurrent and offline edits, durability across restarts, and V1 → V2 bootstrap races
- version snapshot numbering under concurrency, and live restore
- the execution pipeline: idempotency, retry/backoff, permanent failures, timeouts, Redis outage at enqueue, and worker `SIGKILL` recovery
- Socket.IO across two instances with the Redis adapter, plus a negative control with the adapter off

**Browser E2E tests** (Playwright) start isolated API, collab, worker and Vite processes plus a fake Judge0 and a dedicated `cocodeditor_v2_e2e` database. They cover two browsers editing one file, snapshot/restore reaching both editors, and running code from the UI.

```bash
cd frontend
npx playwright install chromium
npx playwright test
```

**Optional manual checks** (they use `backend/.env` and seed throwaway rows in the configured database):

```bash
cd backend
npx tsx scripts/verify-multi-instance.ts   # two separate API processes sharing Redis
npx tsx scripts/verify-judge0.ts           # real Judge0 end to end (needs Judge0 credentials)
```

**CI** (`.github/workflows/ci.yml`) runs the backend type check and tests with Postgres and Redis service containers, the frontend production build, and the Playwright suite.

## Known Limitations

- **Supabase sign-in is not covered by automated tests.** Tests mint tokens locally with the HS256 path. The JWKS and `getUser` paths, OAuth providers and email verification need a real Supabase project and have not been tested here.
- **Real Judge0 execution needs credentials.** Automated tests use a fake Judge0 that follows its HTTP API. `scripts/verify-judge0.ts` checks a real instance when credentials are provided.
- **The collab server is a single instance.** The Redis adapter scales Socket.IO only. Running multiple Hocuspocus instances would need document-level routing or a Hocuspocus Redis extension, which is not implemented.
- **Unsaved edits can be lost if the collab server crashes.** Edits made since the last debounced store (a few seconds under continuous typing; tunable via `COLLAB_DEBOUNCE_MS` / `COLLAB_MAX_DEBOUNCE_MS`) exist only in its memory. Connected clients still hold them and resync on reconnect.
- **Code may run twice in one crash case.** A worker crash between Judge0 accepting a submission and the token being stored causes a resubmission. Judge0 offers no client idempotency key.
- **The frontend type check is not clean.** `tsc -b` reports type errors carried over from V1 UI code. The production build (`vite build`) succeeds, and CI uses it as the frontend gate.
- **The profile/avatar page depends on Supabase resources not set up here.** It reads a Supabase `profiles` table and an `avatars` storage bucket, inherited from V1, which this repository does not create.
- **No production deployment or load figures are claimed.** The project runs locally and in CI.

## Original Project

V1: **[github.com/vvvxxx321/cocodeditor](https://github.com/vvvxxx321/cocodeditor)** — the original collaborative code editor that this version builds on. V2 is published as a separate repository, and V1 is unchanged.

# Local-First Collaborative Document Editor

A production-ready, offline-capable collaborative document editor built for the **House of Edtech Fullstack Developer Assignment 2 (April 2026)**.

## Features

- **Local-first architecture** — Documents live in IndexedDB via Yjs CRDT; typing never waits on the network
- **Offline support** — Changes queue locally with exponential backoff retry when back online
- **Deterministic conflict resolution** — Yjs CRDT merges concurrent edits without data loss
- **Version history & time travel** — Manual snapshots with safe CRDT merge on restore
- **Real-time collaboration** — WebSocket sync (y-websocket) with live presence avatars
- **Role-based access** — Owner, Editor, Viewer (viewers cannot push changes)
- **Rich text editing** — BlockNote editor with markdown support
- **AI assistant** — Summarize, improve, generate, grammar fix (Groq/OpenAI)
- **Dark mode UI** — Tailwind CSS + shadcn/ui + Radix UI

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Database | PostgreSQL + Drizzle ORM + Row Level Security |
| Auth | Auth.js (NextAuth v5) — Credentials + Google OAuth |
| Local storage | IndexedDB (`idb`) + `y-indexeddb` |
| CRDT / Sync | Yjs + y-websocket |
| State | Zustand |
| AI | Vercel AI SDK + Groq/OpenAI |
| Tests | Vitest |

## Repository Structure

```
local-first-document-editor/
├── drizzle/                 # SQL migrations + RLS policies
├── server/
│   └── ws-server.ts         # Yjs WebSocket server (separate process)
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   │   ├── api/
│   │   │   ├── auth/        # NextAuth + registration
│   │   │   ├── documents/   # CRUD, members, snapshots
│   │   │   ├── sync/        # HTTP sync endpoint (offline queue flush)
│   │   │   └── ai/          # AI assistant
│   │   ├── dashboard/
│   │   ├── editor/[id]/
│   │   ├── login/
│   │   └── register/
│   ├── components/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── editor/          # BlockNote, sidebars, presence
│   │   ├── layout/
│   │   └── ui/              # shadcn components
│   ├── hooks/
│   ├── lib/
│   │   ├── db/              # Drizzle schema, queries, RLS context
│   │   ├── sync/            # Offline queue + sync engine
│   │   └── yjs/             # Document session (CRDT lifecycle)
│   └── stores/              # Zustand stores
└── tests/
    └── sync.test.ts         # CRDT merge + retry logic tests
```

## Setup

### Prerequisites

- Node.js 20.9+
- PostgreSQL 14+
- npm 10+

### 1. Clone & install

```bash
git clone <your-repo-url>
cd local-first-document-editor
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/doceditor
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:1234
WS_PORT=1234

# Optional
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
GROQ_API_KEY=
```

### 3. Database setup

```bash
# Create database
createdb doceditor

# Run migration
psql $DATABASE_URL -f drizzle/0000_init.sql

# Enable Row Level Security
psql $DATABASE_URL -f drizzle/rls.sql
```

Or with Drizzle Kit:

```bash
npm run db:push
psql $DATABASE_URL -f drizzle/rls.sql
```

### 4. Run development

```bash
# Starts Next.js + WebSocket server concurrently
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run tests

```bash
npm test
```

## Deployment

### Vercel (Next.js app)

1. Push to GitHub and import in Vercel
2. Set environment variables from `.env.example`
3. Connect PostgreSQL (Neon, Supabase, or Vercel Postgres)

> **Note:** WebSockets are not supported on Vercel serverless. Deploy the WebSocket server separately:

### WebSocket server (Railway / Fly.io / Render)

```bash
npm run ws:start
```

Set `NEXT_PUBLIC_WS_URL=wss://your-ws-server.example.com` in Vercel env.

## Architecture Decisions

### Local-first sync

```
┌─────────────┐     instant      ┌──────────────┐
│  BlockNote  │ ◄──────────────► │  Yjs Y.Doc   │
│   Editor    │                  │  (in-memory) │
└─────────────┘                  └──────┬───────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             y-indexeddb          y-websocket           HTTP /api/sync
             (offline)           (real-time)           (durability)
                    │                   │                   │
                    └───────────────────┴───────────────────┘
                                        ▼
                                 PostgreSQL
                              (updates + snapshots)
```

1. **All edits apply locally first** to the Yjs document — zero UI blocking
2. **y-indexeddb** persists the Y.Doc in the browser for offline access
3. **y-websocket** propagates changes to other collaborators in real time
4. **HTTP sync API** durably stores Yjs binary updates in PostgreSQL for recovery and offline queue flush
5. **Offline queue** (IndexedDB via `idb`) holds failed pushes with exponential backoff retry

### Conflict resolution

Yjs is a CRDT (Conflict-free Replicated Data Type). When two users edit the same document offline:

- Each client accumulates Yjs updates locally
- On reconnect, updates merge **deterministically** — same result on all clients
- No operational transform complexity; no "last write wins" data loss
- Snapshot restore uses CRDT merge: `apply(snapshot) → apply(liveState)` preserves both histories

### Versioning strategy

- **Manual snapshots** capture `Y.encodeStateAsUpdate(doc)` + state vector
- Stored in PostgreSQL as binary blobs with metadata (name, author, timestamp)
- **Restore** merges snapshot into live doc via Yjs — active collaborators see merged state
- Timeline sidebar shows all snapshots with one-click restore

### Security

- Auth.js session validation on every API route
- Zod schema validation on sync payloads (size limits, UUID checks)
- Rate limiting on sync endpoints (120 req/min default)
- PostgreSQL RLS policies enforce document membership at DB level
- Viewers blocked from POST `/api/sync` at application layer

## Challenges Faced

1. **WebSocket on Vercel** — Serverless functions don't support persistent WebSocket connections; solved with a separate `ws-server.ts` deployable to Railway/Fly.io
2. **Snapshot restore during live collaboration** — Naive replace would overwrite live edits; CRDT merge preserves both snapshot and concurrent changes
3. **Offline queue ordering** — Updates sorted by logical clock before flush to maintain consistency
4. **BlockNote + Yjs binding** — BlockNote's collaboration API expects a y-websocket provider and XmlFragment; DocumentSession encapsulates this lifecycle

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List user's documents |
| POST | `/api/documents` | Create document |
| GET/PATCH/DELETE | `/api/documents/[id]` | Document CRUD |
| GET/POST | `/api/sync` | Pull/push Yjs updates |
| GET/POST/PUT | `/api/documents/[id]/snapshots` | Version history |
| GET/POST | `/api/documents/[id]/members` | Share & roles |
| POST | `/api/ai` | AI assistant actions |

## License

MIT

---

Built by **Your Name** · [GitHub](https://github.com/yourusername) · [LinkedIn](https://linkedin.com/in/yourprofile)

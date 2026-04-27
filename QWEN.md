# QWEN.md — IT-Eco-For-SP

## Project Overview

**IT-Eco-For-SP** is an educational ecosystem for students featuring an AI assistant, competitive programming platform integrations (Codeforces & AtCoder), and a unified rating system.

### Key Features
- 🤖 **AI Assistant** — RAG-powered chat using RouterAI API (Qwen model)
- 📊 **Competitive Programming Integration** — Codeforces and AtCoder rating tracking with a unified combined score
- 📅 **Contest Calendar** — Calendar of upcoming and past programming contests
- 📧 **Email Verification** — User email verification via Nodemailer
- 🔐 **Authentication** — NextAuth.js with session management
- 📈 **Rating System** — Unified rating combining Codeforces + AtCoder scores

### Tech Stack
| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| UI | React 19, Tailwind CSS 4, SCSS, Lucide Icons |
| Database | SurrealDB (WebSocket/HTTP) |
| Auth | NextAuth.js |
| AI SDK | Vercel AI SDK v5 + multiple provider SDKs |
| Email | Nodemailer |
| Cron | node-cron |
| Validation | Zod |

---

## Directory Structure

```
IT-Eco-For-SP/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (otherpage)/          # App pages: home, auth, chat, profile, calendar
│   │   ├── api/                  # API route handlers
│   │   │   ├── auth/             # NextAuth [...nextauth]
│   │   │   ├── chat/             # AI chat (RouterAI)
│   │   │   ├── profile/          # User profile, Codeforces/AtCoder linking
│   │   │   ├── register/         # User registration
│   │   │   ├── verify-email/     # Email verification
│   │   │   ├── resend-code/      # Resend verification code
│   │   │   ├── events/           # Events calendar
│   │   │   ├── contests/         # Contest data
│   │   │   ├── codeforces/       # Codeforces integration
│   │   │   ├── atcoder/          # AtCoder contest submissions
│   │   │   └── info/             # Info endpoint
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   ├── globals.css           # Global styles
│   │   └── not-found.tsx         # Custom 404 page
│   ├── components/
│   │   ├── layout/               # Layout components (Header, Footer, etc.)
│   │   ├── CodeforcesConnect.tsx
│   │   ├── CodeforcesProblems.tsx
│   │   ├── CodeforcesStats.tsx
│   │   └── SessionWrapper.js     # NextAuth SessionProvider
│   ├── lib/
│   │   ├── surreal/              # SurrealDB client with retry logic
│   │   │   ├── surreal.ts        # DB connection (getDB, queryWithRetry, resetConnection)
│   │   │   └── auth.ts           # Auth helpers (hashPassword, verifyPassword, getUserByEmail)
│   │   ├── email/
│   │   │   └── sendEmail.js      # Email sending via Nodemailer
│   │   ├── codeforces/           # Codeforces API integration
│   │   ├── types/
│   │   │   └── api.ts            # Shared ApiResponse<T> type and helpers
│   │   ├── authOptions.ts        # NextAuth configuration
│   │   ├── rag.ts                # RAG context retrieval (news, contests)
│   │   ├── prompts.ts            # System prompt generation for AI
│   │   ├── contembtext.ts        # Embedding logic for contests
│   │   ├── embedding.ts          # Text embedding utilities
│   │   └── cron-worker.ts        # Background scheduled tasks
│   └── types/                    # TypeScript type definitions
├── docs/
│   ├── CONTEXT.md                # Full project context and dev status
│   ├── ENV_SETUP.md              # Environment variables guide
│   ├── README.docker.md          # Docker documentation
│   ├── FUNCTIONAL_DESCRIPTION.md # Functional spec
│   ├── DESIGN_SPEC.md            # Design spec
│   ├── RBAC.md                   # Role-based access control
│   ├── api.md                    # API documentation
│   ├── migrations/               # Database migrations (SQL)
│   └── Подключение к удалённой БД.md  # Remote DB connection guide (Russian)
├── .env.example                  # Environment variable template
├── docker-compose.yml            # Docker services (app + dev)
├── Dockerfile                    # Multi-stage production build
├── next.config.ts                # Next.js config (standalone output)
├── tsconfig.json                 # TypeScript config (strict, path aliases)
├── .eslintrc.js                  # ESLint + TypeScript + Prettier
├── .prettierrc                   # Prettier config
├── package.json                  # Dependencies and scripts
└── README.md                     # Main documentation (Russian)
```

---

## Building and Running

### Prerequisites
- **Node.js 20+**
- **Docker & Docker Compose v2+** (for containerized runs)
- **SurrealDB** access (remote or local)

### Local Development (Node.js)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# 3. Run dev server (with Turbopack)
npm run dev

# Open http://localhost:3000
```

### Docker Development

```bash
# Dev mode with hot reload
docker compose up dev
# Open http://localhost:3001

# Production mode
docker compose up app
# Open http://localhost:3000

# View logs
docker compose logs -f dev

# Stop
docker compose down
```

### Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build with Turbopack |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check (`.ts`, `.tsx` only, 0 warnings allowed) |
| `npm run format` | Prettier code formatting |
| `npm run type-check` | TypeScript type checking (`tsc --noEmit`) |
| `npm run validate` | Run all checks: lint + format + type-check |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | Session secret | Output of `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL | `http://localhost:3000` |
| `SURREAL_HOST` | SurrealDB host | `ws://localhost:8000` |
| `SURREAL_USER` | DB username | `admin` |
| `SURREAL_PASSWORD` | DB password | Your password |
| `SURREAL_NAMESPACE` | DB namespace | `bcsp` |
| `SURREAL_DATABASE` | Database name | `site` |
| `EMAIL_USER` | Sender email | `your@gmail.com` |
| `EMAIL_PASS` | Email app password | Gmail App Password |
| `ROUTERAI_API_KEY` | AI API key | `sk-...` |

> ⚠️ **Never commit `.env.local` or `.env` files to Git.** They are in `.gitignore`.

---

## Development Conventions

### TypeScript
- **Strict mode** is enabled (`strict: true` in `tsconfig.json`)
- `any` is **forbidden** — ESLint rule `@typescript-eslint/no-explicit-any: "error"`
- Use `unknown` with proper type narrowing, or define explicit interfaces
- Path aliases: `@/*` → `./src/*`, `@/lib/*` → `./src/lib/*`

### Linting & Formatting
- **ESLint** with `@typescript-eslint/recommended` + Prettier integration
- **Prettier** for code formatting — run `npm run format` before committing
- **No warnings allowed** — `--max-warnings 0` in lint script

### Authentication
- Uses **NextAuth.js** with custom SurrealDB adapter
- Passwords hashed with **bcryptjs** (not native `bcrypt` — it was removed)
- Session protection via `src/middleware.js` — guards `/profile` and `/chat` routes
- Email verification required for new accounts

### Database (SurrealDB)
- Connection uses **retry logic** with exponential backoff (3 attempts, 1s base delay)
- All queries should use `queryWithRetry<T>()` for resilience
- `resetConnection()` available to force reconnect on persistent errors
- Environment variable validation runs before first connection

### API Responses
- Use the `ApiResponse<T>` type from `src/lib/types/api.ts`
- Helper functions: `successResponse<T>(data)` and `errorResponse(message)`

### AI / RAG
- System prompt generated by `createSystemPrompt()` in `src/lib/prompts.ts`
- RAG context retrieved by `getRagContext()` in `src/lib/rag.ts`
- Sources: news from DB, contests with vector similarity (cosine)
- Agent role: `student` (student-assistant)

---

## Known Issues & Technical Debt

| Issue | Status | Notes |
|-------|--------|-------|
| No test suite | ⏳ Open | Needs Jest + React Testing Library |
| `profile/page.tsx` ~1563 lines | ⏳ Open | Should be split into hooks/sub-components |
| Complex typing animation | ⏳ Open | May need simplification |

All critical security issues (hardcoded secrets, mixed bcrypt, `any` types) have been resolved.

---

## Key Files Reference

### Authentication & Security
| File | Purpose |
|------|---------|
| `src/lib/authOptions.ts` | NextAuth configuration |
| `src/lib/surreal/auth.ts` | Password hashing, user lookup |
| `src/lib/surreal/surreal.ts` | DB connection with retry |
| `src/middleware.js` | Route protection for `/profile`, `/chat` |
| `src/components/SessionWrapper.js` | SessionProvider wrapper |

### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `api/auth/[...nextauth]` | NextAuth handler |
| `api/register` | User registration |
| `api/verify-email` | Email verification |
| `api/resend-code` | Resend verification code |
| `api/profile` | Profile data + contest history |
| `api/profile/codeforces` | Link/unlink Codeforces account |
| `api/profile/atcoder` | Link/unlink AtCoder account |
| `api/chat` | AI chat (RouterAI API) |
| `api/events` | Events calendar |
| `api/info` | Info endpoint |

### Integrations
| Service | Library / API |
|---------|---------------|
| Codeforces | Direct API calls |
| AtCoder | `@qatadaazzeh/atcoder-api` |
| RouterAI (AI) | `@ai-sdk/*` + `ai` SDK v5 |
| SurrealDB | `surrealdb` npm package |
| Email | `nodemailer` |

---

## Useful Commands

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Free a stuck port
lsof -ti:3000 | xargs kill -9

# Rebuild Docker without cache
docker compose build --no-cache app

# Access container shell
docker compose exec dev sh

# Run all quality checks
npm run validate
```

---

## Documentation Files

| File | Description |
|------|-------------|
| `docs/CONTEXT.md` | Full project context, dev status, and key files |
| `docs/ENV_SETUP.md` | Detailed environment setup guide |
| `docs/README.docker.md` | Docker-specific documentation |
| `docs/FUNCTIONAL_DESCRIPTION.md` | Functional specification |
| `docs/DESIGN_SPEC.md` | Design specification |
| `docs/RBAC.md` | Role-based access control documentation |
| `docs/api.md` | API documentation |
| `docs/migrations/` | Database migration scripts (SQL) |

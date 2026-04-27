# RBAC Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IT-Eco-For-SP Platform                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼───────┐               ┌───────▼───────┐
            │  Public Pages │               │ Authenticated │
            │   (Guest)     │               │    Pages      │
            └───────┬───────┘               └───────┬───────┘
                    │                               │
         ┌──────────┴──────────┐          ┌────────┴────────┐
         │                     │          │                 │
    Landing Page         Contest Calendar │   Role-Based Access │
    Global Rating       Marketing Pages   │   (Middleware)     │
                                                           │
                                              ┌────────────┴────────────┐
                                              │                         │
                                       ┌──────▼──────┐           ┌─────▼──────┐
                                       │ User Level  │           │Coach Level │
                                       │   (1)       │           │   (2)      │
                                       └──────┬──────┘           └─────┬──────┘
                                              │                        │
                                   ┌──────────┴──────────┐    ┌────────┴────────┐
                                   │                     │    │                 │
                            Personal Dashboard      Contest Mgmt.    Analytics Dashboard
                            AI Assistant (student)  Contest CRUD   User Analytics
                            Profile & Stats         Platform Stats Group Insights
                                   │                     │
                              ┌────▼────┐           ┌────▼────┐
                              │  Admin  │           │  Admin  │
                              │ Level 3 │           │ Level 3 │
                              └────┬────┘           └────┬────┘
                                   │                     │
                            ┌──────┴──────┐         ┌───┴────┐
                            │             │         │        │
                      User Management  Karma     All Coach + Full System
                      CRUD Operations  Adjustment Control
```

## Authentication & Authorization Flow

```
┌──────────────┐
│ User Login   │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ NextAuth.js          │
│ Credentials Provider │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────┐
│ SurrealDB Query          │
│ SELECT * FROM users      │
│ WHERE email = $email     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Verify Password          │
│ (bcryptjs)               │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Check Email Verified     │
│ is_verified = true?      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Create JWT Session       │
│ { id, email, role }      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Middleware Intercepts    │
│ Request to Protected     │
│ Route                    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Role Check               │
│ hasRoleLevel(user.role,  │
│ requiredRole)            │
└──────┬───────────────────┘
       │
       ├─ YES ──► ┌─────────────────┐
       │           │ Grant Access    │
       │           │ Render Page     │
       │           └─────────────────┘
       │
       └─ NO ───► ┌─────────────────┐
                   │ Return 403      │
                   │ or Redirect     │
                   └─────────────────┘
```

## API Request Flow with RBAC

```
Client Request
      │
      ▼
┌─────────────────┐
│ API Route       │
│ /api/admin/...  │
└──────┬──────────┘
       │
       ▼
┌──────────────────────────────────┐
│ withRoleGuard() Wrapper          │
│                                  │
│ 1. getServerSession(authOptions) │
│ 2. Validate session exists       │
│ 3. Validate user role            │
│ 4. Check hasRoleLevel()          │
└──────┬───────────────────────────┘
       │
       ├─ FAIL ──► ┌──────────────────────┐
       │            │ Return 401 or 403    │
       │            │ { error: message }   │
       │            └──────────────────────┘
       │
       └─ PASS ──► ┌──────────────────────┐
                    │ Execute Handler      │
                    │                      │
                    │ - Database queries   │
                    │ - Business logic     │
                    │ - Return response    │
                    └──────────────────────┘
```

## Permission Check Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 1: Middleware                   │
│         (Next.js middleware.js - route protection)       │
│                                                          │
│  - Checks token.role against ROLE_ROUTES                │
│  - Uses hierarchical comparison                           │
│  - Redirects unauthenticated users                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Layer 2: Client-Side Guards                │
│          (useRoleGuard hook in React components)         │
│                                                          │
│  - useRoleGuard(requiredRole)                           │
│  - Shows/hides UI elements                               │
│  - Redirects if unauthorized                              │
│  - NOTE: For UX only, not security!                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Layer 3: Server-Side Guards                │
│         (withRoleGuard wrapper in API routes)            │
│                                                          │
│  - withRoleGuard(handler, options)                      │
│  - Validates session on every request                   │
│  - Returns 401/403 if insufficient permissions          │
│  - THIS IS THE SECURITY BOUNDARY                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 4: Database Permissions               │
│     (SurrealDB native table permissions - FUTURE)        │
│                                                          │
│  - DEFINE TABLE ... PERMISSIONS                         │
│  - SELECT WHERE $auth.role IN [...]                     │
│  - UPDATE/DELETE WHERE $auth.role = 'admin'             │
│  - DEEP SECURITY LAYER                                  │
└─────────────────────────────────────────────────────────┘
```

## AI Assistant Role Adaptation

```
┌─────────────────────────┐
│   User Makes Request    │
│   to /api/chat          │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Get Session                 │
│ session.user.role           │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Map RBAC Role to Agent Role  │
│                              │
│ user  ──────► student        │
│ coach ──────► organizer      │
│ admin ──────► admin_analytics│
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Generate System Prompt       │
│ createSystemPrompt({         │
│   ragContext,                │
│   agentRole,                 │
│   mode                       │
│ })                           │
└──────────┬───────────────────┘
           │
           ├─ student ────────┐
           │                  ▼
           │         "You are a student AI |
           │         Help with learning,   │
           │         explain algorithms,   │
           │         prepare for contests" │
           │                              │
           ├─ organizer ─────┐            │
           │                 ▼            │
           │        "You are a coach AI  │
           │        Provide methodology, │
           │        analyze group gaps,  │
           │        recommend strategies"│
           │                            │
           ├─ admin_analytics ──┐       │
           │                    ▼       │
           │         "You are an admin AI│
           │         Full analytics,    │
           │         user management,   │
           │         system insights"   │
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────┐
│ Send to RouterAI API with Adapted Prompt │
│ Stream response back to client           │
└──────────────────────────────────────────┘
```

## Database Schema with RBAC

```
┌──────────────────────────────────────────────────────┐
│                         users                        │
│                                                      │
│  id: record<users>                                   │
│  email: string (UNIQUE, validated)                  │
│  password_hash: string (bcrypt)                      │
│  role: string DEFAULT 'user'                         │
│        CONSTRAINT: IN ['guest','user','coach','admin']│
│  is_verified: bool DEFAULT false                    │
│  full_name: option<string>                           │
│  karma: number DEFAULT 0                             │
│  registration_date: datetime DEFAULT now()           │
│                                                      │
│  PERMISSIONS:                                        │
│    SELECT WHERE id = $auth.id OR $auth.role='admin' │
│    UPDATE WHERE $auth.role = 'admin'                │
│    DELETE WHERE $auth.role = 'admin'                │
│    CREATE WHERE true                                 │
└──────────────────────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────────────────────────┐
│                   external_accounts                  │
│                                                      │
│  user: record<users>                                 │
│  platform: string IN ['codeforces','atcoder']       │
│  handle: string                                      │
│  rating: number DEFAULT 0                            │
│                                                      │
│  PERMISSIONS:                                        │
│    SELECT WHERE user = $auth.id OR $auth.role='admin'│
│    CREATE/UPDATE WHERE user = $auth.id              │
│    DELETE WHERE user = $auth.id OR $auth.role='admin'│
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                      contests                        │
│                                                      │
│  name: string                                        │
│  platform: string IN ['codeforces','atcoder','custom']│
│  start_time: datetime                                │
│  duration: number (positive)                         │
│  status: string DEFAULT 'upcoming'                   │
│         IN ['upcoming','active','completed']         │
│  created_by: record<users>                           │
│                                                      │
│  PERMISSIONS:                                        │
│    SELECT WHERE true (public)                        │
│    CREATE/UPDATE/DELETE WHERE $auth.role IN         │
│           ['coach','admin']                          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                     karma_logs                       │
│                                                      │
│  user: record<users>                                 │
│  amount: number                                      │
│  reason: string                                      │
│  admin_id: record<users>                             │
│  created_at: datetime DEFAULT now()                  │
│                                                      │
│  PERMISSIONS:                                        │
│    SELECT WHERE $auth.role = 'admin'                │
│    CREATE WHERE $auth.role = 'admin'                │
│    UPDATE WHERE false (immutable)                    │
│    DELETE WHERE false (immutable)                    │
└──────────────────────────────────────────────────────┘

Indexes:
  - idx_users_role ON users(role)
  - idx_users_email ON users(email) UNIQUE
  - idx_contests_status ON contests(status)
  - idx_karma_logs_user ON karma_logs(user)
  - idx_karma_logs_admin ON karma_logs(admin_id)
```

## Role Assignment Flow

```
┌─────────────────────┐
│ New User Registers  │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│ Registration API             │
│ POST /api/register           │
│                              │
│ Optional: role parameter     │
│ (validated with isValidUserRole)│
│ Default: 'user'              │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Create User in SurrealDB     │
│ {                            │
│   email,                     │
│   password_hash,             │
│   full_name,                 │
│   role: 'user' (default),    │
│   is_verified: false         │
│ }                            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Send Verification Email      │
│ (6-digit code, 1hr expiry)   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ User Verifies Email          │
│ POST /api/verify-email       │
│ is_verified = true           │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ User Can Now Login           │
└──────────────────────────────┘

Role Escalation (Admin Only):
  ┌──────────────────────────┐
  │ Admin Changes User Role  │
  │ PATCH /api/admin/users/:id│
  │ { role: 'coach' }        │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ UPDATE users SET role    │
  │ WHERE id = $id           │
  └──────────────────────────┘
```

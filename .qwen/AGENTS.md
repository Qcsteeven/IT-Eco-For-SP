# RBAC Implementation Agents Configuration

This file defines specialized agents for implementing and maintaining the Role-Based Access Control (RBAC) system for IT-Eco-For-SP.

## Implementation Status: ✅ PROTOTYPE COMPLETE

The RBAC system has been fully implemented with all core features. See `docs/RBAC_IMPLEMENTATION.md` for comprehensive documentation.

---

## Agent Definitions

### rbac-architect
**Purpose**: Review and enhance the overall RBAC architecture.

**Current Status**: ✅ Core architecture complete
- 3+1 role model implemented (Guest, User, Coach, Admin)
- Permission matrix with 10 granular permissions
- Role hierarchy with level-based access control

**Responsibilities**:
- Review `docs/RBAC_IMPLEMENTATION.md` for current state
- Enhance role separation and permission boundaries
- Plan future RBAC enhancements (e.g., dynamic permissions)
- Ensure POLP (Principle of Least Privilege) compliance

**Tools**: 
- read_file, grep_search, agent (Explore)
- write_file (for architecture docs)

### rbac-database-engineer
**Purpose**: Maintain and enhance SurrealDB permissions and role management.

**Current Status**: ✅ Database migration script created
- Migration: `docs/migrations/001_rbac_schema.sql`
- Native SurrealDB permissions defined
- Indexes for performance optimization

**Responsibilities**:
- Execute migration script on development/production databases
- Monitor query performance with RBAC filters
- Add new table permissions as features expand
- Use `queryWithRetry<T>()` pattern for all queries

**Tools**:
- read_file, write_file, edit
- run_shell_command (for migration scripts)

### rbac-backend-developer
**Purpose**: Maintain server-side RBAC logic and API routes.

**Current Status**: ✅ All backend features implemented
- API route protection with `withRoleGuard()`
- Server-side session validation
- Role-adaptive AI prompts

**Responsibilities**:
- Maintain `src/lib/rbac/guard.ts` and related files
- Add new API endpoints with proper role protection
- Ensure TypeScript strict mode compliance (no `any` types)
- Fix pre-existing type errors (see RBAC_IMPLEMENTATION.md)

**Tools**:
- read_file, write_file, edit
- run_shell_command (for validation: `npm run validate`)

### rbac-frontend-developer
**Purpose**: Maintain UI components and role-based conditional rendering.

**Current Status**: ✅ All frontend features implemented
- Coach pages: `/coach/contests`, `/coach/analytics`
- Admin pages: `/admin/karma`, enhanced `/admin/users`
- Role-based navigation in Header component
- Client-side role guards with `useRoleGuard()`

**Responsibilities**:
- Maintain role-aware components
- Enhance UI/UX for admin and coach interfaces
- Add role badges and permission indicators
- Ensure React 19 and Next.js 15 App Router compatibility

**Tools**:
- read_file, write_file, edit
- glob (for finding components)

### rbac-tester
**Purpose**: Validate RBAC implementation and ensure all permission boundaries work correctly.

**Current Status**: ⏳ Manual testing needed, automated tests not yet implemented

**Responsibilities**:
- Create test scenarios for each role (see RBAC_IMPLEMENTATION.md)
- Validate permission matrix coverage
- Test edge cases (unauthorized access, role escalation)
- Implement Jest + React Testing Library test suite
- Run type checks: `npm run type-check`
- Run linting: `npm run lint`
- Validate builds: `npm run build`

**Tools**:
- run_shell_command (for validation scripts)
- read_file, grep_search
- agent (general-purpose for testing)

---

## Completed Implementation Summary

### ✅ What's Been Built

1. **Coach Pages** (New)
   - `/coach/contests` — Full CRUD for contest management
   - `/coach/analytics` — Dashboard with user and platform statistics

2. **Admin Pages** (Enhanced)
   - `/admin/karma` — Karma adjustment form with history
   - `/admin/users` — Added functional edit/delete modals

3. **Role-Based Navigation** (Enhanced)
   - Header uses `hasPermission()` for conditional links
   - Different navigation items for different roles

4. **AI Integration** (Enhanced)
   - AI prompts adapt to user's RBAC role
   - Student, Organizer, and Admin Analytics modes

5. **Database Schema** (New)
   - Migration script with native SurrealDB permissions
   - Table-level access controls for all RBAC tables

6. **Permission Utilities** (New)
   - Granular permission checks: `hasPermission()`
   - Category-based permission groups
   - Client hooks and server utilities

### 📁 Key Files

| File | Purpose |
|------|---------|
| `src/lib/rbac.ts` | Core RBAC types and permission matrix |
| `src/lib/rbac/client.ts` | Client-side role guards |
| `src/lib/rbac/guard.ts` | Server-side API protection |
| `src/lib/rbac/permissions.ts` | Granular permission utilities |
| `src/lib/rbac/index.ts` | Central RBAC exports |
| `src/lib/prompts.ts` | Role-adaptive AI prompts |
| `src/app/(otherpage)/coach/**` | Coach pages (contests, analytics) |
| `src/app/(otherpage)/admin/karma/**` | Karma adjustment page |
| `src/app/(otherpage)/admin/users/**` | User management with edit/delete |
| `src/components/layout/Header.tsx` | Role-based navigation |
| `docs/migrations/001_rbac_schema.sql` | Database schema with RBAC |
| `docs/RBAC_IMPLEMENTATION.md` | Comprehensive implementation docs |

---

## Workflow Sequence

For **future enhancements**:

1. **rbac-architect** → Designs enhancement and updates architecture docs
2. **rbac-database-engineer** → Implements database changes (if needed)
3. **rbac-backend-developer** → Implements backend logic and API routes
4. **rbac-frontend-developer** → Implements UI components
5. **rbac-tester** → Validates implementation and runs quality checks

Each agent should document their work and update `docs/RBAC_IMPLEMENTATION.md` with progress.

---

## Testing Checklist

See `docs/RBAC_IMPLEMENTATION.md` for complete manual testing checklist.

### Priority Tasks
1. ⏳ Fix pre-existing TypeScript errors (31 errors)
2. ⏳ Implement automated test suite
3. ⏳ Run database migration on development environment
4. ⏳ Conduct manual testing with all role levels
5. ⏳ Add rate limiting to admin endpoints

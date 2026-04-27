# RBAC Quick Reference Guide

## 🎯 Overview
The RBAC system provides role-based access control with 4 role levels and 10 granular permissions.

## 👥 Role Hierarchy

```
Level 3: ADMIN (Администратор) — Full system access
  ↓
Level 2: COACH (Тренер) — Contest management & analytics
  ↓
Level 1: USER (Участник) — Learning & participation
  ↓
Level 0: GUEST (Гость) — Public access only
```

## 🔑 Permissions

| Permission | Guest | User | Coach | Admin |
|-----------|:-----:|:----:|:-----:|:-----:|
| `canViewLanding` | ✅ | ✅ | ✅ | ✅ |
| `canViewGlobalRating` | ✅ | ✅ | ✅ | ✅ |
| `canViewUpcomingContests` | ✅ | ✅ | ✅ | ✅ |
| `canUseAIAssistant` | ❌ | ✅ | ✅ | ✅ |
| `canParticipateInContests` | ❌ | ✅ | ✅ | ✅ |
| `canViewPersonalDashboard` | ❌ | ✅ | ✅ | ✅ |
| `canManageContests` | ❌ | ❌ | ✅ | ✅ |
| `canViewAnalytics` | ❌ | ❌ | ✅ | ✅ |
| `canManageUsers` | ❌ | ❌ | ❌ | ✅ |
| `canAdjustKarma` | ❌ | ❌ | ❌ | ✅ |

## 💻 Usage Examples

### Client-Side Component

```tsx
import { useRoleGuard, hasPermission, UserRole } from '@/lib/rbac';

function MyComponent() {
  const { authorized, role } = useRoleGuard('coach');
  
  if (!authorized) return <p>Access denied</p>;
  
  return (
    <div>
      {hasPermission(role as UserRole, 'canManageContests') && (
        <button>Manage Contests</button>
      )}
    </div>
  );
}
```

### API Route Protection

```typescript
import { withRoleGuard } from '@/lib/rbac/guard';

export const GET = withRoleGuard(
  async (req, session) => {
    // Your handler code here
    return NextResponse.json({ data: 'secret' });
  },
  { requiredRole: 'admin' }
);
```

### Granular Permission Checks

```typescript
import { can, hasAllPermissions, usePermissions } from '@/lib/rbac';

// Simple check
if (can(userRole, 'canManageUsers')) {
  // Show user management UI
}

// Multiple permissions check
if (hasAllPermissions(userRole, ['canManageContests', 'canViewAnalytics'])) {
  // Show coach dashboard
}

// In client component
function Dashboard() {
  const perms = usePermissions(userRole);
  
  return (
    <div>
      {perms.canViewAnalytics && <AnalyticsPanel />}
      {perms.canManageUsers && <UserPanel />}
    </div>
  );
}
```

### AI Assistant Integration

```typescript
import { mapRBACRoleToAgentRole } from '@/lib/prompts';

const session = await getServerSession(authOptions);
const agentRole = mapRBACRoleToAgentRole(session.user.role);
// AI prompt will adapt based on user's RBAC role
```

## 📁 File Locations

### Core RBAC Files
- `src/lib/rbac.ts` — Main RBAC logic
- `src/lib/rbac/client.ts` — Client hooks
- `src/lib/rbac/guard.ts` — Server guards
- `src/lib/rbac/permissions.ts` — Permission utilities
- `src/lib/rbac/index.ts` — Central exports

### Pages
- `src/app/(otherpage)/coach/contests/` — Contest management
- `src/app/(otherpage)/coach/events/` — Events management (wrapper over `/events`)
- `src/app/(otherpage)/coach/groups/` — Groups (list, details, per-group analytics)
- `src/app/(otherpage)/admin/` — Admin dashboard
- `src/app/(otherpage)/admin/users/` — User management
- `src/app/(otherpage)/admin/karma/` — Karma adjustment

### API Routes
- `src/app/api/admin/users/` — User CRUD
- `src/app/api/admin/contests/` — Contest CRUD
- `src/app/api/admin/karma/` — Karma adjustment
- `src/app/api/admin/analytics/` — Analytics data

### Database
- `docs/migrations/001_rbac_schema.sql` — Database schema

## 🔧 Common Tasks

### Add New Permission
1. Add to `RolePermissions` interface in `src/lib/rbac.ts`
2. Add to `ROLE_PERMISSIONS` object for each role
3. Update this documentation

### Add New Role
1. Add to `UserRole` type in `src/lib/rbac.ts`
2. Add to `ROLE_HIERARCHY` with appropriate level
3. Add to `ROLE_PERMISSIONS` with permission set
4. Update database migration script

### Protect New API Route
```typescript
import { withRoleGuard } from '@/lib/rbac/guard';

export const POST = withRoleGuard(
  async (req, session) => {
    // Handler code
  },
  { requiredRole: 'coach' }
);
```

### Protect New Page
```tsx
import { useRoleGuard } from '@/lib/rbac/client';

function MyPage() {
  const { authorized } = useRoleGuard('admin');
  if (!authorized) return <AccessDenied />;
  // Page content
}
```

## ⚠️ Security Notes

1. **Always use server-side guards** — Client guards are for UX only
2. **Validate roles on API endpoints** — Never trust client-side checks
3. **Use hierarchical comparison** — `hasRoleLevel()` not string equality
4. **Log admin actions** — Especially karma adjustments and role changes
5. **Test permission boundaries** — Ensure users can't escalate privileges

## 🧪 Testing

### Manual Testing Steps
1. Create user accounts with different roles
2. Test access to all pages with each role
3. Verify API endpoints return 403 for insufficient permissions
4. Test role escalation (admin > coach > user)
5. Test permission boundaries are enforced

### Automated Testing (Future)
- Unit tests for permission utilities
- Integration tests for API route protection
- E2E tests for complete workflows

## 📚 Additional Resources

- `docs/RBAC.md` — Original RBAC specification (Russian)
- `docs/RBAC_IMPLEMENTATION.md` — Complete implementation documentation
- `.qwen/AGENTS.md` — Agent configuration for RBAC development

## 🆘 Troubleshooting

### User can't access page they should have permission for
- Check `useRoleGuard()` required role
- Verify user's role in session: `session.user.role`
- Check middleware matcher in `src/middleware.js`

### API returns 403 Forbidden
- Check `withRoleGuard()` required role
- Verify session is being passed correctly
- Check user's role in database

### Role change doesn't take effect
- User needs to log out and log back in
- Session JWT needs to be refreshed
- Check `authOptions.ts` session callback

### Database permission errors
- Run migration script: `docs/migrations/001_rbac_schema.sql`
- Verify SurrealDB connection credentials
- Check `$auth` variable is set correctly in queries

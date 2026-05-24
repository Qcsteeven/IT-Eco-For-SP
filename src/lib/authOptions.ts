import {
  NextAuthOptions,
  DefaultSession,
  User as NextAuthUser,
} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';
import { getUserByEmail, verifyPassword } from '@/lib/surreal/auth';
import { getDB } from '@/lib/surreal/surreal';
import { parseUsersRecordKey } from '@/lib/surreal/ids';
import { isValidUserRole } from '@/lib/rbac';

type CurrentAuthState = {
  role: string;
  is_verified: boolean;
  is_blocked: boolean;
};

async function getCurrentAuthState(
  userId: unknown,
): Promise<CurrentAuthState | null> {
  const key = parseUsersRecordKey(String(userId || ''));
  if (!key) return null;

  const db = await getDB();
  if (!db) return null;

  const res = await db.query(
    `SELECT role, is_verified, is_blocked
     FROM type::thing("users", $id)
     LIMIT 1;`,
    { id: key },
  );
  const rows = (Array.isArray(res) ? (res[0] as unknown[]) : []) || [];
  const row = (rows[0] as Record<string, unknown> | undefined) || undefined;
  const role = String(row?.role || '');

  if (!row || !isValidUserRole(role)) return null;

  return {
    role,
    is_verified: row.is_verified !== false,
    is_blocked: row.is_blocked === true,
  };
}

function invalidateSession(session: DefaultSession) {
  if (!session.user) return session;

  return {
    ...session,
    user: {
      ...session.user,
      id: '',
      role: 'guest',
      is_verified: false,
      is_blocked: true,
    },
  };
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      is_verified?: boolean;
      is_blocked?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    email: string;
    name?: string;
    is_verified?: boolean;
    is_blocked?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    is_verified?: boolean;
    is_blocked?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await getUserByEmail(credentials.email);

        if (user) {
          const storedHash =
            ((user as Record<string, unknown>).password_hash as
              | string
              | undefined) || user.password;
          const isMatch = await verifyPassword(
            credentials.password,
            storedHash,
          );

          if (isMatch) {
            if ((user as Record<string, unknown>).is_blocked) {
              console.warn(
                `[AUTH] БЛОКИРОВКА ВХОДА: Аккаунт ${user.email} заблокирован.`,
              );
              throw new Error('AccountBlocked');
            }

            if (!user.is_verified) {
              console.warn(
                `[AUTH] БЛОКИРОВКА ВХОДА: Аккаунт ${user.email} не подтвержден администратором.`,
              );
              throw new Error('AccountNotApproved');
            }

            return {
              id: user.id,
              email: user.email,
              name: user.full_name || user.name,
              role: user.role || 'user',
              is_verified: !!user.is_verified,
              is_blocked: !!(user as Record<string, unknown>).is_blocked,
            } as NextAuthUser;
          }
        }

        return null;
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.is_verified = (
          user as unknown as { is_verified?: boolean }
        ).is_verified;
        token.is_blocked = (
          user as unknown as { is_blocked?: boolean }
        ).is_blocked;
      }
      return token as JWT;
    },
    async session({ session, token }) {
      if (token && session.user) {
        let currentState: CurrentAuthState | null = null;
        try {
          currentState = await getCurrentAuthState(token.id);
        } catch (error) {
          console.error('[AUTH] Не удалось обновить состояние сессии:', error);
        }

        if (
          !currentState ||
          currentState.is_blocked ||
          !currentState.is_verified
        ) {
          return invalidateSession(session);
        }

        session.user.id = token.id;
        session.user.role = currentState.role;
        session.user.is_verified = currentState.is_verified;
        session.user.is_blocked = currentState.is_blocked;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
};

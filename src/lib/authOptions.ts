import {
  NextAuthOptions,
  DefaultSession,
  User as NextAuthUser,
} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';
import { getUserByEmail, verifyPassword } from '@/lib/surreal/auth';

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
          const storedHash = (user as Record<string, unknown>).password_hash as string | undefined || user.password;
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
                `[AUTH] БЛОКИРОВКА ВХОДА: Email ${user.email} не верифицирован.`,
              );
              throw new Error('EmailNotVerified');
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
        token.is_verified = (user as unknown as { is_verified?: boolean }).is_verified;
        token.is_blocked = (user as unknown as { is_blocked?: boolean }).is_blocked;
      }
      return token as JWT;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.is_verified = token.is_verified;
        session.user.is_blocked = token.is_blocked;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
};

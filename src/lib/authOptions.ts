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
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    email: string;
    name?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
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
          const isMatch = await verifyPassword(
            credentials.password,
            user.password_hash || user.password,
          );

          if (isMatch) {
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
      }
      return token as JWT;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
};

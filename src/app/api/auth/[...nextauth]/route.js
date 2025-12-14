import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { getUserByEmail, verifyPassword } from '@/lib/surreal/auth';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const user = await getUserByEmail(credentials.email);

        if (user) {
          const isMatch = await verifyPassword(
            credentials.password,
            user.password_hash,
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
              name: user.full_name,
              role: user.role,
            };
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
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

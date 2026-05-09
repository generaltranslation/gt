import { compare } from 'bcrypt-ts';
import NextAuth, { type User, type Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';

import { getUser } from '@/lib/db/queries';

import { authConfig } from './auth.config';

interface ExtendedSession extends Session {
  user: User;
}

type LoginCredentials = Partial<
  Record<'email' | 'password', FormDataEntryValue>
>;

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize(credentials: LoginCredentials) {
        const email =
          typeof credentials.email === 'string' ? credentials.email : '';
        const password =
          typeof credentials.password === 'string' ? credentials.password : '';

        if (!email || !password) return null;

        const users = await getUser(email);
        if (users.length === 0) return null;
        const passwordsMatch = await compare(password, users[0].password!);
        if (!passwordsMatch) return null;
        return {
          id: users[0].id,
          email: users[0].email,
        } satisfies User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({
      session,
      token,
    }: {
      session: ExtendedSession;
      token: JWT & { id?: string };
    }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id;
      }

      return session;
    },
  },
});

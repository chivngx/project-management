import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email và mật khẩu là bắt buộc");
        }

        // Rate limit: 10 attempts per minute per IP + email.
        const ip = getClientIp(req);
        const email = credentials.email.trim().toLowerCase();
        const rl = rateLimit(`login:${ip}:${email}`, 10, 60 * 1000);
        if (!rl.ok) {
          throw new Error("Quá nhiều lần thử. Vui lòng thử lại sau 1 phút.");
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            passwordHash: true,
            tokenVersion: true,
          },
        });
        if (!user) {
          throw new Error("Email hoặc mật khẩu không đúng");
        }
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          throw new Error("Email hoặc mật khẩu không đúng");
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? undefined,
          // Stash tokenVersion on the user object so the jwt callback can read it.
          tokenVersion: user.tokenVersion,
        } as {
          id: string;
          name: string;
          email: string;
          image?: string;
          tokenVersion: number;
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.image = (user as { image?: string | null }).image ?? null;
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
      }
      // Periodically re-check tokenVersion against the DB so that a password
      // change or admin action (incrementing tokenVersion) invalidates the
      // session. To avoid a DB hit on every request, re-check at most every
      // 5 minutes by comparing token.iat staleness.
      if (token.id && typeof token.tokenVersion === "number") {
        const lastCheck = (token as unknown as { lastVersionCheck?: number }).lastVersionCheck;
        const now = Date.now();
        if (!lastCheck || now - lastCheck > 5 * 60 * 1000) {
          const fresh = await db.user.findUnique({
            where: { id: token.id },
            select: { tokenVersion: true },
          });
          (token as unknown as { lastVersionCheck?: number }).lastVersionCheck = now;
          if (fresh && fresh.tokenVersion !== token.tokenVersion) {
            // Token revoked — return an empty token to invalidate the session.
            return { ...token, id: "", tokenVersion: fresh.tokenVersion } as typeof token;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      // If the token was invalidated (empty id), don't attach a user.
      if (!token.id) {
        return { ...session, user: undefined } as typeof session;
      }
      if (session.user) {
        session.user.id = token.id;
        session.user.image = token.image ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

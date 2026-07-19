import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { AuthService } from "@/services/auth.service";
import { UserRepository } from "@/repositories/user.repository";
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
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

        const user = await AuthService.validateUserCredentials(email, credentials.password);
        if (!user) {
          throw new Error("Email hoặc mật khẩu không đúng");
        }

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          image: user.image ?? undefined,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google") {
        if (!user.email) return false;

        const email = user.email.trim().toLowerCase();
        const existing = await UserRepository.findByEmail(email);

        if (!existing) {
          try {
            const name = user.name || email.split("@")[0];
            const result = await AuthService.registerGoogleUser(name, email, user.image);
            user.id = result.user.id;
            (user as any).tokenVersion = result.user.tokenVersion;
            (user as any).image = result.user.image;
            (user as any).username = result.user.username;
          } catch (e) {
            console.error("Failed to onboard Google user:", e);
            return false;
          }
        } else {
          user.id = existing.id;
          (user as any).tokenVersion = existing.tokenVersion;
          (user as any).image = existing.image;
          (user as any).username = existing.username;

          // If user didn't have an avatar in DB, but Google provides one, save it
          if (!existing.image && user.image) {
            await UserRepository.update(existing.id, { image: user.image });
            (user as any).image = user.image;
          }
        }
      }
      return true;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id ?? "";
        token.image = (user as { image?: string | null }).image ?? null;
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
        token.username = (user as any).username ?? "";
      }
      // Periodically re-check tokenVersion against the DB so that a password
      // change or admin action (incrementing tokenVersion) invalidates the
      // session. To avoid a DB hit on every request, re-check at most every
      // 5 minutes by comparing token.iat staleness.
      if (token.id && typeof token.tokenVersion === "number") {
        const lastCheck = (token as unknown as { lastVersionCheck?: number }).lastVersionCheck;
        const now = Date.now();
        if (!lastCheck || now - lastCheck > 5 * 60 * 1000) {
          const fresh = await UserRepository.findById(token.id);
          (token as unknown as { lastVersionCheck?: number }).lastVersionCheck = now;
          if (fresh && fresh.tokenVersion !== token.tokenVersion) {
            // Token revoked — return an empty token to invalidate the session.
            return { ...token, id: "", tokenVersion: fresh.tokenVersion } as typeof token;
          }
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      // If the token was invalidated (empty id), don't attach a user.
      if (!token.id) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id;
        session.user.image = token.image ?? null;
        session.user.username = token.username ?? "";
      }
      return session;
    },
  } as any,
  secret: process.env.NEXTAUTH_SECRET,
};

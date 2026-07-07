// Augment next-auth types so `session.user.id` is typed as string.
// We only extend the Session + JWT interfaces (not User, which NextAuth v4
// owns) to avoid type-resolution conflicts that break the production build.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    image?: string | null;
    tokenVersion?: number;
  }
}

// NextAuth v4 re-exports `getServerSession` + `NextAuthOptions` via
// `export * from "./next"`, but under Next.js 16's bundler resolution the
// `next` package types don't resolve the same way, so the type system loses
// these exports at build time (they exist at runtime). Declare minimal but
// usable types here so imports type-check without weakening the callback
// signatures (which would cascade into implicit-any errors).
declare module "next-auth" {
  import type { JWT } from "next-auth/jwt";

  interface DefaultSession {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  // Minimal but correctly-typed NextAuthOptions so the callbacks in
  // src/lib/auth.ts receive properly typed arguments.
  export interface NextAuthOptions {
    session?: {
      strategy?: "jwt" | "database";
      maxAge?: number;
      updateAge?: number;
    };
    pages?: { signIn?: string; signOut?: string; error?: string; newUser?: string };
    providers?: unknown[];
    secret?: string;
    callbacks?: {
      jwt?: (args: {
        token: JWT;
        user?: {
          id?: string;
          name?: string | null;
          email?: string | null;
          image?: string | null;
          [key: string]: unknown;
        };
        account?: unknown;
        profile?: unknown;
      }) => JWT | Promise<JWT>;
      session?: (args: {
        session: DefaultSession;
        token: JWT;
        user?: unknown;
      }) => DefaultSession | Promise<DefaultSession>;
    };
    events?: Record<string, unknown>;
  }

  export function getServerSession(
    options?: NextAuthOptions
  ): Promise<DefaultSession | null>;
  export function getServerSession(
    req: unknown,
    res: unknown,
    options: NextAuthOptions
  ): Promise<DefaultSession | null>;
}

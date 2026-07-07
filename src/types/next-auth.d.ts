// Augment next-auth types so `session.user.id` is typed as string (not just
// the default name/email/image). This removes the need for `as unknown as`
// casts scattered across the codebase.
declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }

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

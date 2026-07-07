import { withAuth } from "next-auth/middleware";

// Protect all app routes except auth pages, auth APIs and static assets.
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    "/((?!login|register|api/auth|api/register|_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)",
  ],
};

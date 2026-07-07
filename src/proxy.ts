import { withAuth } from "next-auth/middleware";

// Protect app pages (not API routes). API routes handle their own auth via
// getApiContext() and return proper 401 JSON — excluding /api here avoids
// withAuth redirecting unauthenticated API calls to /login (HTML), which
// would break client-side JSON.parse.
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    // Match everything except: auth pages, all /api/* (APIs self-guard),
    // Next internals, and static assets.
    "/((?!login|register|api|_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)",
  ],
};

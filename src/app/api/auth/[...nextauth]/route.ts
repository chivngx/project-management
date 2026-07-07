import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v4's default export isn't inferred as callable under Next.js 16's
// strict `moduleResolution: "bundler"`. This is a known interop issue between
// next-auth v4 and Next 16; cast to the documented handler signature.
// (Upgrading to Auth.js v5 would remove the need for this cast.)
const handler = (NextAuth as unknown as (options: typeof authOptions) => (
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) => Response | Promise<Response>)(authOptions);

export { handler as GET, handler as POST };

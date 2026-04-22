import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/signin", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (req.auth) return;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return;

  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
  return Response.redirect(url);
});

export const config = {
  // Protect everything except Next's static pipeline, public assets, and the
  // NextAuth API routes (matched via PUBLIC_PREFIXES above as belt-and-suspenders).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.pdf$).*)"],
};

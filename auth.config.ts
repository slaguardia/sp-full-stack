import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config. No Node-only imports here — this module is
 * pulled into the middleware bundle, which runs in the Edge runtime.
 *
 * The credentials provider (which needs `node:crypto` for constant-time
 * compare) is attached in `auth.ts`, which only runs in the Node runtime.
 */
const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [],
} satisfies NextAuthConfig;

export default authConfig;

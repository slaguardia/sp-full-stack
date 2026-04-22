import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import authConfig from "./auth.config";

/**
 * Decode AUTH_BASIC_CREDENTIALS, which is the base64 of `username:password`.
 *
 * Kept ultra-simple: one user, one password, no database. Rotate by
 * redeploying with a new env value.
 */
function decodeBasicCredentials():
  | { username: string; password: string }
  | null {
  const raw = process.env.AUTH_BASIC_CREDENTIALS;
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return null;
  }
  const split = decoded.indexOf(":");
  if (split < 0) return null;
  const username = decoded.slice(0, split);
  const password = decoded.slice(split + 1);
  if (!username || !password) return null;
  return { username, password };
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Depot credentials",
      credentials: {
        username: { label: "Operator", type: "text" },
        password: { label: "Passcode", type: "password" },
      },
      async authorize(raw) {
        const expected = decodeBasicCredentials();
        if (!expected) {
          console.warn(
            "[auth] AUTH_BASIC_CREDENTIALS is not set — all sign-ins rejected.",
          );
          return null;
        }
        const username = typeof raw?.username === "string" ? raw.username : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        const userOk = constantTimeEqual(username, expected.username);
        const passOk = constantTimeEqual(password, expected.password);
        if (!userOk || !passOk) return null;
        return { id: expected.username, name: expected.username };
      },
    }),
  ],
});

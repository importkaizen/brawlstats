import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function googleProvider() {
  const id = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
  const secret =
    process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!id?.trim() || !secret?.trim()) {
    return null;
  }
  return Google({ clientId: id, clientSecret: secret });
}

function discordProvider() {
  const id = process.env.AUTH_DISCORD_ID;
  const secret = process.env.AUTH_DISCORD_SECRET;
  if (!id?.trim() || !secret?.trim()) {
    return null;
  }
  return Discord({ clientId: id, clientSecret: secret });
}

const google = googleProvider();
const discord = discordProvider();

const oauthProviders = [
  google ??
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "missing-google-client-id",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "missing-google-client-secret",
    }),
  ...(discord ? [discord] : []),
];

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV !== "production"
    ? "dev-only-my-rebrawl-auth-placeholder-not-for-production"
    : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  secret: authSecret,
  providers: oauthProviders,
  callbacks: {
    async session({ session, user }) {
      if (!session.user) return session;

      session.user.id = user.id;
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { linkedPlayerTag: true },
      });
      session.user.linkedPlayerTag = row?.linkedPlayerTag ?? null;
      return session;
    },
  },
});

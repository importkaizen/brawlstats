import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function discordProvider() {
  const id = process.env.AUTH_DISCORD_ID;
  const secret = process.env.AUTH_DISCORD_SECRET;
  if (!id?.trim() || !secret?.trim()) {
    return null;
  }
  return Discord({ clientId: id, clientSecret: secret });
}

const discord = discordProvider();

const oauthProviders = discord ? [discord] : [];

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

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      linkedPlayerTag: string | null;
    } & DefaultSession["user"];
  }
}

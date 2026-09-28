"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function signInWithDiscordAction() {
  await signIn("discord", { redirectTo: "/post-login" });
}

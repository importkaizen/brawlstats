"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/post-login" });
}

export async function signInWithDiscordAction() {
  await signIn("discord", { redirectTo: "/post-login" });
}

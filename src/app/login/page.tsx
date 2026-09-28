import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  signInWithDiscordAction,
  signInWithGoogleAction,
} from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Sign in — MyreBrawl",
};

export default function LoginPage() {
  const showDiscord =
    Boolean(process.env.AUTH_DISCORD_ID?.trim()) &&
    Boolean(process.env.AUTH_DISCORD_SECRET?.trim());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-gold"
        >
          Back home
        </Link>
      </header>

      <div className="card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Save your player tag to your account so your dashboard is always one
          click away.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <form action={signInWithGoogleAction}>
            <Button type="submit" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
          {showDiscord && (
            <form action={signInWithDiscordAction}>
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
              >
                Continue with Discord
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

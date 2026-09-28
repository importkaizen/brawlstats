import { redirect } from "next/navigation";
import { signInWithDiscordAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Sign in — MyreBrawl",
};

export default function LoginPage() {
  const showDiscord =
    Boolean(process.env.AUTH_DISCORD_ID?.trim()) &&
    Boolean(process.env.AUTH_DISCORD_SECRET?.trim());

  if (!showDiscord) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 sm:px-6">
      <form action={signInWithDiscordAction}>
        <Button type="submit" size="lg" className="w-full">
          Continue with Discord
        </Button>
      </form>
    </main>
  );
}

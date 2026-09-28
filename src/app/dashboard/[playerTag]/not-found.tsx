import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

export default function PlayerNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Player not connected
        </h1>
        <p className="mt-2 text-muted-foreground">
          We don&apos;t have any data stored for that tag yet. Connect your
          account from the home page and we&apos;ll start tracking it.
        </p>
      </div>
      <Link href="/">
        <Button>Back to landing</Button>
      </Link>
    </main>
  );
}

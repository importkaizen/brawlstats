import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { tagForUrl } from "@/lib/tag";
import { ConnectForm } from "@/components/ConnectForm";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Link your tag — MyreBrawl",
};

export default async function ConnectTagPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const tag = session.user.linkedPlayerTag;
  if (tag) {
    redirect(`/dashboard/${tagForUrl(tag)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-gold"
        >
          Home
        </Link>
      </header>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Link your tag</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the same tag you see in-game. We&apos;ll fetch your profile once
          and save it on this account ({session.user.email ?? session.user.name}
          ).
        </p>
        <div className="mt-6">
          <ConnectForm linkToMyAccount />
        </div>
      </div>
    </main>
  );
}

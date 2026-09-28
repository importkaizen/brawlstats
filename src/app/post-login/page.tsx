import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { tagForUrl } from "@/lib/tag";

/** Post-OAuth routing: dashboard if tag linked, otherwise connect-tag. */
export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const tag = session.user.linkedPlayerTag;
  if (tag) {
    redirect(`/dashboard/${tagForUrl(tag)}`);
  }
  redirect("/connect-tag");
}

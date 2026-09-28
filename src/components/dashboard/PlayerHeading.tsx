import { playerIconUrl } from "@/lib/utils";

export function PlayerHeading({
  name,
  tag,
  icon,
  section,
  children,
}: {
  name: string;
  tag: string;
  icon: number;
  section: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 sm:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={playerIconUrl(icon || 28000000)}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg bg-muted object-cover sm:h-14 sm:w-14"
        />
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span className="section-kicker">{section}</span>
            <span aria-hidden>/</span>
            <span className="font-mono">{tag}</span>
          </div>
          <h1 className="break-words text-2xl font-semibold tracking-[-.045em] sm:text-3xl">
            {name}
          </h1>
        </div>
      </div>
      {children}
    </div>
  );
}

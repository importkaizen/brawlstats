import Link from "next/link";
import { ArrowUpRight, ArrowRight, Check, Swords, Trophy } from "lucide-react";
import { ConnectForm } from "@/components/ConnectForm";
import { Logo } from "@/components/Logo";
import { rankedTierIconUrl } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 sm:px-8 lg:px-12">
      <header className="flex h-20 items-center justify-between border-b border-border">
        <Logo />
        <nav
          className="flex items-center gap-5 sm:gap-7"
          aria-label="Main navigation"
        >
          <Link href="/demo" className="nav-link">
            Explore demo
          </Link>
        </nav>
      </header>

      <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-28">
        <div>
          <p className="section-kicker mb-6 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Your Brawl Stars companion
          </p>
          <h1 className="home-title">
            Every game.
            <br />
            <span className="text-muted-foreground">A clearer picture.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
            Follow your Ranked climb, find your strongest picks, and keep a
            history of the games that got you here.
          </p>
          <div className="mt-9 max-w-lg">
            <label
              htmlFor="player-tag"
              className="mb-3 block text-xs font-medium"
            >
              Start with your player tag
            </label>
            <ConnectForm />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3" />
              No account needed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3" />
              Your captured games stay saved
            </span>
          </div>
        </div>

        <div className="home-preview overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="text-xs font-medium">Ranked overview</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">
              Example dashboard
            </span>
          </div>
          <div className="flex items-center gap-4 p-6 pb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rankedTierIconUrl(16) ?? ""}
              alt="Legendary I"
              className="h-16 w-16 object-contain"
            />
            <div>
              <p className="section-kicker">Current standing</p>
              <h2 className="mt-1 text-xl font-semibold text-[#FF3B4B]">
                Legendary I
              </h2>
              <p className="mt-1 text-sm tabular-nums">
                6,042{" "}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ELO
                </span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Session gain</p>
              <p className="mt-2 text-lg font-medium tabular-nums text-win">
                +847
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 border-y border-border text-xs">
            <PreviewStat label="Record" value="18 – 7" />
            <PreviewStat label="Win rate" value="72%" />
            <PreviewStat label="Season best" value="6,042" />
          </div>
          <div className="px-6 pb-5 pt-6">
            <div className="mb-4 flex justify-between text-[10px] text-muted-foreground">
              <span>Rating progression</span>
              <span>25 finished games</span>
            </div>
            <svg
              viewBox="0 0 480 190"
              className="w-full"
              role="img"
              aria-label="Example Ranked rating progression from Mythic III to Legendary I"
            >
              <rect
                x="35"
                y="16"
                width="445"
                height="36"
                fill="#FF3B4B"
                fillOpacity=".08"
              />
              <rect
                x="35"
                y="52"
                width="445"
                height="115"
                fill="#B749FF"
                fillOpacity=".07"
              />
              <g stroke="#35373D" strokeWidth="1">
                <path
                  d="M35 16H480M35 90H480M35 128H480M35 167H480"
                  strokeDasharray="2 5"
                />
              </g>
              <path d="M35 52H480" stroke="#FF3B4B" strokeOpacity=".7" />
              <g fill="#97999F" fontSize="9" fontFamily="sans-serif">
                <text x="0" y="20">
                  6,250
                </text>
                <text x="0" y="56" fill="#FF3B4B">
                  6,000
                </text>
                <text x="0" y="94">
                  5,750
                </text>
                <text x="0" y="132">
                  5,500
                </text>
                <text x="0" y="171">
                  5,250
                </text>
                <text x="35" y="187">
                  1
                </text>
                <text x="140" y="187">
                  7
                </text>
                <text x="250" y="187">
                  13
                </text>
                <text x="360" y="187">
                  19
                </text>
                <text x="468" y="187">
                  25
                </text>
              </g>
              <polyline
                points="35,160 54,145 73,150 92,136 111,129 130,132 149,112 168,100 187,112 206,97 225,88 244,90 263,79 282,74 301,82 320,69 339,62 358,68 377,56 396,61 415,48 434,40 453,45 475,46"
                fill="none"
                stroke="#ECEBE7"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="475" cy="46" r="4" fill="#ECEBE7" />
            </svg>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-[10px]">
              <span className="text-muted-foreground">
                Your climb, one finished game at a time.
              </span>
              <Link href="/demo/ranked" className="text-link">
                Try the demo <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border py-10 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker mb-3">Built around your games</p>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Less guesswork. More progress.
            </h2>
          </div>
          <Link href="/demo" className="text-link">
            See it in action <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          <HomeFeature
            number="01"
            title="Follow the climb"
            icon={<Swords className="h-4 w-4" />}
          >
            A rating curve that follows your games, with the same rank colors
            you know in game.
          </HomeFeature>
          <HomeFeature
            number="02"
            title="Know your best picks"
            icon={<Trophy className="h-4 w-4" />}
          >
            See how your brawlers perform across maps and modes, backed by your
            match history.
          </HomeFeature>
          <HomeFeature
            number="03"
            title="Keep the history"
            icon={<Check className="h-4 w-4" />}
          >
            Captured matches stay in your archive, even after they disappear
            from the recent battle log.
          </HomeFeature>
        </div>
      </section>
      <footer className="flex justify-end py-8 text-[10px] leading-relaxed text-muted-foreground">
        <a
          href="https://developer.brawlstars.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          Powered by the Brawl Stars API <ArrowUpRight className="h-3 w-3" />
        </a>
      </footer>
    </main>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border px-5 py-4 last:border-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}
function HomeFeature({
  number,
  title,
  icon,
  children,
}: {
  number: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono">{number}</span>
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Layers3, Sparkles, Waypoints } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f3efe7] text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-black/8 pb-5">
          <Link href="/" className="flex items-center gap-3 text-sm font-medium tracking-[0.18em] text-neutral-950 uppercase">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-semibold tracking-[0.24em]">
              DG
            </span>
            Drawgle
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-medium text-neutral-700 transition hover:border-black/20 hover:text-neutral-950"
            >
              Sign in
            </Link>
            <Link
              href="/project/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="flex flex-1 items-center py-14 lg:py-20">
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1.05fr)_360px] lg:items-end">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                <Sparkles className="h-3.5 w-3.5" />
                Public landing
              </div>

              <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-[-0.06em] text-neutral-950 sm:text-6xl lg:text-7xl">
                Design the app in one protected workspace, then step into the canvas only when it is time to build.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">
                Drawgle keeps the public site clean. The actual project brief, design-system approval, planning, and build kickoff all happen inside the authenticated workspace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/project/new"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  Enter the workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-full border border-black/10 px-5 text-sm font-medium text-neutral-700 transition hover:border-black/20 hover:text-neutral-950"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                {
                  icon: Layers3,
                  title: "Single protected workspace",
                  description: "Start every project from one place instead of splitting the prompt, planning, and review across multiple pages.",
                },
                {
                  icon: Waypoints,
                  title: "Approved before generation",
                  description: "Brief, design tokens, and the first screen plan are reviewed before the canvas run begins.",
                },
                {
                  icon: Sparkles,
                  title: "Cleaner canvas",
                  description: "The build canvas stays focused on screens and editing, not on project switching chrome.",
                },
              ].map((item) => (
                <div key={item.title} className="border border-black/8 bg-white/70 px-5 py-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-neutral-500" />
                    <div className="text-sm font-semibold text-neutral-950">{item.title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText, Zap, Shield, History, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">DocEditor</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Write together.
            <br />
            <span className="text-primary">Even offline.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            A local-first collaborative document editor powered by CRDTs. Edit instantly
            in the browser, sync in the background, and never lose a change.
          </p>
          <Button size="lg" asChild>
            <Link href="/register">Start writing free</Link>
          </Button>
        </section>

        <section className="border-t border-border/50 bg-card/30 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                title: "Local-First",
                desc: "IndexedDB + Yjs CRDT. Zero network latency while typing.",
              },
              {
                icon: Shield,
                title: "Offline Sync",
                desc: "Queued changes with exponential backoff retry when back online.",
              },
              {
                icon: History,
                title: "Time Travel",
                desc: "Manual snapshots with safe CRDT merge on restore.",
              },
              {
                icon: Users,
                title: "Real-time",
                desc: "Live cursors, presence, and role-based access control.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border/50 p-6">
                <Icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

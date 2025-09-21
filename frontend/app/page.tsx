export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Podium</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 max-w-xl">
        <a
          href="/scene"
          className="rounded-lg border bg-card text-card-foreground px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Open Scene
        </a>
        <a
          href="/questionnaire"
          className="rounded-lg border bg-card text-card-foreground px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Questionnaire
        </a>
        <a
          href="/report"
          className="rounded-lg border bg-card text-card-foreground px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Final Report
        </a>
      </div>
    </main>
  );
}

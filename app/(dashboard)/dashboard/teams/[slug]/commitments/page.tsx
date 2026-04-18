interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CommitmentsPage({ params }: Props) {
  const { slug } = await params;
  void slug;
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Commitments</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          What this team committed to this cycle.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center space-y-3">
        <h3 className="font-semibold text-sm text-foreground">
          What this team committed to this cycle.
        </h3>
        <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto text-left">
          <p>
            Active requests shows everything in progress. Commitments is
            different — it&apos;s what this team deliberately picked to run
            in the current cycle. Usually set during a planning meeting.
          </p>
          <p>
            Nothing&apos;s committed yet. When your team picks what to work
            on next, it shows up here.
          </p>
        </div>
      </div>
    </div>
  );
}

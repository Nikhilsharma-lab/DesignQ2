interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ActiveRequestsPage({ params }: Props) {
  const { slug } = await params;
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Active requests</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Requests currently in progress for this team.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          No active requests yet.
        </p>
      </div>
    </div>
  );
}

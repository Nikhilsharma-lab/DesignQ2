export default function MyStreamsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My streams</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Streams you own or are assigned to.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          You&apos;re clear. Time to think, learn, or help a teammate.
        </p>
      </div>
    </div>
  );
}

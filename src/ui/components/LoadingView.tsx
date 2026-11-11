export function LoadingView() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-1 bg-background text-center text-foreground">
      <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
      <h2 className="mt-2 font-semibold">Waiting for the app…</h2>
      <p className="max-w-xs text-muted-foreground">
        Open your React Native app with <code className="font-mono">useGraphqlClientDevtool</code> set up.
      </p>
    </div>
  );
}

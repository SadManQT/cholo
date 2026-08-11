// The one loading state ProtectedRoute needs before it even knows who's
// asking (doc 11 §8's own ProtectedRoute snippet references this by name).
// Deliberately not part of the ui/ kit inventory (doc 12 §2.4's named
// eight) — this is an app-shell boot state, not a reusable design-system
// primitive.
export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt">
      <svg className="h-8 w-8 animate-spin text-cholo-700" viewBox="0 0 24 24" fill="none" aria-label="Loading">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}

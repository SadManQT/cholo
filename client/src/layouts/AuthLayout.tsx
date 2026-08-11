import { Outlet } from 'react-router-dom';

// doc 12 §4: guest/auth screens — "full-screen, phone-first; desktop shows
// centered card", "single column, one screen, no scroll."
export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
        <Outlet />
      </div>
    </div>
  );
}

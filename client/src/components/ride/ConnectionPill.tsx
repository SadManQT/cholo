import type { SocketConnectionState } from '../../context/socket';

export function ConnectionPill({ state }: { state: SocketConnectionState }) {
  if (state === 'connected') return null;

  return (
    <div className="fixed left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      {state === 'disconnected' ? 'Live updates offline' : 'Reconnecting live updates…'}
    </div>
  );
}

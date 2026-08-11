import { createContext, useContext } from 'react';
import type { Socket } from 'socket.io-client';

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface SocketContextValue {
  socket: Socket | null;
  connectionState: SocketConnectionState;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocket() {
  const value = useContext(SocketContext);
  if (!value) throw new Error('useSocket must be used within a SocketProvider');
  return value;
}

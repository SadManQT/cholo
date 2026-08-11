import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';
import * as meApi from '../api/me.api';
import { env } from '../config/env';
import { useAuth } from './auth';
import { SocketContext } from './socket';
import type { SocketConnectionState } from './socket';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('disconnected');
  const recovering = useRef(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnectionState('disconnected');
      return;
    }

    const nextSocket = io(env.socketUrl, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      // Socket.IO invokes this again for every namespace connection, so a
      // reconnect uses the access token most recently rotated by Axios.
      auth: (callback) => callback({ token: getAccessToken() }),
    });

    async function refreshAndReconnect() {
      if (recovering.current) return;
      recovering.current = true;
      setConnectionState('reconnecting');

      try {
        // An expired bearer makes api/client.ts rotate the httpOnly refresh
        // cookie, update its in-memory token, then retry this request.
        await meApi.getMe();
        if (!nextSocket.connected) nextSocket.connect();
      } catch {
        setConnectionState('disconnected');
      } finally {
        recovering.current = false;
      }
    }

    nextSocket.on('connect', () => setConnectionState('connected'));
    nextSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        void refreshAndReconnect();
      } else {
        setConnectionState('reconnecting');
      }
    });
    nextSocket.on('connect_error', (error) => {
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'AUTH_REQUIRED') {
        void refreshAndReconnect();
      } else {
        setConnectionState('reconnecting');
      }
    });
    nextSocket.io.on('reconnect_attempt', () => setConnectionState('reconnecting'));
    nextSocket.io.on('reconnect_failed', () => setConnectionState('disconnected'));

    setSocket(nextSocket);
    setConnectionState('connecting');
    nextSocket.connect();

    return () => {
      recovering.current = false;
      nextSocket.removeAllListeners();
      nextSocket.io.removeAllListeners();
      nextSocket.close();
    };
  }, [user]);

  return <SocketContext.Provider value={{ socket, connectionState }}>{children}</SocketContext.Provider>;
}

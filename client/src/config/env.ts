const apiUrl = import.meta.env.VITE_SAME_ORIGIN_API || import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error('VITE_API_URL is not set — copy client/.env.example to client/.env');
}

const socketUrl = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin);

export const env = Object.freeze({ apiUrl, socketUrl });

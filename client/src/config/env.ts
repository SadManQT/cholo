const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error('VITE_API_URL is not set — copy client/.env.example to client/.env');
}

export const env = Object.freeze({
  apiUrl,
  socketUrl: import.meta.env.VITE_SOCKET_URL || new URL(apiUrl).origin,
});

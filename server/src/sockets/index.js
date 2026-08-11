import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { corsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import { registerLocationHandler } from './location.handler.js';
import { joinIdentityRooms } from './rooms.js';

let io = null;

// doc 08-09-10 §10: "the WebSocket handshake carries the access token
// ... the server verifies it exactly like the HTTP middleware before the
// connection is accepted" — same jwt.verify + same claim shape as
// middlewares/auth.js, just reached through io.use() instead of Express
// middleware. This runs ONCE per connection, not per event: everything a
// socket does afterward is authorized off socket.user set here, never a
// second verify per emit.
function verifyHandshake(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('AUTH_REQUIRED'));
  }

  try {
    const claims = jwt.verify(token, env.JWT_SECRET);
    socket.user = {
      id: Number(claims.sub),
      roles: claims.roles,
      sessionId: claims.sid,
      // location.handler.js's "next sensitive emit re-checks" (doc 08-09-10
      // §10) — claims.exp is seconds-since-epoch (jsonwebtoken's own
      // convention), converted once here so the hot path is a plain number
      // compare, not a re-verify.
      tokenExpiresAt: claims.exp * 1000,
    };
    next();
  } catch {
    next(new Error('TOKEN_EXPIRED'));
  }
}

// server.js only — never app.js. Same two-file reasoning as everywhere else
// in this codebase: supertest imports app.js and must never open a real
// port or start a socket server just to exercise an HTTP route.
export function attachSocketServer(httpServer) {
  io = new Server(httpServer, { cors: corsOptions });

  io.use(verifyHandshake);

  io.on('connection', async (socket) => {
    await joinIdentityRooms(socket);
    registerLocationHandler(io, socket);
  });

  return io;
}

// Exactly three events to start (doc 13-14 step 15): offer:new and
// trip:status are server -> client only, emitted from dispatch.service.js/
// trips.service.js via this getter — the doc's own sequence diagram draws
// that arrow directly ("S->>IO: trip status changed"), so a service calling
// out to the socket layer is the documented design, not a shortcut. Returns
// null when no server ever called attachSocketServer (every test file that
// imports app.js instead of server.js) — callers treat that as a no-op,
// not an error.
export function getIO() {
  return io;
}

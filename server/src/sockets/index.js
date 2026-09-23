import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { corsOptions } from '../config/cors.js';
import { env } from '../config/env.js';
import { registerLocationHandler } from './location.handler.js';
import { joinIdentityRooms } from './rooms.js';

let io = null;

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
      tokenExpiresAt: claims.exp * 1000,
    };
    next();
  } catch {
    next(new Error('TOKEN_EXPIRED'));
  }
}

export function attachSocketServer(httpServer) {
  io = new Server(httpServer, { cors: corsOptions });

  io.use(verifyHandshake);

  io.on('connection', async (socket) => {
    await joinIdentityRooms(socket);
    registerLocationHandler(io, socket);
  });

  return io;
}

export function getIO() {
  return io;
}

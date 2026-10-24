import express from "express";
import http from "http";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./controllers/socketController";
import router from "./routes/router"; // Updated import path
import dotenv from 'dotenv';
import cors from 'cors';
import teamRoutes from './routes/team';
import executionRoutes from './routes/executions'; // queued Judge0 execution
import { assertSafeAuthConfig } from './auth/verifyToken';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { createRedis } from './queue/connection';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from './logger';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

// V2 removed: /api/compile (unauthenticated host-side exec) and the Socket.IO "terminal"
// (spawned bash on the host for every connection). Code execution goes through Judge0 only.

const corsOrigins = () =>
  (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(o => o.trim());

export function createApp() {
  const app = express();

  // Configure CORS
  const corsOptions = {
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 600,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  // Apply CORS middleware before any other middleware
  app.use(cors(corsOptions));

  // Handle preflight requests
  app.options('*', cors(corsOptions));

  // Structured request logs (JSON): request id (honours X-Request-Id), status, latency, user id.
  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = (req.headers['x-request-id'] as string) || randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customProps: (req) => ({ userId: (req as any).user?.id }),
    autoLogging: { ignore: (req) => req.url === '/healthz' },
  }));

  // Middleware
  app.use(express.json({ limit: '256kb' }));

  app.use(healthRoutes);

  // Routes
  app.use("/api", router);
  app.use('/api/teams', teamRoutes);
  app.use('/api/executions', executionRoutes);

  // Last-resort error handler: log with the request id, never leak internals to the client.
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    (req as any).log?.error({ err }, 'unhandled error');
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export function startServer(port: number | string = process.env.PORT || 3000) {
  assertSafeAuthConfig();
  const app = createApp();

  // Create an HTTP server
  const server = http.createServer(app);

  // Attach Socket.IO to the HTTP server
  const io = new Server(server, {
    cors: {
      origin: corsOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // V2: with REDIS_URL set, the Redis adapter fans room broadcasts and fetchSockets() out to every
  // API instance, so clients connected to different instances see each other's events.
  // (Hocuspocus/Yjs traffic does not go through Socket.IO and is scaled separately.)
  let pub: Redis | null = null;
  let sub: Redis | null = null;
  const useAdapter = !!process.env.REDIS_URL && process.env.SOCKET_REDIS_ADAPTER !== 'false';
  if (useAdapter) {
    pub = createRedis();
    sub = pub.duplicate();
    pub.on('error', err => console.error('[socket.io redis] pub error:', err.message));
    sub.on('error', err => console.error('[socket.io redis] sub error:', err.message));
    io.adapter(createAdapter(pub, sub));
  }

  // Socket.IO Handlers
  setupSocketHandlers(io, { redis: pub });

  const close = async () => {
    io.close();
    await new Promise<void>(r => server.close(() => r()));
    await Promise.all([pub?.quit().catch(() => undefined), sub?.quit().catch(() => undefined)]);
  };

  return new Promise<{ server: http.Server; io: Server; port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : Number(port);
      logger.info({ port: actualPort, redisAdapter: useAdapter }, 'api server listening');
      resolve({ server, io, port: actualPort, close });
    });
  });
}

if (require.main === module) {
  startServer();
}

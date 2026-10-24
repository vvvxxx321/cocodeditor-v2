import pino from 'pino';

/**
 * Structured JSON logger shared by the API, collab server and worker.
 * Credentials are redacted wherever they appear in logged objects.
 */
export const REDACT = {
  paths: [
    'req.headers.authorization', 'req.headers.cookie', 'req.headers["x-internal-secret"]',
    'headers.authorization', 'token', '*.token', 'password', '*.password',
  ],
  censor: '[REDACTED]',
};

export const createLogger = (destination?: pino.DestinationStream) => pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: process.env.SERVICE_NAME || 'api' },
  redact: REDACT,
}, destination);

export const logger = createLogger();

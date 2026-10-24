import dotenv from 'dotenv';
dotenv.config();
process.env.SERVICE_NAME ||= 'collab';

import { assertSafeAuthConfig } from '../auth/verifyToken';
import { logger } from '../logger';
import { createCollabServer } from './server';

assertSafeAuthConfig();
const server = createCollabServer();
server.listen().then(() => logger.info({ port: server.address.port }, 'collab server listening'));

const shutdown = async () => {
  // destroy() flushes pending debounced stores before closing.
  await server.destroy();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

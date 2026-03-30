import dns from 'node:dns';

// Force all network requests to prioritize IPv4
dns.setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const { app } = await import('./app.ts');
const { config } = await import('./config/index.ts');
const { logger } = await import('./config/winstonLogger.ts');
const { prisma } = await import('./lib/prisma.ts');
await import('./config/cloudinary.ts');

try {
  await prisma.$connect();
  logger.info('Prisma connected successfully');
} catch (error) {
  logger.error('Prisma connection failed', error);
  process.exit(1);
}

app.listen(config.PORT, () => {
  logger.info(`server is running on ${config.APP_URL}`);
});

import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const { app } = await import('./app.js');
const { config } = await import('./config/index.js');
const { logger } = await import('./config/winstonLogger.js');
const { prisma } = await import('./lib/prisma.js');
await import('./config/cloudinary.js');

try {
  await prisma.$connect();
  logger.info('Prisma connected successfully');
} catch (error) {
  logger.error('Prisma connection failed', error);
}

if (!process.env.VERCEL) {
  app.listen(config.PORT, () => {
    logger.info(`server is running on ${config.APP_URL}`);
  });
}

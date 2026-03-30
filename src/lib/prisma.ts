import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

export { prisma };

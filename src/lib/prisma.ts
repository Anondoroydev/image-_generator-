import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
}

const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined;
const prisma = new PrismaClient({
  ...(adapter ? { adapter } : {}),
  log: ['info', 'warn', 'error'],
});

export { prisma };

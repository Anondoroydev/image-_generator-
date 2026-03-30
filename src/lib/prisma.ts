import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      // eslint-disable-next-line no-console
      console.error('❌ DATABASE_URL is not defined in environment variables');
    }

    try {
      const adapter = connectionString
        ? new PrismaPg({ connectionString })
        : undefined;
      _prisma = new PrismaClient({
        ...(adapter ? { adapter } : {}),
        log: ['info', 'warn', 'error'],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to initialize PrismaClient:', err);
      // Create a bare PrismaClient without the adapter as a fallback
      _prisma = new PrismaClient({
        log: ['info', 'warn', 'error'],
      });
    }
  }
  return _prisma;
}

// Use a Proxy so `prisma.xxx` works like before, but initialization is lazy
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Optional query logging in debug mode
if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug(`[Prisma Query] ${e.query} (${e.duration}ms)`);
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error(`[Prisma Error] ${e.message}`);
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully.');
  } catch (error) {
    logger.error({ error }, '❌ Failed to connect to database.');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected.');
}

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/database/prisma.js';
import { logger } from '../src/utils/logger.js';

async function restore() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    logger.error('Usage: npm run restore <path_to_backup_json>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), backupFile);
  if (!fs.existsSync(filePath)) {
    logger.error(`Backup file not found: ${filePath}`);
    process.exit(1);
  }

  logger.info(`📦 Restoring database from: ${filePath}...`);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(rawData);

  // Restore within transaction
  await prisma.$transaction(async (tx) => {
    // 1. Settings
    for (const s of data.settings || []) {
      await tx.guildSettings.upsert({
        where: { guildId: s.guildId },
        update: s,
        create: s,
      });
    }

    // 2. Customers
    for (const c of data.customers || []) {
      await tx.customer.upsert({
        where: { id: c.id },
        update: c,
        create: c,
      });
    }

    // 3. Bookings
    for (const b of data.bookings || []) {
      const { customer, reminders, ...bData } = b;
      await tx.booking.upsert({
        where: { id: b.id },
        update: {
          ...bData,
          startAt: new Date(bData.startAt),
          endAt: new Date(bData.endAt),
          createdAt: new Date(bData.createdAt),
          updatedAt: new Date(bData.updatedAt),
          completedAt: bData.completedAt ? new Date(bData.completedAt) : null,
          cancelledAt: bData.cancelledAt ? new Date(bData.cancelledAt) : null,
        },
        create: {
          ...bData,
          startAt: new Date(bData.startAt),
          endAt: new Date(bData.endAt),
          createdAt: new Date(bData.createdAt),
          updatedAt: new Date(bData.updatedAt),
          completedAt: bData.completedAt ? new Date(bData.completedAt) : null,
          cancelledAt: bData.cancelledAt ? new Date(bData.cancelledAt) : null,
        },
      });
    }

    // 4. Blocked Times
    for (const blk of data.blockedTimes || []) {
      await tx.blockedTime.upsert({
        where: { id: blk.id },
        update: {
          ...blk,
          startAt: new Date(blk.startAt),
          endAt: new Date(blk.endAt),
          createdAt: new Date(blk.createdAt),
          updatedAt: new Date(blk.updatedAt),
        },
        create: {
          ...blk,
          startAt: new Date(blk.startAt),
          endAt: new Date(blk.endAt),
          createdAt: new Date(blk.createdAt),
          updatedAt: new Date(blk.updatedAt),
        },
      });
    }
  });

  logger.info('✅ Restore completed successfully.');
}

restore()
  .catch((err) => {
    logger.error({ err }, '❌ Restore failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

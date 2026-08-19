import fs from 'fs';
import path from 'path';
import { prisma } from '../src/database/prisma.js';
import { logger } from '../src/utils/logger.js';

async function backup() {
  logger.info('📦 Starting database JSON export backup...');

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

  const settings = await prisma.guildSettings.findMany();
  const customers = await prisma.customer.findMany();
  const bookings = await prisma.booking.findMany();
  const blockedTimes = await prisma.blockedTime.findMany();
  const reminders = await prisma.reminder.findMany();
  const auditLogs = await prisma.auditLog.findMany();

  const data = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    settings,
    customers,
    bookings,
    blockedTimes,
    reminders,
    auditLogs,
  };

  fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
  logger.info(`✅ Backup created successfully at: ${backupFile}`);
}

backup()
  .catch((err) => {
    logger.error({ err }, '❌ Backup failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

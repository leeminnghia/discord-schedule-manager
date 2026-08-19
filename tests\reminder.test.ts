import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { reminderService } from '../src/services/reminder.service.js';
import { bookingService } from '../src/services/booking.service.js';
import { settingsService } from '../src/services/settings.service.js';
import { REMINDER_STATUS } from '../src/config/constants.js';

describe('Reminder & Scheduler Persistence Tests', () => {
  const guildId = 'test-guild-reminders';

  beforeAll(async () => {
    await prisma.$connect();
    await settingsService.updateSettings(guildId, {
      reminderOffsetsMinutes: '30,10,0',
      workingHoursJson: JSON.stringify({
        tue: { start: '00:00', end: '23:59', enabled: true },
      }),
    });
  });

  afterAll(async () => {
    await prisma.reminder.deleteMany({ where: { guildId } });
    await prisma.booking.deleteMany({ where: { guildId } });
    await prisma.guildSettings.deleteMany({ where: { guildId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.reminder.deleteMany({ where: { guildId } });
    await prisma.booking.deleteMany({ where: { guildId } });
  });

  it('should persist reminders with correct offsets in database for future booking', async () => {
    const booking = await bookingService.createBooking({
      guildId,
      customerName: 'Khách Reminder Test',
      dateStr: '25/08/2026',
      startTimeStr: '14:00',
      durationStr: '2h',
      createdBy: 'admin-1',
    });

    const reminders = await prisma.reminder.findMany({
      where: { bookingId: booking.id },
      orderBy: { offsetMinutes: 'desc' },
    });

    expect(reminders.length).toBe(3); // 30, 10, 0
    expect(reminders.map((r) => r.offsetMinutes)).toEqual([30, 10, 0]);
    expect(reminders.every((r) => r.status === REMINDER_STATUS.PENDING)).toBe(true);
  });

  it('should handle startup recovery without duplicating or sending outdated reminders', async () => {
    const booking = await bookingService.createBooking({
      guildId,
      customerName: 'Khách Old Reminder',
      dateStr: '25/08/2026',
      startTimeStr: '14:00',
      durationStr: '2h',
      createdBy: 'admin-1',
    });

    const pastTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    const oldReminder = await prisma.reminder.create({
      data: {
        guildId,
        bookingId: booking.id,
        offsetMinutes: 30,
        scheduledAt: pastTime,
        status: REMINDER_STATUS.PENDING,
      },
    });

    const result = await reminderService.processStartupRecovery();
    expect(result.missedCount).toBeGreaterThanOrEqual(1);

    const updatedOldReminder = await prisma.reminder.findUnique({ where: { id: oldReminder.id } });
    expect(updatedOldReminder?.status).toBe(REMINDER_STATUS.MISSED);
  });
});

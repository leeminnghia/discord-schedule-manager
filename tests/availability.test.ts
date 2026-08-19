import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { availabilityService } from '../src/services/availability.service.js';
import { settingsService } from '../src/services/settings.service.js';
import { parseDateTimeInTimezone } from '../src/utils/timezone.js';
import { BOOKING_STATUS } from '../src/config/constants.js';

describe('Availability & Overlap Conflict Logic Tests', () => {
  const guildId = 'test-guild-availability';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.reminder.deleteMany({ where: { guildId } });
    await prisma.booking.deleteMany({ where: { guildId } });
    await prisma.blockedTime.deleteMany({ where: { guildId } });
    await prisma.guildSettings.deleteMany({ where: { guildId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.reminder.deleteMany({ where: { guildId } });
    await prisma.booking.deleteMany({ where: { guildId } });
    await prisma.blockedTime.deleteMany({ where: { guildId } });

    // Setup guild with buffer = 0 initially
    await settingsService.updateSettings(guildId, {
      minimumBufferMinutes: 0,
      workingHoursJson: JSON.stringify({
        wed: { start: '08:00', end: '23:00', enabled: true },
      }),
    });
  });

  it('should detect overlap correctly for existing booking 14:00 - 17:00 (Buffer = 0)', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Khách Overlap Test' },
    });

    const startAt = parseDateTimeInTimezone('19/08/2026', '14:00');
    const endAt = parseDateTimeInTimezone('19/08/2026', '17:00');

    await prisma.booking.create({
      data: {
        guildId,
        bookingCode: 'BK-TEST-001',
        customerId: customer.id,
        customerName: customer.name,
        startAt,
        endAt,
        durationMinutes: 180,
        status: BOOKING_STATUS.CONFIRMED,
        createdBy: 'test-admin',
      },
    });

    // 13:00 - 14:00 => ALLOW
    const res1 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '13:00'),
      parseDateTimeInTimezone('19/08/2026', '14:00')
    );
    expect(res1.hasConflict).toBe(false);

    // 13:00 - 15:00 => DENY
    const res2 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '13:00'),
      parseDateTimeInTimezone('19/08/2026', '15:00')
    );
    expect(res2.hasConflict).toBe(true);

    // 14:00 - 16:00 => DENY
    const res3 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '14:00'),
      parseDateTimeInTimezone('19/08/2026', '16:00')
    );
    expect(res3.hasConflict).toBe(true);

    // 15:00 - 18:00 => DENY
    const res4 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '15:00'),
      parseDateTimeInTimezone('19/08/2026', '18:00')
    );
    expect(res4.hasConflict).toBe(true);

    // 14:00 - 17:00 => DENY (Exact same)
    const res5 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '14:00'),
      parseDateTimeInTimezone('19/08/2026', '17:00')
    );
    expect(res5.hasConflict).toBe(true);

    // 13:00 - 18:00 => DENY (Enclosing)
    const res6 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '13:00'),
      parseDateTimeInTimezone('19/08/2026', '18:00')
    );
    expect(res6.hasConflict).toBe(true);

    // 17:00 - 18:00 => ALLOW (Directly adjacent with buffer = 0)
    const res7 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '17:00'),
      parseDateTimeInTimezone('19/08/2026', '18:00')
    );
    expect(res7.hasConflict).toBe(false);
  });

  it('should enforce buffer time between bookings correctly', async () => {
    // Set buffer to 10 minutes
    await settingsService.updateSettings(guildId, {
      minimumBufferMinutes: 10,
    });

    const customer = await prisma.customer.create({
      data: { name: 'Khách Buffer Test' },
    });

    await prisma.booking.create({
      data: {
        guildId,
        bookingCode: 'BK-TEST-002',
        customerId: customer.id,
        customerName: customer.name,
        startAt: parseDateTimeInTimezone('19/08/2026', '14:00'),
        endAt: parseDateTimeInTimezone('19/08/2026', '16:00'),
        durationMinutes: 120,
        status: BOOKING_STATUS.CONFIRMED,
        createdBy: 'test-admin',
      },
    });

    // 16:00 - 18:00 => DENY (needs 10 min buffer after 16:00)
    const res1 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '16:00'),
      parseDateTimeInTimezone('19/08/2026', '18:00')
    );
    expect(res1.hasConflict).toBe(true);

    // 16:05 - 18:00 => DENY (only 5 min buffer)
    const res2 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '16:05'),
      parseDateTimeInTimezone('19/08/2026', '18:00')
    );
    expect(res2.hasConflict).toBe(true);

    // 16:10 - 18:00 => ALLOW (exactly 10 min buffer)
    const res3 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '16:10'),
      parseDateTimeInTimezone('19/08/2026', '18:00')
    );
    expect(res3.hasConflict).toBe(false);
  });

  it('should ignore CANCELLED bookings during conflict check', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Khách Cancelled Test' },
    });

    await prisma.booking.create({
      data: {
        guildId,
        bookingCode: 'BK-TEST-003',
        customerId: customer.id,
        customerName: customer.name,
        startAt: parseDateTimeInTimezone('19/08/2026', '14:00'),
        endAt: parseDateTimeInTimezone('19/08/2026', '16:00'),
        durationMinutes: 120,
        status: BOOKING_STATUS.CANCELLED,
        createdBy: 'test-admin',
      },
    });

    // Slot 14:00 - 16:00 should now be completely available
    const res = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '14:00'),
      parseDateTimeInTimezone('19/08/2026', '16:00')
    );
    expect(res.hasConflict).toBe(false);
  });

  it('should detect conflict with BlockedTime', async () => {
    await prisma.blockedTime.create({
      data: {
        guildId,
        startAt: parseDateTimeInTimezone('19/08/2026', '12:00'),
        endAt: parseDateTimeInTimezone('19/08/2026', '13:30'),
        reason: 'Ăn trưa & nghỉ ngơi',
        createdBy: 'test-admin',
      },
    });

    // Try booking 12:30 - 14:00 => DENY
    const res = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '12:30'),
      parseDateTimeInTimezone('19/08/2026', '14:00')
    );
    expect(res.hasConflict).toBe(true);
    expect(res.conflictingItem?.type).toBe('BLOCKED');
  });

  it('should reject bookings outside of working hours', async () => {
    // Working hours for Wed: 08:00 - 23:00
    // Try booking starting at 07:00 => DENY
    const res1 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '07:00'),
      parseDateTimeInTimezone('19/08/2026', '09:00')
    );
    expect(res1.hasConflict).toBe(true);

    // Try booking ending at 23:30 => DENY
    const res2 = await availabilityService.checkConflict(
      guildId,
      parseDateTimeInTimezone('19/08/2026', '22:00'),
      parseDateTimeInTimezone('19/08/2026', '23:30')
    );
    expect(res2.hasConflict).toBe(true);
  });
});

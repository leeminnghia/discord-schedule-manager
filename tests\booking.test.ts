import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { bookingService } from '../src/services/booking.service.js';
import { settingsService } from '../src/services/settings.service.js';
import { BOOKING_STATUS } from '../src/config/constants.js';
import { formatTime, formatDate } from '../src/utils/timezone.js';
import { ConflictError } from '../src/utils/errors.js';

describe('Booking Service Full Lifecycle Tests', () => {
  const guildId = 'test-guild-booking';

  beforeAll(async () => {
    await prisma.$connect();
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

    await settingsService.updateSettings(guildId, {
      minimumBufferMinutes: 10,
      workingHoursJson: JSON.stringify({
        mon: { start: '00:00', end: '24:00', enabled: true },
        tue: { start: '00:00', end: '24:00', enabled: true },
        wed: { start: '00:00', end: '24:00', enabled: true },
        thu: { start: '00:00', end: '24:00', enabled: true },
        fri: { start: '00:00', end: '24:00', enabled: true },
        sat: { start: '00:00', end: '24:00', enabled: true },
        sun: { start: '00:00', end: '24:00', enabled: true },
      }),
    });
  });

  it('Flow 1: should create booking and generate valid booking code and calculate end time', async () => {
    const booking = await bookingService.createBooking({
      guildId,
      customerName: 'Nguyễn Văn Test',
      dateStr: '25/08/2026',
      startTimeStr: '14:00',
      durationStr: '3h',
      note: 'Khách test booking flow',
      createdBy: 'admin-test',
    });

    expect(booking.bookingCode).toMatch(/^BK-20260825-\d{3}$/);
    expect(booking.customerName).toBe('Nguyễn Văn Test');
    expect(formatTime(booking.startAt)).toBe('14:00');
    expect(formatTime(booking.endAt)).toBe('17:00');
    expect(booking.durationMinutes).toBe(180);
    expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED);

    // Verify customer record created
    const customer = await prisma.customer.findUnique({ where: { id: booking.customerId } });
    expect(customer).not.toBeNull();
    expect(customer?.name).toBe('Nguyễn Văn Test');
    expect(customer?.totalBookings).toBe(1);

    // Verify reminders created
    const reminders = await prisma.reminder.findMany({ where: { bookingId: booking.id } });
    expect(reminders.length).toBeGreaterThan(0);
  });

  it('Flow 2: should reject overlapping booking request (16:00 - 18:00)', async () => {
    // Booking 1: 14:00 - 17:00
    await bookingService.createBooking({
      guildId,
      customerName: 'Khách A',
      dateStr: '19/08/2026',
      startTimeStr: '14:00',
      durationStr: '3h',
      createdBy: 'admin-user-1',
    });

    // Booking 2: 16:00 - 18:00 (Overlap) -> Expect ConflictError
    await expect(
      bookingService.createBooking({
        guildId,
        customerName: 'Khách XYZ',
        dateStr: '19/08/2026',
        startTimeStr: '16:00',
        durationStr: '2h',
        createdBy: 'admin-user-1',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('Flow 3: should test buffer logic on adjacent booking (17:00 with buffer=10 vs buffer=0)', async () => {
    // Buffer = 10m
    await bookingService.createBooking({
      guildId,
      customerName: 'Khách A',
      dateStr: '19/08/2026',
      startTimeStr: '14:00',
      durationStr: '3h', // Ends at 17:00
      createdBy: 'admin-user-1',
    });

    // Attempting 17:00 start with 10 min buffer -> Rejects
    await expect(
      bookingService.createBooking({
        guildId,
        customerName: 'Khách XYZ',
        dateStr: '19/08/2026',
        startTimeStr: '17:00',
        durationStr: '2h',
        createdBy: 'admin-user-1',
      })
    ).rejects.toThrow(ConflictError);

    // Attempting 17:10 start with 10 min buffer -> Allowed
    const bookingAdjacent = await bookingService.createBooking({
      guildId,
      customerName: 'Khách XYZ',
      dateStr: '19/08/2026',
      startTimeStr: '17:10',
      durationStr: '2h',
      createdBy: 'admin-user-1',
    });
    expect(bookingAdjacent).toBeDefined();
    expect(formatTime(bookingAdjacent.startAt)).toBe('17:10');
  });

  it('Flow 4: should reschedule booking to new slot and regenerate reminders', async () => {
    const booking = await bookingService.createBooking({
      guildId,
      customerName: 'Khách Dời Lịch',
      dateStr: '19/08/2026',
      startTimeStr: '14:00',
      durationStr: '3h', // 14:00 - 17:00
      createdBy: 'admin-user-1',
    });

    const rescheduled = await bookingService.rescheduleBooking({
      guildId,
      bookingCode: booking.bookingCode,
      newDateStr: '19/08/2026',
      newStartTimeStr: '20:00',
      executorId: 'admin-user-1',
      executorTag: 'Admin#0001',
    });

    expect(formatTime(rescheduled.startAt)).toBe('20:00');
    expect(formatTime(rescheduled.endAt)).toBe('23:00');
    expect(rescheduled.durationMinutes).toBe(180);
  });

  it('Flow 5: should extend and shorten booking duration', async () => {
    const booking = await bookingService.createBooking({
      guildId,
      customerName: 'Khách Gia Hạn',
      dateStr: '19/08/2026',
      startTimeStr: '14:00',
      durationStr: '2h', // 14:00 - 16:00
      createdBy: 'admin-user-1',
    });

    // Extend +1h -> 14:00 - 17:00
    const extended = await bookingService.extendBooking({
      guildId,
      bookingCode: booking.bookingCode,
      extraDurationStr: '1h',
      executorId: 'admin-user-1',
      executorTag: 'Admin#0001',
    });
    expect(extended.durationMinutes).toBe(180);
    expect(formatTime(extended.endAt)).toBe('17:00');

    // Shorten -30m -> 14:00 - 16:30
    const shortened = await bookingService.shortenBooking({
      guildId,
      bookingCode: booking.bookingCode,
      shortenByMinutes: 30,
      executorId: 'admin-user-1',
      executorTag: 'Admin#0001',
    });
    expect(shortened.durationMinutes).toBe(150);
    expect(formatTime(shortened.endAt)).toBe('16:30');
  });

  it('Flow 6: should cancel booking and release slot while keeping history', async () => {
    const booking = await bookingService.createBooking({
      guildId,
      customerName: 'Khách Hủy Lịch',
      dateStr: '19/08/2026',
      startTimeStr: '14:00',
      durationStr: '2h',
      createdBy: 'admin-user-1',
    });

    const cancelled = await bookingService.cancelBooking({
      guildId,
      bookingCode: booking.bookingCode,
      reason: 'Bận việc gia đình',
      executorId: 'admin-user-1',
      executorTag: 'Admin#0001',
    });

    expect(cancelled.status).toBe(BOOKING_STATUS.CANCELLED);
    expect(cancelled.cancellationReason).toBe('Bận việc gia đình');
    expect(cancelled.cancelledAt).not.toBeNull();

    // Verify slot can now be booked by another customer
    const newBooking = await bookingService.createBooking({
      guildId,
      customerName: 'Khách Mới Thay Thế',
      dateStr: '19/08/2026',
      startTimeStr: '14:00',
      durationStr: '2h',
      createdBy: 'admin-user-1',
    });
    expect(newBooking).toBeDefined();
  });
});

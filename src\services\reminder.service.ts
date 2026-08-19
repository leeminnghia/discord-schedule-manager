import { prisma } from '../database/prisma.js';
import { Reminder, Booking, GuildSettings } from '@prisma/client';
import { settingsService } from './settings.service.js';
import { REMINDER_STATUS, BOOKING_STATUS, TIMEZONE } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { formatTime, formatDate, nowInTimezone } from '../utils/timezone.js';
import { formatDuration } from '../utils/duration.js';
import { env } from '../config/env.js';

export interface DueReminderWithDetails extends Reminder {
  booking: Booking;
}

export class ReminderService {
  /**
   * Generates or regenerates reminders for a booking based on guild settings.
   */
  async createRemindersForBooking(booking: Booking, tx?: any): Promise<void> {
    const db = tx || prisma;
    const settings = await settingsService.getSettings(booking.guildId);
    const offsets = settingsService.parseReminderOffsets(settings);

    // Cancel existing pending reminders for this booking
    await db.reminder.updateMany({
      where: {
        bookingId: booking.id,
        status: REMINDER_STATUS.PENDING,
      },
      data: {
        status: REMINDER_STATUS.CANCELLED,
      },
    });

    const now = new Date();
    const reminderData = [];

    for (const offset of offsets) {
      const scheduledAt = new Date(booking.startAt.getTime() - offset * 60 * 1000);
      // Only schedule if in future (or very recently within threshold)
      if (scheduledAt > now || now.getTime() - scheduledAt.getTime() < 5 * 60 * 1000) {
        reminderData.push({
          guildId: booking.guildId,
          bookingId: booking.id,
          offsetMinutes: offset,
          scheduledAt,
          status: REMINDER_STATUS.PENDING,
        });
      }
    }

    if (reminderData.length > 0) {
      await db.reminder.createMany({
        data: reminderData,
      });
    }
  }

  /**
   * Fetches all due pending reminders ready to be sent.
   */
  async getDueReminders(): Promise<DueReminderWithDetails[]> {
    const now = new Date();
    return prisma.reminder.findMany({
      where: {
        status: REMINDER_STATUS.PENDING,
        scheduledAt: { lte: now },
        booking: {
          status: {
            in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PAID, BOOKING_STATUS.PENDING],
          },
        },
      },
      include: {
        booking: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Marks a reminder as sent
   */
  async markAsSent(reminderId: string): Promise<void> {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: REMINDER_STATUS.SENT,
        sentAt: new Date(),
      },
    });
  }

  /**
   * Marks a reminder as missed
   */
  async markAsMissed(reminderId: string): Promise<void> {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: REMINDER_STATUS.MISSED,
        sentAt: new Date(),
      },
    });
  }

  /**
   * Snoozes a reminder for N minutes
   */
  async snoozeReminder(bookingId: string, snoozeMinutes: number = 5): Promise<Reminder> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const scheduledAt = new Date(Date.now() + snoozeMinutes * 60 * 1000);

    return prisma.reminder.create({
      data: {
        guildId: booking.guildId,
        bookingId: booking.id,
        offsetMinutes: -snoozeMinutes, // Negative offset indicates snooze
        scheduledAt,
        status: REMINDER_STATUS.PENDING,
      },
    });
  }

  /**
   * Checks for missed reminders after startup and handles catch-up.
   */
  async processStartupRecovery(): Promise<{ processedCount: number; missedCount: number }> {
    const now = new Date();
    const thresholdMs = env.MISSED_REMINDER_THRESHOLD_MINUTES * 60 * 1000;

    const pendingReminders = await prisma.reminder.findMany({
      where: {
        status: REMINDER_STATUS.PENDING,
        scheduledAt: { lte: now },
      },
      include: { booking: true },
    });

    let processedCount = 0;
    let missedCount = 0;

    for (const r of pendingReminders) {
      const ageMs = now.getTime() - r.scheduledAt.getTime();
      if (ageMs > thresholdMs) {
        // Too old to send spam, mark missed
        await this.markAsMissed(r.id);
        missedCount++;
      } else {
        // Valid for immediate dispatch
        processedCount++;
      }
    }

    logger.info(`[Reminder Recovery] Verified ${pendingReminders.length} pending reminders. (${processedCount} ready, ${missedCount} missed).`);
    return { processedCount, missedCount };
  }
}

export const reminderService = new ReminderService();

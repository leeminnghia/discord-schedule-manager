import { prisma } from '../database/prisma.js';
import { BlockedTime } from '@prisma/client';
import { settingsService } from './settings.service.js';
import { parseDateTimeInTimezone, getStartOfDay, getEndOfDay, formatTime, formatDate } from '../utils/timezone.js';
import { ConflictError, ValidationError, NotFoundError } from '../utils/errors.js';
import { BOOKING_STATUS } from '../config/constants.js';

export interface CreateBlockInput {
  guildId: string;
  dateStr: string;
  startTimeStr: string;
  endTimeStr: string;
  reason: string;
  createdBy: string;
}

export class BlockedTimeService {
  /**
   * Creates a new blocked time period
   */
  async createBlock(input: CreateBlockInput): Promise<BlockedTime> {
    const settings = await settingsService.getSettings(input.guildId);
    const tz = settings.timezone;

    const startAt = parseDateTimeInTimezone(input.dateStr, input.startTimeStr, tz);
    const endAt = parseDateTimeInTimezone(input.dateStr, input.endTimeStr, tz);

    if (startAt >= endAt) {
      throw new ValidationError('Thời gian bắt đầu phải trước thời gian kết thúc.');
    }

    // Check conflict with active bookings
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        guildId: input.guildId,
        status: { not: BOOKING_STATUS.CANCELLED },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (overlappingBookings.length > 0) {
      const b = overlappingBookings[0];
      throw new ConflictError(
        `Không thể khóa thời gian vì đã có lịch của khách ${b.customerName} (${formatTime(b.startAt, tz)} → ${formatTime(
          b.endAt,
          tz
        )}).`
      );
    }

    return prisma.blockedTime.create({
      data: {
        guildId: input.guildId,
        startAt,
        endAt,
        reason: input.reason.trim(),
        createdBy: input.createdBy,
      },
    });
  }

  /**
   * Deletes / unblocks a blocked time period
   */
  async removeBlock(id: string, guildId: string): Promise<BlockedTime> {
    const block = await prisma.blockedTime.findFirst({
      where: { id, guildId },
    });

    if (!block) {
      throw new NotFoundError('Không tìm thấy khoảng thời gian bị khóa này.');
    }

    return prisma.blockedTime.delete({
      where: { id },
    });
  }

  /**
   * Retrieves all blocked times for a guild on a given date
   */
  async getBlocksForDate(guildId: string, date: Date): Promise<BlockedTime[]> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;

    const start = getStartOfDay(date, tz);
    const end = getEndOfDay(date, tz);

    return prisma.blockedTime.findMany({
      where: {
        guildId,
        startAt: { lt: end },
        endAt: { gt: start },
      },
      orderBy: { startAt: 'asc' },
    });
  }
}

export const blockedTimeService = new BlockedTimeService();

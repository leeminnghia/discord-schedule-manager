import { prisma } from '../database/prisma.js';
import { settingsService } from './settings.service.js';
import { TimeSlot, ConflictCheckResult } from '../types/schedule.types.js';
import { BOOKING_STATUS } from '../config/constants.js';
import {
  getStartOfDay,
  getEndOfDay,
  getWeekdayKey,
  parseDateTimeInTimezone,
  formatTime,
  formatDate,
  formatDateShort,
  addDaysTz,
  nowInTimezone,
} from '../utils/timezone.js';
import { formatDuration } from '../utils/duration.js';

export class AvailabilityService {
  /**
   * Checks whether a requested time interval [start, end] conflicts with working hours,
   * existing active bookings, or blocked times in the guild.
   * Supports seamless bookings across midnight (00:00 / 24:00).
   */
  async checkConflict(
    guildId: string,
    start: Date,
    end: Date,
    excludeBookingId?: string,
    bypassBuffer: boolean = false
  ): Promise<ConflictCheckResult> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;
    const bufferMins = bypassBuffer ? 0 : settings.minimumBufferMinutes;

    // 1. Check Working Hours
    const weekdayKey = getWeekdayKey(start, tz);
    const workingHoursConfig = settingsService.parseWorkingHours(settings);
    const dayConfig = workingHoursConfig[weekdayKey];

    if (!dayConfig || !dayConfig.enabled) {
      return {
        hasConflict: true,
        reason: `Ngày này không nằm trong thời gian làm việc được thiết lập.`,
      };
    }

    const is24h =
      (dayConfig.start === '00:00' || dayConfig.start === '0:00') &&
      (dayConfig.end === '24:00' || dayConfig.end === '23:59');

    if (!is24h) {
      const dayStartStr = formatDate(start, tz);
      const workStart = parseDateTimeInTimezone(dayStartStr, dayConfig.start, tz);
      const workEnd = parseDateTimeInTimezone(dayStartStr, dayConfig.end, tz);

      if (start < workStart || end > workEnd) {
        return {
          hasConflict: true,
          reason: `Khoảng thời gian yêu cầu (${formatTime(start, tz)} - ${formatTime(
            end,
            tz
          )}) vượt ngoài khung giờ làm việc (${dayConfig.start} - ${dayConfig.end}).`,
        };
      }
    }

    // 2. Fetch existing bookings overlapping with this window
    // Search window: [start - 1 day, end + 1 day]
    const searchStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const searchEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const existingBookings = await prisma.booking.findMany({
      where: {
        guildId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: { not: BOOKING_STATUS.CANCELLED },
        startAt: { lt: searchEnd },
        endAt: { gt: searchStart },
      },
      orderBy: { startAt: 'asc' },
    });

    const existingBlocks = await prisma.blockedTime.findMany({
      where: {
        guildId,
        startAt: { lt: searchEnd },
        endAt: { gt: searchStart },
      },
      orderBy: { startAt: 'asc' },
    });

    // 3. Overlap check with buffer
    for (const booking of existingBookings) {
      const bStartWithBuffer = new Date(booking.startAt.getTime() - bufferMins * 60 * 1000);
      const bEndWithBuffer = new Date(booking.endAt.getTime() + bufferMins * 60 * 1000);

      const isOverlap = start < bEndWithBuffer && end > bStartWithBuffer;
      if (isOverlap) {
        const dayFreeSlots = await this.getFreeSlotsForDay(guildId, start, false);
        return {
          hasConflict: true,
          conflictingItem: {
            type: 'BOOKING',
            title: `👤 ${booking.customerName} (${formatTime(booking.startAt, tz)} → ${formatTime(booking.endAt, tz)})`,
            start: booking.startAt,
            end: booking.endAt,
          },
          suggestedFreeSlots: dayFreeSlots.slice(0, 3),
          reason: `Trùng với lịch của khách ${booking.customerName} (${formatTime(
            booking.startAt,
            tz
          )} → ${formatTime(booking.endAt, tz)}).`,
        };
      }
    }

    // Blocked time check
    for (const block of existingBlocks) {
      const isOverlap = start < block.endAt && end > block.startAt;
      if (isOverlap) {
        const dayFreeSlots = await this.getFreeSlotsForDay(guildId, start, false);
        return {
          hasConflict: true,
          conflictingItem: {
            type: 'BLOCKED',
            title: `🔒 ${block.reason} (${formatTime(block.startAt, tz)} → ${formatTime(block.endAt, tz)})`,
            start: block.startAt,
            end: block.endAt,
          },
          suggestedFreeSlots: dayFreeSlots.slice(0, 3),
          reason: `Trùng với khoảng thời gian đã khóa: "${block.reason}" (${formatTime(
            block.startAt,
            tz
          )} → ${formatTime(block.endAt, tz)}).`,
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Computes all free slots on a given date based on working hours, active bookings, blocks & buffer.
   * If `onlyUpcoming` is true (default for today), it only returns slots from current time onwards.
   */
  async getFreeSlotsForDay(guildId: string, date: Date, onlyUpcoming: boolean = true): Promise<TimeSlot[]> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;
    const bufferMins = settings.minimumBufferMinutes;
    const now = nowInTimezone(tz);

    const weekdayKey = getWeekdayKey(date, tz);
    const workingHoursConfig = settingsService.parseWorkingHours(settings);
    const dayConfig = workingHoursConfig[weekdayKey];

    if (!dayConfig || !dayConfig.enabled) {
      return [];
    }

    const dayStartStr = formatDate(date, tz);
    const workStart = parseDateTimeInTimezone(dayStartStr, dayConfig.start, tz);
    const is24h =
      (dayConfig.start === '00:00' || dayConfig.start === '0:00') &&
      (dayConfig.end === '24:00' || dayConfig.end === '23:59');

    // For 24h, workEnd is start of next day (24:00)
    const workEnd = is24h
      ? addDaysTz(workStart, 1, tz)
      : parseDateTimeInTimezone(dayStartStr, dayConfig.end, tz);

    const dayStart = getStartOfDay(date, tz);
    const dayEnd = is24h ? addDaysTz(dayStart, 1, tz) : getEndOfDay(date, tz);

    // Fetch active bookings and blocked times
    const bookings = await prisma.booking.findMany({
      where: {
        guildId,
        status: { not: BOOKING_STATUS.CANCELLED },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      orderBy: { startAt: 'asc' },
    });

    const blocks = await prisma.blockedTime.findMany({
      where: {
        guildId,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      orderBy: { startAt: 'asc' },
    });

    interface Occupied {
      start: Date;
      end: Date;
    }

    const occupiedList: Occupied[] = [];

    for (const b of bookings) {
      const bStart = b.startAt < workStart ? workStart : b.startAt;
      const bEnd = new Date(Math.min(workEnd.getTime(), b.endAt.getTime() + bufferMins * 60 * 1000));
      if (bEnd > bStart) {
        occupiedList.push({ start: bStart, end: bEnd });
      }
    }

    for (const blk of blocks) {
      const blkStart = blk.startAt < workStart ? workStart : blk.startAt;
      const blkEnd = blk.endAt > workEnd ? workEnd : blk.endAt;
      if (blkEnd > blkStart) {
        occupiedList.push({ start: blkStart, end: blkEnd });
      }
    }

    // Sort and merge overlapping occupied intervals
    occupiedList.sort((a, b) => a.start.getTime() - b.start.getTime());

    const mergedOccupied: Occupied[] = [];
    for (const curr of occupiedList) {
      if (mergedOccupied.length === 0) {
        mergedOccupied.push({ ...curr });
      } else {
        const prev = mergedOccupied[mergedOccupied.length - 1];
        if (curr.start.getTime() <= prev.end.getTime()) {
          if (curr.end.getTime() > prev.end.getTime()) {
            prev.end = curr.end;
          }
        } else {
          mergedOccupied.push({ ...curr });
        }
      }
    }

    // Build raw free slots from gaps
    const rawFreeSlots: TimeSlot[] = [];
    let currentPointer = new Date(workStart);

    for (const occ of mergedOccupied) {
      if (occ.start.getTime() > currentPointer.getTime()) {
        const durationMinutes = Math.round((occ.start.getTime() - currentPointer.getTime()) / (1000 * 60));
        if (durationMinutes >= 15) {
          rawFreeSlots.push({
            start: new Date(currentPointer),
            end: new Date(occ.start),
            durationMinutes,
          });
        }
      }
      if (occ.end.getTime() > currentPointer.getTime()) {
        currentPointer = new Date(occ.end);
      }
    }

    if (currentPointer.getTime() < workEnd.getTime()) {
      const durationMinutes = Math.round((workEnd.getTime() - currentPointer.getTime()) / (1000 * 60));
      if (durationMinutes >= 15) {
        rawFreeSlots.push({
          start: new Date(currentPointer),
          end: new Date(workEnd),
          durationMinutes,
        });
      }
    }

    // If date is today and onlyUpcoming is true, filter out past slots and adjust active ongoing slot
    const isToday = formatDate(date, tz) === formatDate(now, tz);
    if (!isToday || !onlyUpcoming) {
      return rawFreeSlots;
    }

    const filteredSlots: TimeSlot[] = [];
    for (const slot of rawFreeSlots) {
      // Slot is completely in the past
      if (slot.end <= now) {
        continue;
      }
      // Slot has started in the past but ends in the future
      if (slot.start < now) {
        const remainingMinutes = Math.round((slot.end.getTime() - now.getTime()) / (1000 * 60));
        if (remainingMinutes >= 15) {
          filteredSlots.push({
            start: new Date(now),
            end: slot.end,
            durationMinutes: remainingMinutes,
          });
        }
      } else {
        filteredSlots.push(slot);
      }
    }

    return filteredSlots;
  }

  /**
   * Finds all free slots that can accommodate at least `minDurationMinutes` across `daysCount` days.
   */
  async findFreeSlots(
    guildId: string,
    startDate: Date,
    minDurationMinutes: number,
    daysCount: number = 1
  ): Promise<Array<{ date: Date; slots: TimeSlot[] }>> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;
    const results: Array<{ date: Date; slots: TimeSlot[] }> = [];

    for (let i = 0; i < daysCount; i++) {
      const targetDate = addDaysTz(startDate, i, tz);
      const freeSlots = await this.getFreeSlotsForDay(guildId, targetDate, true);
      const matchingSlots = freeSlots.filter((slot) => slot.durationMinutes >= minDurationMinutes);

      if (matchingSlots.length > 0) {
        results.push({
          date: targetDate,
          slots: matchingSlots,
        });
      }
    }

    return results;
  }

  /**
   * Builds clean client-facing string of free slots to copy and send to customers.
   */
  async formatAvailableSlotsForClient(guildId: string, date: Date): Promise<string> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;
    const freeSlots = await this.getFreeSlotsForDay(guildId, date, true);
    const dateFormatted = formatDateShort(date, tz);

    if (freeSlots.length === 0) {
      return `📅 LỊCH TRỐNG ${dateFormatted}\n\n❌ Hiện tại đã kín lịch, không còn slot trống.`;
    }

    const slotLines = freeSlots.map((s) => `🟢 ${formatTime(s.start, tz)} - ${formatTime(s.end, tz)}`).join('\n');

    return `📅 LỊCH TRỐNG ${dateFormatted}\n\n${slotLines}`;
  }
}

export const availabilityService = new AvailabilityService();

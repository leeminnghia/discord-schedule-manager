import { prisma } from '../database/prisma.js';
import { settingsService } from './settings.service.js';
import { availabilityService } from './availability.service.js';
import { BOOKING_STATUS, TIMEZONE } from '../config/constants.js';
import {
  DayScheduleSummary,
  TimelineItem,
  TimeSlot,
} from '../types/schedule.types.js';
import {
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getEndOfWeek,
  addDaysTz,
  formatDate,
  formatTime,
  getVietnameseWeekday,
  nowInTimezone,
} from '../utils/timezone.js';
import { Booking, BlockedTime } from '@prisma/client';

export class ScheduleService {
  /**
   * Builds a full day schedule summary with timeline, bookings, blocked times, and free slots.
   */
  async getDaySchedule(guildId: string, date: Date): Promise<DayScheduleSummary> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;

    const start = getStartOfDay(date, tz);
    const end = getEndOfDay(date, tz);

    const bookings = await prisma.booking.findMany({
      where: {
        guildId,
        startAt: { lt: end },
        endAt: { gt: start },
      },
      orderBy: { startAt: 'asc' },
    });

    const blocks = await prisma.blockedTime.findMany({
      where: {
        guildId,
        startAt: { lt: end },
        endAt: { gt: start },
      },
      orderBy: { startAt: 'asc' },
    });

    const freeSlots = await availabilityService.getFreeSlotsForDay(guildId, date);

    // Build timeline items
    const items: TimelineItem[] = [];

    for (const b of bookings) {
      if (b.status !== BOOKING_STATUS.CANCELLED) {
        items.push({
          type: 'BOOKING',
          start: b.startAt,
          end: b.endAt,
          durationMinutes: b.durationMinutes,
          title: b.customerName,
          status: b.status,
          bookingCode: b.bookingCode,
          customerName: b.customerName,
        });
      }
    }

    for (const blk of blocks) {
      items.push({
        type: 'BLOCKED',
        start: blk.startAt,
        end: blk.endAt,
        durationMinutes: Math.round((blk.endAt.getTime() - blk.startAt.getTime()) / (1000 * 60)),
        title: blk.reason,
        reason: blk.reason,
      });
    }

    for (const free of freeSlots) {
      items.push({
        type: 'FREE',
        start: free.start,
        end: free.end,
        durationMinutes: free.durationMinutes,
        title: 'Trống',
      });
    }

    // Sort timeline items chronologically
    items.sort((a, b) => a.start.getTime() - b.start.getTime());

    const activeBookings = bookings.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);
    const totalBookedMinutes = activeBookings.reduce((acc, b) => acc + b.durationMinutes, 0);
    const totalFreeMinutes = freeSlots.reduce((acc, s) => acc + s.durationMinutes, 0);

    const now = new Date();
    const inProgressBookings = activeBookings.filter(
      (b) => b.startAt <= now && b.endAt >= now && b.status !== BOOKING_STATUS.COMPLETED
    ).length;

    const completedBookings = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED).length;
    const cancelledBookings = bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length;
    const remainingBookings = activeBookings.filter((b) => b.startAt > now).length;

    return {
      date,
      formattedDate: formatDate(date, tz),
      weekdayName: getVietnameseWeekday(date, tz),
      items,
      totalBookings: bookings.length,
      completedBookings,
      inProgressBookings,
      remainingBookings,
      cancelledBookings,
      totalBookedMinutes,
      totalFreeMinutes,
      freeSlots,
    };
  }

  /**
   * Retrieves weekly schedule starting from the Monday of the given anchor date.
   */
  async getWeekSchedule(
    guildId: string,
    anchorDate: Date
  ): Promise<{
    weekStart: Date;
    weekEnd: Date;
    days: Array<{
      date: Date;
      formattedDate: string;
      weekdayName: string;
      totalBookings: number;
      totalBookedHours: number;
      bookings: Booking[];
    }>;
  }> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;

    const monday = getStartOfWeek(anchorDate, tz);
    const sunday = getEndOfWeek(anchorDate, tz);

    const allWeekBookings = await prisma.booking.findMany({
      where: {
        guildId,
        status: { not: BOOKING_STATUS.CANCELLED },
        startAt: { gte: monday, lte: sunday },
      },
      orderBy: { startAt: 'asc' },
    });

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = addDaysTz(monday, i, tz);
      const dayStart = getStartOfDay(dayDate, tz);
      const dayEnd = getEndOfDay(dayDate, tz);

      const dayBookings = allWeekBookings.filter(
        (b) => b.startAt >= dayStart && b.startAt <= dayEnd
      );

      const totalBookedMinutes = dayBookings.reduce((acc, b) => acc + b.durationMinutes, 0);

      days.push({
        date: dayDate,
        formattedDate: formatDate(dayDate, tz),
        weekdayName: getVietnameseWeekday(dayDate, tz),
        totalBookings: dayBookings.length,
        totalBookedHours: parseFloat((totalBookedMinutes / 60).toFixed(1)),
        bookings: dayBookings,
      });
    }

    return {
      weekStart: monday,
      weekEnd: sunday,
      days,
    };
  }

  /**
   * Retrieves the current in-progress or next upcoming booking, along with the subsequent booking.
   */
  async getNextBookingOverview(guildId: string): Promise<{
    currentOrNext: Booking | null;
    isCurrentlyActive: boolean;
    followingBooking: Booking | null;
  }> {
    const now = new Date();

    // Check active booking in progress
    const active = await prisma.booking.findFirst({
      where: {
        guildId,
        status: { notIn: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED] },
        startAt: { lte: now },
        endAt: { gt: now },
      },
      orderBy: { startAt: 'asc' },
    });

    if (active) {
      const following = await prisma.booking.findFirst({
        where: {
          guildId,
          status: { notIn: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED] },
          startAt: { gte: active.endAt },
        },
        orderBy: { startAt: 'asc' },
      });

      return {
        currentOrNext: active,
        isCurrentlyActive: true,
        followingBooking: following,
      };
    }

    // Find next upcoming
    const nextUpcoming = await prisma.booking.findFirst({
      where: {
        guildId,
        status: { notIn: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED] },
        startAt: { gt: now },
      },
      orderBy: { startAt: 'asc' },
    });

    let following: Booking | null = null;
    if (nextUpcoming) {
      following = await prisma.booking.findFirst({
        where: {
          guildId,
          status: { notIn: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED] },
          startAt: { gte: nextUpcoming.endAt },
        },
        orderBy: { startAt: 'asc' },
      });
    }

    return {
      currentOrNext: nextUpcoming,
      isCurrentlyActive: false,
      followingBooking: following,
    };
  }

  /**
   * Retrieves upcoming bookings (limit default 5)
   */
  async getUpcomingBookings(guildId: string, limit: number = 5): Promise<Booking[]> {
    const now = new Date();
    return prisma.booking.findMany({
      where: {
        guildId,
        status: { notIn: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED] },
        endAt: { gt: now },
      },
      orderBy: { startAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Computes statistics for a given timeframe
   */
  async getStats(
    guildId: string,
    timeframe: 'today' | 'week' | 'month'
  ): Promise<{
    timeframe: string;
    totalBookings: number;
    completedBookings: number;
    inProgressBookings: number;
    cancelledBookings: number;
    upcomingBookings: number;
    totalBookedMinutes: number;
    completedMinutes: number;
    busiestDay?: string;
    topCustomers: Array<{ name: string; bookingsCount: number; minutes: number }>;
  }> {
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;
    const now = new Date();

    let startDate: Date;
    let endDate: Date;

    if (timeframe === 'today') {
      startDate = getStartOfDay(now, tz);
      endDate = getEndOfDay(now, tz);
    } else if (timeframe === 'week') {
      startDate = getStartOfWeek(now, tz);
      endDate = getEndOfWeek(now, tz);
    } else {
      // Month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      startDate = getStartOfDay(startOfMonth, tz);
      endDate = getEndOfDay(endOfMonth, tz);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        guildId,
        startAt: { gte: startDate, lte: endDate },
      },
      include: { customer: true },
      orderBy: { startAt: 'asc' },
    });

    const completedBookings = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED).length;
    const cancelledBookings = bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length;
    const inProgressBookings = bookings.filter(
      (b) => b.startAt <= now && b.endAt >= now && b.status !== BOOKING_STATUS.COMPLETED
    ).length;
    const upcomingBookings = bookings.filter(
      (b) => b.startAt > now && b.status !== BOOKING_STATUS.CANCELLED
    ).length;

    const nonCancelled = bookings.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);
    const totalBookedMinutes = nonCancelled.reduce((acc, b) => acc + b.durationMinutes, 0);
    const completedMinutes = bookings
      .filter((b) => b.status === BOOKING_STATUS.COMPLETED)
      .reduce((acc, b) => acc + b.durationMinutes, 0);

    // Group by customer
    const customerMap = new Map<string, { name: string; bookingsCount: number; minutes: number }>();
    for (const b of nonCancelled) {
      const existing = customerMap.get(b.customerId) || {
        name: b.customerName,
        bookingsCount: 0,
        minutes: 0,
      };
      existing.bookingsCount += 1;
      existing.minutes += b.durationMinutes;
      customerMap.set(b.customerId, existing);
    }

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.bookingsCount - a.bookingsCount)
      .slice(0, 5);

    return {
      timeframe,
      totalBookings: bookings.length,
      completedBookings,
      inProgressBookings,
      cancelledBookings,
      upcomingBookings,
      totalBookedMinutes,
      completedMinutes,
      topCustomers,
    };
  }
}

export const scheduleService = new ScheduleService();

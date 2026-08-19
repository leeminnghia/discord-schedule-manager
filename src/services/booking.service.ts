import { prisma } from '../database/prisma.js';
import { Booking, Customer } from '@prisma/client';
import {
  CreateBookingInput,
  RescheduleBookingInput,
  ExtendBookingInput,
  ShortenBookingInput,
  CancelBookingInput,
  CompleteBookingInput,
  BookingFilter,
} from '../types/booking.types.js';
import { BOOKING_STATUS, AUDIT_ACTIONS, REMINDER_STATUS } from '../config/constants.js';
import { settingsService } from './settings.service.js';
import { availabilityService } from './availability.service.js';
import { customerService } from './customer.service.js';
import { reminderService } from './reminder.service.js';
import { parseDuration } from '../utils/duration.js';
import {
  parseDateTimeInTimezone,
  formatDate,
  formatTime,
  getStartOfDay,
  getEndOfDay,
} from '../utils/timezone.js';
import { generateBookingCode, generateBookingCodePrefix } from '../utils/formatters.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

export interface BookingWithCustomer extends Booking {
  customer: Customer;
}

export class BookingService {
  /**
   * Creates a new booking with strict conflict validation & transactional persistence.
   */
  async createBooking(input: CreateBookingInput): Promise<BookingWithCustomer> {
    const settings = await settingsService.getSettings(input.guildId);
    const tz = settings.timezone;

    const durationMinutes = parseDuration(input.durationStr);
    const startAt = parseDateTimeInTimezone(input.dateStr, input.startTimeStr, tz);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

    // Validate that start time is not in the past
    const now = new Date();
    if (!input.bypassConflictCheck && startAt.getTime() < now.getTime() - 5 * 60 * 1000) {
      throw new ValidationError(
        `❌ Thời gian bắt đầu (\`${formatTime(startAt, tz)}\` ngày \`${formatDate(startAt, tz)}\`) đã trôi qua trong quá khứ so với hiện tại (\`${formatTime(now, tz)}\` ngày \`${formatDate(now, tz)}\`).\n\n💡 *Gợi ý: Vui lòng chọn khung giờ từ hiện tại trở đi hoặc đặt lịch cho ngày mai.*`
      );
    }

    // Conflict detection
    if (!input.bypassConflictCheck && !settings.allowOverbooking) {
      const conflictCheck = await availabilityService.checkConflict(input.guildId, startAt, endAt);
      if (conflictCheck.hasConflict) {
        throw new ConflictError(conflictCheck.reason || 'Khoảng thời gian này đã có lịch hoặc không hợp lệ.', conflictCheck);
      }
    }

    // Find or create customer
    const customer = await customerService.findOrCreateCustomer({
      name: input.customerName,
      discordUserId: input.discordUserId,
      note: input.note,
    });

    // Execute in transaction for atomic code generation & consistency
    const result = await prisma.$transaction(async (tx) => {
      const prefix = generateBookingCodePrefix(startAt, tz);
      const latestBooking = await tx.booking.findFirst({
        where: {
          bookingCode: { startsWith: prefix },
        },
        orderBy: { bookingCode: 'desc' },
      });

      let nextSeq = 1;
      if (latestBooking) {
        const parts = latestBooking.bookingCode.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          nextSeq = lastNum + 1;
        }
      }

      const bookingCode = `${prefix}${nextSeq.toString().padStart(3, '0')}`;

      const booking = await tx.booking.create({
        data: {
          bookingCode,
          guildId: input.guildId,
          customerId: customer.id,
          customerName: customer.name,
          discordUserId: input.discordUserId,
          startAt,
          endAt,
          durationMinutes,
          status: input.status || BOOKING_STATUS.CONFIRMED,
          note: input.note,
          createdBy: input.createdBy,
        },
        include: {
          customer: true,
        },
      });

      // Generate reminders
      await reminderService.createRemindersForBooking(booking, tx);

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          guildId: input.guildId,
          action: AUDIT_ACTIONS.BOOKING_CREATED,
          targetId: booking.id,
          targetType: 'BOOKING',
          executorId: input.createdBy,
          executorTag: input.createdBy,
          detailsJson: JSON.stringify({
            bookingCode: booking.bookingCode,
            customerName: booking.customerName,
            startAt: booking.startAt,
            endAt: booking.endAt,
            durationMinutes: booking.durationMinutes,
          }),
        },
      });

      return booking;
    });

    // Update customer stats
    await customerService.recalculateCustomerStats(customer.id);

    return result;
  }

  /**
   * Reschedules an existing booking to a new date/time while keeping duration.
   */
  async rescheduleBooking(input: RescheduleBookingInput): Promise<BookingWithCustomer> {
    const booking = await this.getBookingByCode(input.bookingCode, input.guildId);

    if (booking.status === BOOKING_STATUS.CANCELLED || booking.status === BOOKING_STATUS.COMPLETED) {
      throw new ValidationError(`Không thể dời lịch booking đã ${booking.status === BOOKING_STATUS.CANCELLED ? 'hủy' : 'hoàn thành'}.`);
    }

    const settings = await settingsService.getSettings(input.guildId);
    const tz = settings.timezone;

    const newStartAt = parseDateTimeInTimezone(input.newDateStr, input.newStartTimeStr, tz);
    const newEndAt = new Date(newStartAt.getTime() + booking.durationMinutes * 60 * 1000);

    const now = new Date();
    if (newStartAt.getTime() < now.getTime() - 5 * 60 * 1000) {
      throw new ValidationError(
        `❌ Thời gian dời lịch (\`${formatTime(newStartAt, tz)}\` ngày \`${formatDate(newStartAt, tz)}\`) đã trôi qua trong quá khứ so với hiện tại (\`${formatTime(now, tz)}\` ngày \`${formatDate(now, tz)}\`).`
      );
    }

    // Conflict check excluding current booking
    const conflictCheck = await availabilityService.checkConflict(input.guildId, newStartAt, newEndAt, booking.id);
    if (conflictCheck.hasConflict) {
      throw new ConflictError(
        `Không thể dời lịch. ${conflictCheck.reason || 'Khoảng thời gian mới bị trùng.'}`,
        conflictCheck
      );
    }

    const oldStartStr = `${formatDate(booking.startAt, tz)} ${formatTime(booking.startAt, tz)}`;
    const oldEndStr = formatTime(booking.endAt, tz);

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          startAt: newStartAt,
          endAt: newEndAt,
        },
        include: { customer: true },
      });

      // Regenerate reminders for new time
      await reminderService.createRemindersForBooking(b, tx);

      // Audit log
      await tx.auditLog.create({
        data: {
          guildId: input.guildId,
          action: AUDIT_ACTIONS.BOOKING_RESCHEDULED,
          targetId: b.id,
          targetType: 'BOOKING',
          executorId: input.executorId,
          executorTag: input.executorTag,
          detailsJson: JSON.stringify({
            bookingCode: b.bookingCode,
            customerName: b.customerName,
            old: `${oldStartStr} → ${oldEndStr}`,
            new: `${formatDate(newStartAt, tz)} ${formatTime(newStartAt, tz)} → ${formatTime(newEndAt, tz)}`,
          }),
        },
      });

      return b;
    });

    await customerService.recalculateCustomerStats(booking.customerId);
    return updated;
  }

  /**
   * Extends the duration of an existing booking.
   */
  async extendBooking(input: ExtendBookingInput): Promise<BookingWithCustomer> {
    const booking = await this.getBookingByCode(input.bookingCode, input.guildId);

    if (booking.status === BOOKING_STATUS.CANCELLED || booking.status === BOOKING_STATUS.COMPLETED) {
      throw new ValidationError(`Không thể gia hạn booking đã ${booking.status === BOOKING_STATUS.CANCELLED ? 'hủy' : 'hoàn thành'}.`);
    }

    const extraMinutes = parseDuration(input.extraDurationStr);
    const newEndAt = new Date(booking.endAt.getTime() + extraMinutes * 60 * 1000);
    const newDurationMinutes = booking.durationMinutes + extraMinutes;

    // Check conflict for the extended portion: [booking.endAt, newEndAt]
    const conflictCheck = await availabilityService.checkConflict(
      input.guildId,
      booking.startAt,
      newEndAt,
      booking.id
    );

    if (conflictCheck.hasConflict) {
      throw new ConflictError(`Không thể gia hạn thêm ${input.extraDurationStr}. ${conflictCheck.reason}`, conflictCheck);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endAt: newEndAt,
          durationMinutes: newDurationMinutes,
        },
        include: { customer: true },
      });

      await tx.auditLog.create({
        data: {
          guildId: input.guildId,
          action: AUDIT_ACTIONS.BOOKING_EXTENDED,
          targetId: b.id,
          targetType: 'BOOKING',
          executorId: input.executorId,
          executorTag: input.executorTag,
          detailsJson: JSON.stringify({
            bookingCode: b.bookingCode,
            extraMinutes,
            newDurationMinutes,
            newEndAt,
          }),
        },
      });

      return b;
    });

    await customerService.recalculateCustomerStats(booking.customerId);
    return updated;
  }

  /**
   * Shortens the duration of an existing booking.
   */
  async shortenBooking(input: ShortenBookingInput): Promise<BookingWithCustomer> {
    const booking = await this.getBookingByCode(input.bookingCode, input.guildId);
    const settings = await settingsService.getSettings(input.guildId);
    const tz = settings.timezone;

    if (booking.status === BOOKING_STATUS.CANCELLED || booking.status === BOOKING_STATUS.COMPLETED) {
      throw new ValidationError(`Không thể rút ngắn booking đã ${booking.status === BOOKING_STATUS.CANCELLED ? 'hủy' : 'hoàn thành'}.`);
    }

    let newEndAt: Date;
    let newDurationMinutes: number;

    if (input.newEndTimeStr) {
      const dateStr = formatDate(booking.startAt, tz);
      newEndAt = parseDateTimeInTimezone(dateStr, input.newEndTimeStr, tz);
      newDurationMinutes = Math.round((newEndAt.getTime() - booking.startAt.getTime()) / (1000 * 60));
    } else if (input.shortenByMinutes) {
      newDurationMinutes = booking.durationMinutes - input.shortenByMinutes;
      newEndAt = new Date(booking.startAt.getTime() + newDurationMinutes * 60 * 1000);
    } else {
      throw new ValidationError('Vui lòng nhập giờ kết thúc mới hoặc số phút muốn rút ngắn.');
    }

    if (newDurationMinutes <= 0 || newEndAt <= booking.startAt) {
      throw new ValidationError('Thời gian kết thúc mới phải sau thời gian bắt đầu.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endAt: newEndAt,
          durationMinutes: newDurationMinutes,
        },
        include: { customer: true },
      });

      await tx.auditLog.create({
        data: {
          guildId: input.guildId,
          action: AUDIT_ACTIONS.BOOKING_SHORTENED,
          targetId: b.id,
          targetType: 'BOOKING',
          executorId: input.executorId,
          executorTag: input.executorTag,
          detailsJson: JSON.stringify({
            bookingCode: b.bookingCode,
            newDurationMinutes,
            newEndAt,
          }),
        },
      });

      return b;
    });

    await customerService.recalculateCustomerStats(booking.customerId);
    return updated;
  }

  /**
   * Cancels a booking (soft cancel with cancellationReason and cancelledAt).
   */
  async cancelBooking(input: CancelBookingInput): Promise<BookingWithCustomer> {
    const booking = await this.getBookingByCode(input.bookingCode, input.guildId);

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new ValidationError(`Booking ${booking.bookingCode} đã ở trạng thái hủy trước đó.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BOOKING_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: input.reason || 'Không có lý do',
        },
        include: { customer: true },
      });

      // Cancel pending reminders
      await tx.reminder.updateMany({
        where: {
          bookingId: b.id,
          status: REMINDER_STATUS.PENDING,
        },
        data: {
          status: REMINDER_STATUS.CANCELLED,
        },
      });

      await tx.auditLog.create({
        data: {
          guildId: input.guildId,
          action: AUDIT_ACTIONS.BOOKING_CANCELLED,
          targetId: b.id,
          targetType: 'BOOKING',
          executorId: input.executorId,
          executorTag: input.executorTag,
          detailsJson: JSON.stringify({
            bookingCode: b.bookingCode,
            reason: input.reason,
          }),
        },
      });

      return b;
    });

    await customerService.recalculateCustomerStats(booking.customerId);
    return updated;
  }

  /**
   * Marks a booking as COMPLETED.
   */
  async completeBooking(input: CompleteBookingInput): Promise<BookingWithCustomer> {
    const booking = await this.getBookingByCode(input.bookingCode, input.guildId);

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BOOKING_STATUS.COMPLETED,
          completedAt: new Date(),
        },
        include: { customer: true },
      });

      await tx.auditLog.create({
        data: {
          guildId: input.guildId,
          action: AUDIT_ACTIONS.BOOKING_COMPLETED,
          targetId: b.id,
          targetType: 'BOOKING',
          executorId: input.executorId,
          executorTag: input.executorTag,
          detailsJson: JSON.stringify({
            bookingCode: b.bookingCode,
          }),
        },
      });

      return b;
    });

    await customerService.recalculateCustomerStats(booking.customerId);
    return updated;
  }

  /**
   * Retrieves booking by code with customer relation.
   */
  async getBookingByCode(bookingCode: string, guildId?: string): Promise<BookingWithCustomer> {
    const booking = await prisma.booking.findFirst({
      where: {
        bookingCode: bookingCode.trim().toUpperCase(),
        guildId: guildId ? guildId : undefined,
      },
      include: {
        customer: true,
      },
    });

    if (!booking) {
      throw new NotFoundError(`Không tìm thấy lịch đặt với mã: ${bookingCode}`);
    }

    return booking;
  }

  /**
   * Searches bookings with flexible filter criteria and pagination
   */
  async searchBookings(
    filter: BookingFilter,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ bookings: BookingWithCustomer[]; totalCount: number; totalPages: number }> {
    const where: any = {
      guildId: filter.guildId,
    };

    if (filter.customerId) {
      where.customerId = filter.customerId;
    }

    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.startAt = {};
      if (filter.startDate) where.startAt.gte = filter.startDate;
      if (filter.endDate) where.startAt.lte = filter.endDate;
    }

    if (filter.searchQuery) {
      const q = filter.searchQuery.trim();
      where.OR = [
        { bookingCode: { contains: q } },
        { customerName: { contains: q } },
        { note: { contains: q } },
      ];
    }

    const totalCount = await prisma.booking.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const skip = (page - 1) * pageSize;

    const bookings = await prisma.booking.findMany({
      where,
      include: { customer: true },
      orderBy: { startAt: 'desc' },
      skip,
      take: pageSize,
    });

    return { bookings, totalCount, totalPages };
  }
}

export const bookingService = new BookingService();

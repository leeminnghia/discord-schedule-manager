import { BookingStatus } from '../config/constants.js';

export interface CreateBookingInput {
  guildId: string;
  customerName: string;
  discordUserId?: string;
  dateStr: string; // DD/MM/YYYY or YYYY-MM-DD
  startTimeStr: string; // HH:mm
  durationStr: string; // e.g. "3h", "90m", "1.5h"
  note?: string;
  status?: BookingStatus;
  createdBy: string;
  bypassConflictCheck?: boolean;
}

export interface RescheduleBookingInput {
  guildId: string;
  bookingCode: string;
  newDateStr: string;
  newStartTimeStr: string;
  executorId: string;
  executorTag: string;
}

export interface ExtendBookingInput {
  guildId: string;
  bookingCode: string;
  extraDurationStr: string;
  executorId: string;
  executorTag: string;
}

export interface ShortenBookingInput {
  guildId: string;
  bookingCode: string;
  shortenByMinutes?: number;
  newEndTimeStr?: string;
  executorId: string;
  executorTag: string;
}

export interface CancelBookingInput {
  guildId: string;
  bookingCode: string;
  reason?: string;
  executorId: string;
  executorTag: string;
}

export interface CompleteBookingInput {
  guildId: string;
  bookingCode: string;
  executorId: string;
  executorTag: string;
}

export interface BookingFilter {
  guildId: string;
  customerId?: string;
  status?: BookingStatus | BookingStatus[];
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

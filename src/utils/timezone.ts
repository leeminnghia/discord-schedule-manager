import { startOfDay, endOfDay, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { TIMEZONE } from '../config/constants.js';
import { ValidationError } from './errors.js';

export const VIETNAMESE_WEEKDAYS: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
};

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Gets current Date object (standard UTC timestamp).
 */
export function nowInTimezone(tz: string = TIMEZONE): Date {
  return new Date();
}

/**
 * Normalizes user input time string into strict HH:mm.
 * Supports: "14:00", "14h", "14h30", "14h00", "14", "9h30", "9", "24:00"
 */
export function normalizeTimeString(input: string): string {
  let clean = input.trim().toLowerCase();

  if (clean === '24:00' || clean === '24h') {
    return '23:59';
  }

  // Case "14h" or "14h00" or "14h30" or "14h30p"
  const hMatch = clean.match(/^(\d{1,2})\s*(?:h|g|giờ|tiếng)\s*(\d{1,2})?\s*(?:m|p|phút)?$/);
  if (hMatch) {
    const hours = parseInt(hMatch[1], 10);
    const minutes = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Case "14:30" or "9:00"
  const colonMatch = clean.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Case pure number: e.g. "14" -> "14:00", "9" -> "09:00"
  const numMatch = clean.match(/^(\d{1,2})$/);
  if (numMatch) {
    const hours = parseInt(numMatch[1], 10);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:00`;
    }
  }

  return clean;
}

/**
 * Parses user input date string (DD/MM/YYYY or YYYY-MM-DD or relative "hôm nay", "ngày mai")
 * and time string (HH:mm, 14h, 14h30, 14) and returns the UTC Date.
 */
export function parseDateTimeInTimezone(dateStr: string, timeStr: string, tz: string = TIMEZONE): Date {
  let cleanDate = dateStr.trim().toLowerCase();
  const normalizedTime = normalizeTimeString(timeStr);

  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(normalizedTime)) {
    throw new ValidationError(
      `Giờ "${timeStr}" không hợp lệ. Bạn có thể nhập: 14:00, 14h, 14h30, 9h hoặc chọn từ danh sách gợi ý.`
    );
  }

  const [hoursStr, minutesStr] = normalizedTime.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  const nowZoned = toZonedTime(new Date(), tz);
  let year = nowZoned.getFullYear();
  let month = nowZoned.getMonth() + 1; // 1-12
  let day = nowZoned.getDate();

  // Support relative keywords
  if (cleanDate === 'today' || cleanDate === 'hôm nay' || cleanDate === 'hom nay') {
    // defaults to today
  } else if (cleanDate === 'tomorrow' || cleanDate === 'ngày mai' || cleanDate === 'ngay mai') {
    const tom = addDays(nowZoned, 1);
    year = tom.getFullYear();
    month = tom.getMonth() + 1;
    day = tom.getDate();
  } else {
    // Check DD/MM/YYYY or D/M/YYYY
    const dmyMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
      if (dmyMatch[3]) {
        year = parseInt(dmyMatch[3], 10);
      }
    } else {
      // Check YYYY-MM-DD
      const ymdMatch = cleanDate.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10);
        day = parseInt(ymdMatch[3], 10);
      } else {
        throw new ValidationError(`Ngày "${dateStr}" không hợp lệ. Định dạng: DD/MM/YYYY (ví dụ: 19/08/2026).`);
      }
    }
  }

  // Validate bounds
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ValidationError(`Ngày "${dateStr}" không hợp lệ.`);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const secondsStr = normalizedTime === '23:59' && (timeStr === '24:00' || timeStr === '24h') ? '59' : '00';
  const isoLocalString = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${secondsStr}`;

  return fromZonedTime(isoLocalString, tz);
}

/**
 * Parses date string into start of day in target timezone.
 */
export function parseDateStartOfDay(dateStr: string, tz: string = TIMEZONE): Date {
  return parseDateTimeInTimezone(dateStr, '00:00', tz);
}

export function formatFullDateTime(date: Date, tz: string = TIMEZONE): string {
  return formatTz(date, 'dd/MM/yyyy HH:mm', { timeZone: tz });
}

export function formatTime(date: Date, tz: string = TIMEZONE): string {
  return formatTz(date, 'HH:mm', { timeZone: tz });
}

export function formatDate(date: Date, tz: string = TIMEZONE): string {
  return formatTz(date, 'dd/MM/yyyy', { timeZone: tz });
}

export function formatDateShort(date: Date, tz: string = TIMEZONE): string {
  return formatTz(date, 'dd/MM', { timeZone: tz });
}

export function getVietnameseWeekday(date: Date, tz: string = TIMEZONE): string {
  const zoned = toZonedTime(date, tz);
  const day = zoned.getDay();
  return VIETNAMESE_WEEKDAYS[day];
}

export function getWeekdayKey(date: Date, tz: string = TIMEZONE): 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' {
  const zoned = toZonedTime(date, tz);
  return WEEKDAY_KEYS[zoned.getDay()];
}

export function getStartOfDay(date: Date, tz: string = TIMEZONE): Date {
  const zoned = toZonedTime(date, tz);
  const start = startOfDay(zoned);
  return fromZonedTime(start, tz);
}

export function getEndOfDay(date: Date, tz: string = TIMEZONE): Date {
  const zoned = toZonedTime(date, tz);
  const end = endOfDay(zoned);
  return fromZonedTime(end, tz);
}

export function getStartOfWeek(date: Date, tz: string = TIMEZONE): Date {
  const zoned = toZonedTime(date, tz);
  const start = startOfWeek(zoned, { weekStartsOn: 1 });
  return fromZonedTime(start, tz);
}

export function getEndOfWeek(date: Date, tz: string = TIMEZONE): Date {
  const zoned = toZonedTime(date, tz);
  const end = endOfWeek(zoned, { weekStartsOn: 1 });
  return fromZonedTime(end, tz);
}

export function addDaysTz(date: Date, days: number, tz: string = TIMEZONE): Date {
  const zoned = toZonedTime(date, tz);
  const added = addDays(zoned, days);
  return fromZonedTime(added, tz);
}

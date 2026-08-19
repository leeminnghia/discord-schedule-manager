import { formatTime, formatDate, formatFullDateTime } from './timezone.js';
import { TIMEZONE } from '../config/constants.js';

/**
 * Generates the prefix for a standard Booking Code, e.g. BK-20260819-
 */
export function generateBookingCodePrefix(date: Date, tz: string = TIMEZONE): string {
  const parts = formatDate(date, tz).split('/'); // [DD, MM, YYYY]
  const yyyymmdd = `${parts[2]}${parts[1]}${parts[0]}`;
  return `BK-${yyyymmdd}-`;
}

/**
 * Generates a standard Booking Code, e.g. BK-20260819-001
 */
export function generateBookingCode(date: Date, sequenceNumber: number, tz: string = TIMEZONE): string {
  const prefix = generateBookingCodePrefix(date, tz);
  const seq = sequenceNumber.toString().padStart(3, '0');
  return `${prefix}${seq}`;
}

/**
 * Computes human-friendly remaining time text: e.g. "58 phút", "1 giờ 24 phút", "2 ngày"
 */
export function formatRemainingTime(targetDate: Date, fromDate: Date = new Date()): string {
  const diffMs = targetDate.getTime() - fromDate.getTime();
  if (diffMs <= 0) {
    return '0 phút';
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) {
    return `${diffMins} phút`;
  }

  const diffHours = Math.floor(diffMins / 60);
  const remMins = diffMins % 60;
  if (diffHours < 24) {
    if (remMins === 0) return `${diffHours} giờ`;
    return `${diffHours} giờ ${remMins} phút`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  if (remHours === 0) return `${diffDays} ngày`;
  return `${diffDays} ngày ${remHours} giờ`;
}

/**
 * Formats a time range string: "14:00 → 17:00"
 */
export function formatTimeRange(start: Date, end: Date, tz: string = TIMEZONE): string {
  return `${formatTime(start, tz)} → ${formatTime(end, tz)}`;
}

/**
 * Truncates string with ellipsis if exceeds max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

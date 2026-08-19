import { describe, it, expect } from 'vitest';
import {
  parseDateTimeInTimezone,
  formatDate,
  formatTime,
  formatFullDateTime,
  getVietnameseWeekday,
  getWeekdayKey,
  addDaysTz,
} from '../src/utils/timezone.js';
import { ValidationError } from '../src/utils/errors.js';

describe('Timezone & Date Utility Tests (Asia/Ho_Chi_Minh GMT+7)', () => {
  it('should parse DD/MM/YYYY and HH:mm correctly into GMT+7', () => {
    const date = parseDateTimeInTimezone('19/08/2026', '14:30');
    expect(formatDate(date)).toBe('19/08/2026');
    expect(formatTime(date)).toBe('14:30');
    expect(formatFullDateTime(date)).toBe('19/08/2026 14:30');
  });

  it('should parse YYYY-MM-DD format as well', () => {
    const date = parseDateTimeInTimezone('2026-08-19', '09:00');
    expect(formatDate(date)).toBe('19/08/2026');
    expect(formatTime(date)).toBe('09:00');
  });

  it('should correctly identify Vietnamese weekdays', () => {
    // 19/08/2026 is Wednesday (Thứ Tư)
    const wednesday = parseDateTimeInTimezone('19/08/2026', '10:00');
    expect(getVietnameseWeekday(wednesday)).toBe('Thứ Tư');
    expect(getWeekdayKey(wednesday)).toBe('wed');

    // 23/08/2026 is Sunday (Chủ Nhật)
    const sunday = parseDateTimeInTimezone('23/08/2026', '10:00');
    expect(getVietnameseWeekday(sunday)).toBe('Chủ Nhật');
    expect(getWeekdayKey(sunday)).toBe('sun');
  });

  it('should add days properly without timezone drift', () => {
    const start = parseDateTimeInTimezone('19/08/2026', '14:00');
    const nextDay = addDaysTz(start, 1);
    expect(formatDate(nextDay)).toBe('20/08/2026');
    expect(formatTime(nextDay)).toBe('14:00');
  });

  it('should reject invalid dates or times', () => {
    expect(() => parseDateTimeInTimezone('32/08/2026', '14:00')).toThrow(ValidationError);
    expect(() => parseDateTimeInTimezone('19/13/2026', '14:00')).toThrow(ValidationError);
    expect(() => parseDateTimeInTimezone('19/08/2026', '25:00')).toThrow(ValidationError);
    expect(() => parseDateTimeInTimezone('invalid', '14:00')).toThrow(ValidationError);
  });
});

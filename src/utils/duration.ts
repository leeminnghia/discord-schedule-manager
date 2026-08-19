import { ValidationError } from './errors.js';

/**
 * Parses a duration string (e.g. "30m", "1h", "1h30m", "2.5h", "180m", "2", "3 tiếng") into integer minutes.
 * Intelligently treats raw numbers <= 12 as hours (e.g. 2 -> 2 hours = 120m) and >= 15 as minutes (e.g. 30 -> 30m).
 */
export function parseDuration(input: string | number): number {
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) {
      throw new ValidationError('Thời lượng phải là số dương lớn hơn 0.');
    }
    if (input <= 12) {
      return Math.round(input * 60);
    }
    return Math.round(input);
  }

  const clean = input.trim().toLowerCase();
  if (!clean) {
    throw new ValidationError('Vui lòng nhập thời lượng hợp lệ (ví dụ: 1h, 30m, 2h, 2.5h).');
  }

  // Pure number case
  if (/^\d+$/.test(clean)) {
    const n = parseInt(clean, 10);
    if (n <= 0) throw new ValidationError('Thời lượng phải lớn hơn 0.');
    if (n <= 12) {
      // 1 to 12 without unit is treated as hours (e.g., "2" -> 2 hours)
      return n * 60;
    }
    // >= 15 is treated as minutes (e.g., "30" -> 30 mins, "60" -> 60 mins)
    return n;
  }

  // Decimal numbers without unit (e.g. "1.5" or "2.5")
  if (/^\d+\.\d+$/.test(clean)) {
    const hours = parseFloat(clean);
    if (hours > 0 && hours <= 24) {
      return Math.round(hours * 60);
    }
  }

  let totalMinutes = 0;
  let matched = false;

  // Decimal hours: "2.5h" or "1.5 giờ" or "2.5 tiếng"
  const decimalHoursMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|g|gio|giờ|tieng|tiếng)$/);
  if (decimalHoursMatch) {
    const hours = parseFloat(decimalHoursMatch[1]);
    if (hours <= 0) throw new ValidationError('Thời lượng phải lớn hơn 0.');
    return Math.round(hours * 60);
  }

  // Combined format: "1h30m", "1h 30m", "1h30", "1h30p", "1g30", "1 tiếng 30 phút"
  const combinedMatch = clean.match(/^(\d+)\s*(?:h|hr|hrs|g|gio|giờ|tieng|tiếng)\s*(\d+)?\s*(?:m|min|mins|p|phut|phút)?$/);
  if (combinedMatch) {
    const hours = parseInt(combinedMatch[1], 10);
    const mins = combinedMatch[2] ? parseInt(combinedMatch[2], 10) : 0;
    totalMinutes = hours * 60 + mins;
    matched = true;
  }

  // Minutes only: "45m", "90 mins", "45 phút", "45p"
  if (!matched) {
    const minutesMatch = clean.match(/^(\d+)\s*(?:m|min|mins|p|phut|phút)$/);
    if (minutesMatch) {
      totalMinutes = parseInt(minutesMatch[1], 10);
      matched = true;
    }
  }

  if (!matched || totalMinutes <= 0) {
    throw new ValidationError(
      `Định dạng thời lượng "${input}" không hợp lệ. Vui lòng dùng: 30m, 1h, 1h30m, 2h, 2.5h hoặc chọn từ danh sách gợi ý.`
    );
  }

  return totalMinutes;
}

/**
 * Formats duration in minutes into Vietnamese friendly text: e.g. "3 giờ", "1 giờ 30 phút", "45 phút"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} giờ`;
  }
  return `${hours} giờ ${remainingMins} phút`;
}

/**
 * Formats duration in minutes into short text: e.g. "3H", "1H30M", "45M"
 */
export function formatDurationShort(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}M`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours}H`;
  }
  return `${hours}H${remainingMins}M`;
}

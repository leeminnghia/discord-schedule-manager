import { formatDate, getVietnameseWeekday, addDaysTz, nowInTimezone } from './timezone.js';
import { TIMEZONE } from '../config/constants.js';

export interface AutocompleteChoice {
  name: string;
  value: string;
}

/**
 * Returns intelligent date choices for autocomplete (Hôm nay, Ngày mai, Thứ X...).
 */
export function getDateChoices(focusedValue: string, tz: string = TIMEZONE): AutocompleteChoice[] {
  const clean = focusedValue.trim().toLowerCase();
  const now = new Date();
  const choices: AutocompleteChoice[] = [];

  // Today
  const todayFormatted = formatDate(now, tz);
  choices.push({
    name: `Hôm nay (${todayFormatted})`,
    value: todayFormatted,
  });

  // Tomorrow
  const tomorrow = addDaysTz(now, 1, tz);
  const tomorrowFormatted = formatDate(tomorrow, tz);
  choices.push({
    name: `Ngày mai (${tomorrowFormatted})`,
    value: tomorrowFormatted,
  });

  // Next 7 days
  for (let i = 2; i <= 8; i++) {
    const day = addDaysTz(now, i, tz);
    const dayFormatted = formatDate(day, tz);
    const weekday = getVietnameseWeekday(day, tz);
    choices.push({
      name: `${weekday} (${dayFormatted})`,
      value: dayFormatted,
    });
  }

  if (!clean) {
    return choices.slice(0, 25);
  }

  return choices
    .filter((c) => c.name.toLowerCase().includes(clean) || c.value.toLowerCase().includes(clean))
    .slice(0, 25);
}

/**
 * Returns time choices for autocomplete (08:00, 08:30, 09:00, 14:00, 15:30...).
 */
export function getTimeChoices(focusedValue: string): AutocompleteChoice[] {
  const clean = focusedValue.trim().toLowerCase().replace(/h/g, ':');
  const allTimes: AutocompleteChoice[] = [];

  for (let h = 8; h <= 23; h++) {
    const hh = h.toString().padStart(2, '0');
    allTimes.push({ name: `${hh}:00`, value: `${hh}:00` });
    allTimes.push({ name: `${hh}:30`, value: `${hh}:30` });
  }

  // Also include 00:00 to 07:30
  for (let h = 0; h < 8; h++) {
    const hh = h.toString().padStart(2, '0');
    allTimes.push({ name: `${hh}:00`, value: `${hh}:00` });
    allTimes.push({ name: `${hh}:30`, value: `${hh}:30` });
  }

  if (!clean) {
    // Show prime daytime hours first
    return allTimes.slice(0, 25);
  }

  // Filter based on user typing (e.g. typing "15" -> "15:00", "15:30")
  const filtered = allTimes.filter((t) => t.value.startsWith(clean) || t.value.includes(clean));
  if (filtered.length > 0) {
    return filtered.slice(0, 25);
  }

  // If user typed custom time like "15:15"
  return [{ name: focusedValue, value: focusedValue }];
}

/**
 * Returns duration choices for autocomplete (30m, 1h, 1h30m, 2h, 3h...).
 */
export function getDurationChoices(focusedValue: string): AutocompleteChoice[] {
  const clean = focusedValue.trim().toLowerCase();

  const standardDurations: AutocompleteChoice[] = [
    { name: '30 phút (30m)', value: '30m' },
    { name: '45 phút (45m)', value: '45m' },
    { name: '1 giờ (1h)', value: '1h' },
    { name: '1 giờ 15 phút (1h15m)', value: '1h15m' },
    { name: '1 giờ 30 phút (1h30m)', value: '1h30m' },
    { name: '2 giờ (2h)', value: '2h' },
    { name: '2 giờ 30 phút (2h30m)', value: '2h30m' },
    { name: '3 giờ (3h)', value: '3h' },
    { name: '3 giờ 30 phút (3h30m)', value: '3h30m' },
    { name: '4 giờ (4h)', value: '4h' },
    { name: '5 giờ (5h)', value: '5h' },
    { name: '6 giờ (6h)', value: '6h' },
    { name: '8 giờ (8h)', value: '8h' },
    { name: '10 giờ (10h)', value: '10h' },
    { name: '12 giờ (12h)', value: '12h' },
  ];

  if (!clean) {
    return standardDurations;
  }

  const filtered = standardDurations.filter(
    (d) => d.name.toLowerCase().includes(clean) || d.value.toLowerCase().includes(clean)
  );

  if (filtered.length > 0) {
    return filtered.slice(0, 25);
  }

  // If user types a number like "2", provide "2 giờ (2h)"
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num > 0) {
    return [
      { name: `${num} giờ (${num}h)`, value: `${num}h` },
      { name: `${num} phút (${num}m)`, value: `${num}m` },
    ];
  }

  return [{ name: focusedValue, value: focusedValue }];
}

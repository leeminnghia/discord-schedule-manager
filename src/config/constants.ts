export const TIMEZONE = 'Asia/Ho_Chi_Minh';

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PAID: 'PAID',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type BookingStatus = keyof typeof BOOKING_STATUS;

export const BOOKING_STATUS_DISPLAY: Record<BookingStatus, { emoji: string; label: string; full: string }> = {
  PENDING: { emoji: '🟡', label: 'Chờ xác nhận', full: '🟡 Chờ xác nhận' },
  CONFIRMED: { emoji: '🟢', label: 'Đã xác nhận', full: '🟢 Đã xác nhận' },
  PAID: { emoji: '💰', label: 'Đã thanh toán', full: '💰 Đã thanh toán' },
  IN_PROGRESS: { emoji: '▶️', label: 'Đang thực hiện', full: '▶️ Đang thực hiện' },
  COMPLETED: { emoji: '✅', label: 'Hoàn thành', full: '✅ Hoàn thành' },
  CANCELLED: { emoji: '❌', label: 'Đã hủy', full: '❌ Đã hủy' },
  NO_SHOW: { emoji: '⚠️', label: 'Không xuất hiện', full: '⚠️ Không xuất hiện' },
};

export const REMINDER_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
  MISSED: 'MISSED',
} as const;

export type ReminderStatus = keyof typeof REMINDER_STATUS;

export const AUDIT_ACTIONS = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_UPDATED: 'BOOKING_UPDATED',
  BOOKING_RESCHEDULED: 'BOOKING_RESCHEDULED',
  BOOKING_EXTENDED: 'BOOKING_EXTENDED',
  BOOKING_SHORTENED: 'BOOKING_SHORTENED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_COMPLETED: 'BOOKING_COMPLETED',
  TIME_BLOCK_CREATED: 'TIME_BLOCK_CREATED',
  TIME_BLOCK_REMOVED: 'TIME_BLOCK_REMOVED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  SYSTEM_SETUP: 'SYSTEM_SETUP',
} as const;

export const CHANNELS = {
  OVERVIEW: '📊・tong-quan',
  TODAY: '📅・lich-hom-nay',
  WEEK: '🗓️・lich-tuan',
  FREE_SLOTS: '🟢・gio-con-trong',
  REMINDERS: '🔔・nhac-lich',
  CUSTOMERS: '👤・khach-hang',
  COMPLETED: '✅・lich-hoan-thanh',
  CANCELLED: '❌・lich-da-huy',
  NOTES: '📝・ghi-chu',
  COMMAND: '🤖・bot-command',
  LOG: '📋・bot-log',
  SETTINGS: '⚙️・settings',
} as const;

export const CATEGORIES = {
  DASHBOARD: '📌 DASHBOARD',
  MANAGEMENT: '📂 QUẢN LÝ',
  SYSTEM: '⚙️ SYSTEM',
} as const;

export const EMBED_COLORS = {
  PRIMARY: 0x5865F2, // Blurple
  SUCCESS: 0x57F287, // Green
  WARNING: 0xFEE75C, // Yellow
  DANGER: 0xED4245,  // Red
  DARK: 0x2B2D31,    // Discord Dark
  INFO: 0x3498DB,    // Blue
} as const;

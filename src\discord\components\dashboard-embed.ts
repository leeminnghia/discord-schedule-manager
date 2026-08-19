import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { scheduleService } from '../../services/schedule.service.js';
import { availabilityService } from '../../services/availability.service.js';
import { settingsService } from '../../services/settings.service.js';
import { EMBED_COLORS, TIMEZONE, BOOKING_STATUS_DISPLAY } from '../../config/constants.js';
import { WeekWorkingHours } from '../../types/schedule.types.js';
import {
  formatDate,
  formatTime,
  formatFullDateTime,
  getVietnameseWeekday,
  formatDateShort,
  addDaysTz,
} from '../../utils/timezone.js';
import { formatDuration, formatDurationShort } from '../../utils/duration.js';
import { formatRemainingTime, formatTimeRange } from '../../utils/formatters.js';

export async function buildOverviewEmbed(guildId: string): Promise<EmbedBuilder> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;
  const now = new Date();

  const daySchedule = await scheduleService.getDaySchedule(guildId, now);
  const nextOverview = await scheduleService.getNextBookingOverview(guildId);
  const freeSlots = await availabilityService.getFreeSlotsForDay(guildId, now);

  const embed = new EmbedBuilder()
    .setTitle('╔════════════════════════════╗\n        📅 WORK DASHBOARD\n╚════════════════════════════╝')
    .setColor(EMBED_COLORS.PRIMARY)
    .setDescription(`🕐 **Hiện tại:** ${formatTime(now, tz)} — ${formatDate(now, tz)}`)
    .setFooter({ text: 'Tự động cập nhật mỗi 1 phút • Quản trị cá nhân' })
    .setTimestamp();

  // Next / Active Booking
  if (nextOverview.currentOrNext) {
    const booking = nextOverview.currentOrNext;
    const timeRange = formatTimeRange(booking.startAt, booking.endAt, tz);
    const durationText = formatDuration(booking.durationMinutes);

    if (nextOverview.isCurrentlyActive) {
      const remainingTime = formatRemainingTime(booking.endAt, now);
      embed.addFields({
        name: '▶️ ĐANG THỰC HIỆN',
        value: `**Khách:** ${booking.customerName}\n**Khung giờ:** ${timeRange}\n**Thời lượng:** ${durationText}\n**Còn lại:** ${remainingTime}`,
        inline: false,
      });
    } else {
      const startsIn = formatRemainingTime(booking.startAt, now);
      embed.addFields({
        name: '🔴 LỊCH TIẾP THEO',
        value: `**Khách:** ${booking.customerName}\n**Khung giờ:** ${timeRange}\n**Thời lượng:** ${durationText}\n**Bắt đầu sau:** ${startsIn}`,
        inline: false,
      });
    }
  } else {
    embed.addFields({
      name: '🟢 LỊCH TIẾP THEO',
      value: 'Hiện không có lịch sắp tới.',
      inline: false,
    });
  }

  // Today Summary
  const totalBookedHours = (daySchedule.totalBookedMinutes / 60).toFixed(1).replace('.0', '');
  embed.addFields({
    name: '━━━━━━━━━━━━━━━━━━\n📊 HÔM NAY',
    value:
      `• Tổng lịch: **${daySchedule.totalBookings}**\n` +
      `• Đã hoàn thành: **${daySchedule.completedBookings}**\n` +
      `• Đang thực hiện: **${daySchedule.inProgressBookings}**\n` +
      `• Còn lại: **${daySchedule.remainingBookings}**\n` +
      `• Đã hủy: **${daySchedule.cancelledBookings}**\n` +
      `• Tổng giờ đã đặt: **${totalBookedHours}H**`,
    inline: false,
  });

  // Free Slots
  let freeText = '❌ Đã kín lịch';
  if (freeSlots.length > 0) {
    freeText = freeSlots.map((s) => `• ${formatTimeRange(s.start, s.end, tz)} (${formatDuration(s.durationMinutes)})`).join('\n');
  }
  embed.addFields({
    name: '━━━━━━━━━━━━━━━━━━\n🟢 THỜI GIAN CÒN TRỐNG',
    value: freeText,
    inline: false,
  });

  // Following Booking
  if (nextOverview.followingBooking) {
    const fol = nextOverview.followingBooking;
    embed.addFields({
      name: `━━━━━━━━━━━━━━━━━━\n➡️ LỊCH TIẾP THEO SAU ${nextOverview.currentOrNext?.customerName || ''}`,
      value: `**Khách:** ${fol.customerName}\n**Khung giờ:** ${formatTimeRange(fol.startAt, fol.endAt, tz)} (${formatDate(fol.startAt, tz)})`,
      inline: false,
    });
  }

  return embed;
}

export async function buildTodayScheduleEmbed(guildId: string, date: Date = new Date()): Promise<EmbedBuilder> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;

  const daySchedule = await scheduleService.getDaySchedule(guildId, date);
  const title = `📅 ${daySchedule.weekdayName.toUpperCase()} — ${daySchedule.formattedDate}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(EMBED_COLORS.PRIMARY)
    .setFooter({ text: `Cập nhật: ${formatFullDateTime(new Date(), tz)}` });

  if (daySchedule.items.length === 0) {
    embed.setDescription(
      `Hiện chưa có lịch nào cho ngày này.\n\n🟢 Toàn bộ 24 giờ đang trống sẵn sàng nhận khách!`
    );
    return embed;
  }

  // Format Timeline
  const timelineLines = daySchedule.items.map((item) => {
    const range = `${formatTime(item.start, tz)} ─ ${formatTime(item.end, tz)}`;
    if (item.type === 'FREE') {
      return `\`${range}\`  🟢 **Trống** (${formatDurationShort(item.durationMinutes)})`;
    } else if (item.type === 'BLOCKED') {
      return `\`${range}\`  🔒 **${item.title}**`;
    } else {
      const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[item.status || 'CONFIRMED']?.emoji || '🔴';
      return `\`${range}\`  ${statusEmoji} **${item.title}** (${item.bookingCode})`;
    }
  });

  const totalBookedHours = (daySchedule.totalBookedMinutes / 60).toFixed(1).replace('.0', '');
  const totalFreeHours = (daySchedule.totalFreeMinutes / 60).toFixed(1).replace('.0', '');

  embed.setDescription(
    `${timelineLines.join('\n')}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📊 **Tổng kết:** ${daySchedule.totalBookings} lịch • Đã đặt: **${totalBookedHours}H** • Còn trống: **${totalFreeHours}H**`
  );

  return embed;
}

export async function buildTomorrowScheduleEmbed(guildId: string): Promise<EmbedBuilder> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;
  const tomorrow = addDaysTz(new Date(), 1, tz);
  return buildTodayScheduleEmbed(guildId, tomorrow);
}

export async function buildWeekScheduleEmbed(guildId: string, anchorDate: Date = new Date()): Promise<EmbedBuilder> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;

  const weekData = await scheduleService.getWeekSchedule(guildId, anchorDate);
  const weekStartStr = formatDate(weekData.weekStart, tz);
  const weekEndStr = formatDate(weekData.weekEnd, tz);

  const embed = new EmbedBuilder()
    .setTitle(`🗓️ LỊCH TUẦN (${weekStartStr} → ${weekEndStr})`)
    .setColor(EMBED_COLORS.PRIMARY)
    .setFooter({ text: `Cập nhật: ${formatFullDateTime(new Date(), tz)}` });

  const daySections = weekData.days.map((day) => {
    let content = `**${day.weekdayName} — ${day.formattedDate}**\n`;
    if (day.totalBookings === 0) {
      content += `*Không có lịch*\n`;
    } else {
      content += `📊 ${day.totalBookings} lịch • **${day.totalBookedHours}H** đã đặt\n`;
      const bookingLines = day.bookings
        .map((b) => `  • \`${formatTime(b.startAt, tz)} - ${formatTime(b.endAt, tz)}\` ${b.customerName}`)
        .slice(0, 5)
        .join('\n');
      content += `${bookingLines}\n`;
    }
    return content;
  });

  embed.setDescription(daySections.join('\n━━━━━━━━━━━━━━━━━━\n'));

  return embed;
}

export function createWeekNavigationButtons(anchorDate: Date): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`week_prev:${anchorDate.getTime()}`)
      .setLabel('◀ Tuần trước')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`week_today:${Date.now()}`)
      .setLabel('Hôm nay')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`week_next:${anchorDate.getTime()}`)
      .setLabel('Tuần sau ▶')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

export async function buildFreeSlotsEmbed(guildId: string, date: Date = new Date()): Promise<EmbedBuilder> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;

  const freeSlots = await availabilityService.getFreeSlotsForDay(guildId, date);
  const dateStr = formatDate(date, tz);
  const weekday = getVietnameseWeekday(date, tz);

  const embed = new EmbedBuilder()
    .setTitle(`🟢 GIỜ TRỐNG — ${weekday.toUpperCase()} ${dateStr}`)
    .setColor(EMBED_COLORS.SUCCESS)
    .setFooter({ text: `Cập nhật: ${formatFullDateTime(new Date(), tz)}` });

  if (freeSlots.length === 0) {
    embed.setDescription('❌ Đã kín lịch, không còn khoảng thời gian trống.');
  } else {
    const list = freeSlots
      .map((s) => `🟢 **${formatTime(s.start, tz)} → ${formatTime(s.end, tz)}** (${formatDuration(s.durationMinutes)})`)
      .join('\n\n');
    embed.setDescription(list);
  }

  return embed;
}

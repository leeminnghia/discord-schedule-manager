import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prisma } from '../../database/prisma.js';
import { availabilityService } from '../../services/availability.service.js';
import { settingsService } from '../../services/settings.service.js';
import { BOOKING_STATUS_DISPLAY, EMBED_COLORS } from '../../config/constants.js';
import {
  formatDate,
  formatTime,
  getVietnameseWeekday,
  getEndOfDay,
  nowInTimezone,
} from '../../utils/timezone.js';
import { formatDuration } from '../../utils/duration.js';
import { formatTimeRange } from '../../utils/formatters.js';

export async function buildLiveDashboardEmbed(guildId: string): Promise<EmbedBuilder> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;
  const now = nowInTimezone(tz);
  const todayEnd = getEndOfDay(now, tz);

  // Hide bookings that have started over 30 minutes ago or are already completed
  const activeCutoff = new Date(now.getTime() - 30 * 60 * 1000);

  const dateStr = formatDate(now, tz);
  const weekday = getVietnameseWeekday(now, tz);

  // 1. Fetch today's upcoming active bookings (sorted with closest upcoming at top)
  const todayBookings = await prisma.booking.findMany({
    where: {
      guildId,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
      startAt: { gte: activeCutoff, lt: todayEnd },
    },
    orderBy: { startAt: 'asc' },
  });

  // 2. Fetch upcoming future bookings (sorted chronologically)
  const futureBookings = await prisma.booking.findMany({
    where: {
      guildId,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
      startAt: { gte: todayEnd },
    },
    orderBy: { startAt: 'asc' },
    take: 20,
  });

  // Real-time free slots remaining from now onwards
  const freeSlots = await availabilityService.getFreeSlotsForDay(guildId, now, true);

  const embed = new EmbedBuilder()
    .setTitle('✨ BẢNG QUẢN LÝ ĐẶT LỊCH & THỜI GIAN LÀM VIỆC')
    .setColor(EMBED_COLORS.PRIMARY)
    .setDescription(
      `📅 **HÔM NAY: ${weekday.toUpperCase()} — ${dateStr}**\n` +
      `💰 **Giá dịch vụ:** 15.000đ / 1 giờ • **Tối thiểu:** 2 giờ (2h)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );

  // 1. Today's Bookings
  let todayContent = '';
  if (todayBookings.length === 0) {
    todayContent = '*(Hôm nay hiện không còn lịch nào — Sẵn sàng nhận khách mới)*';
  } else {
    const lines = todayBookings.map((b, idx) => {
      const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[b.status]?.emoji || '🟢';
      const range = formatTimeRange(b.startAt, b.endAt, tz);
      const dur = formatDuration(b.durationMinutes);
      let line = `${statusEmoji} **${idx + 1}. ${b.customerName}** — \`${range}\` (${dur}) • \`${b.bookingCode}\``;
      if (b.note && b.note.trim()) {
        line += `\n   └ 📝 *Ghi chú:* **${b.note.trim()}**`;
      }
      return line;
    });
    todayContent = lines.join('\n');
  }

  embed.addFields({
    name: `📋 LỊCH CẦN THỰC HIỆN HÔM NAY (${dateStr})`,
    value: todayContent,
    inline: false,
  });

  // 2. Future Bookings
  if (futureBookings.length > 0) {
    const grouped: Record<string, typeof futureBookings> = {};
    for (const fb of futureBookings) {
      const dKey = formatDate(fb.startAt, tz);
      if (!grouped[dKey]) grouped[dKey] = [];
      grouped[dKey].push(fb);
    }

    const futureLines: string[] = [];
    for (const [dayDateStr, bList] of Object.entries(grouped)) {
      const firstB = bList[0];
      const dayWk = getVietnameseWeekday(firstB.startAt, tz);
      futureLines.push(`📅 **${dayWk.toUpperCase()} (${dayDateStr})**:`);
      for (const b of bList) {
        const range = formatTimeRange(b.startAt, b.endAt, tz);
        const dur = formatDuration(b.durationMinutes);
        let line = `  • **${b.customerName}** — \`${range}\` (${dur}) • \`${b.bookingCode}\``;
        if (b.note && b.note.trim()) {
          line += `\n    └ 📝 *Ghi chú:* **${b.note.trim()}**`;
        }
        futureLines.push(line);
      }
    }

    embed.addFields({
      name: '🗓️ LỊCH CÁC NGÀY TIẾP THEO (GẦN NHẤT ĐỨNG ĐẦU)',
      value: futureLines.join('\n'),
      inline: false,
    });
  } else {
    embed.addFields({
      name: '🗓️ LỊCH CÁC NGÀY TIẾP THEO',
      value: '*(Chưa có lịch đặt cho các ngày tới)*',
      inline: false,
    });
  }

  // 3. Free slots section (Real-time remaining slots)
  let freeContent = '';
  if (freeSlots.length === 0) {
    freeContent = '❌ Hôm nay từ giờ đến hết ngày đã kín lịch, không còn giờ trống.';
  } else {
    const slotLines = freeSlots.map(
      (s) => `🟢 \`${formatTimeRange(s.start, s.end, tz)}\` (${formatDuration(s.durationMinutes)})`
    );
    freeContent = slotLines.join('\n');
  }

  embed.addFields({
    name: '🟢 GIỜ CÒN TRỐNG TỪ BÂY GIỜ',
    value: freeContent,
    inline: false,
  });

  // 4. Stats summary
  const totalBookedMins = todayBookings.reduce((acc, b) => acc + b.durationMinutes, 0);
  const totalBookedHours = (totalBookedMins / 60).toFixed(1).replace('.0', '');
  const totalFreeMins = freeSlots.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalFreeHours = (totalFreeMins / 60).toFixed(1).replace('.0', '');

  embed.addFields({
    name: '📊 TỔNG KẾT HÔM NAY',
    value: `• Lịch sắp tới hôm nay: **${todayBookings.length}** | • Giờ đã đặt: **${totalBookedHours}H** | • Giờ còn trống: **${totalFreeHours}H**`,
    inline: false,
  });

  embed.setFooter({ text: `Tự động ẩn lịch sau 30p • Cập nhật lúc ${formatTime(new Date(), tz)}` });

  return embed;
}

export async function buildLiveDashboardComponents(guildId: string): Promise<ActionRowBuilder<any>[]> {
  const settings = await settingsService.getSettings(guildId);
  const tz = settings.timezone;
  const now = nowInTimezone(tz);

  // Active cutoff: only show bookings that haven't passed 30 mins from start
  const activeCutoff = new Date(now.getTime() - 30 * 60 * 1000);

  const activeBookings = await prisma.booking.findMany({
    where: {
      guildId,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
      startAt: { gte: activeCutoff },
    },
    orderBy: { startAt: 'asc' },
    take: 25,
  });

  const components: ActionRowBuilder<any>[] = [];

  // Dropdown to pick a booking to manage
  if (activeBookings.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('dashboard_select_booking')
      .setPlaceholder('⚡ Chọn một lịch để tùy chỉnh (Dời/Hủy/Hoàn thành)...');

    for (const b of activeBookings) {
      const dateText = formatDate(b.startAt, tz);
      const dayWk = getVietnameseWeekday(b.startAt, tz);
      const timeText = `${formatTime(b.startAt, tz)} - ${formatTime(b.endAt, tz)}`;
      const noteSnippet = b.note ? ` • 📝 ${b.note.slice(0, 30)}` : '';

      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${b.customerName} (${timeText})`)
          .setDescription(`${dayWk} ${dateText} • ${b.bookingCode}${noteSnippet}`)
          .setValue(b.bookingCode)
          .setEmoji('📋')
      );
    }

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  // Action buttons
  const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_quick_book')
      .setLabel('Đặt lịch')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('panel_refresh')
      .setLabel('Làm mới bảng')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('panel_tomorrow')
      .setLabel('Ngày mai')
      .setEmoji('🌅')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_free')
      .setLabel('Giờ trống')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Secondary)
  );

  const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_customers')
      .setLabel('Khách hàng')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_stats')
      .setLabel('Thống kê')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_help')
      .setLabel('Hướng dẫn')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Secondary)
  );

  components.push(buttonRow1, buttonRow2);

  return components;
}

// Aliases for dashboard.service.ts
export const buildControlPanelEmbed = buildLiveDashboardEmbed;
export const buildControlPanelButtons = buildLiveDashboardComponents;

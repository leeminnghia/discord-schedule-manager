import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
} from 'discord.js';
import { BookingWithCustomer } from '../../services/booking.service.js';
import { BOOKING_STATUS_DISPLAY, EMBED_COLORS, TIMEZONE } from '../../config/constants.js';
import { formatTime, formatDate, formatFullDateTime } from '../../utils/timezone.js';
import { formatDuration } from '../../utils/duration.js';

export function createBookingCardEmbed(booking: BookingWithCustomer, tz: string = TIMEZONE): EmbedBuilder {
  const statusInfo = (BOOKING_STATUS_DISPLAY as any)[booking.status] || {
    emoji: '⚪',
    label: booking.status,
    full: booking.status,
  };

  let embedColor: ColorResolvable = EMBED_COLORS.PRIMARY;
  if (booking.status === 'COMPLETED') embedColor = EMBED_COLORS.SUCCESS;
  if (booking.status === 'CANCELLED') embedColor = EMBED_COLORS.DANGER;
  if (booking.status === 'IN_PROGRESS') embedColor = EMBED_COLORS.INFO;

  const dateStr = formatDate(booking.startAt, tz);
  const timeRange = `${formatTime(booking.startAt, tz)} → ${formatTime(booking.endAt, tz)}`;
  const durationText = formatDuration(booking.durationMinutes);

  const embed = new EmbedBuilder()
    .setTitle(`📋 CHI TIẾT BOOKING — ${booking.bookingCode}`)
    .setColor(embedColor)
    .addFields(
      { name: '👤 Khách hàng', value: `**${booking.customerName}**${booking.discordUserId ? ` (<@${booking.discordUserId}>)` : ''}`, inline: true },
      { name: '📌 Trạng thái', value: statusInfo.full, inline: true },
      { name: '⏱️ Thời lượng', value: durationText, inline: true },
      { name: '📅 Ngày hẹn', value: dateStr, inline: true },
      { name: '🕐 Khung giờ', value: timeRange, inline: true },
      { name: '📝 Ghi chú', value: booking.note || '*Không có*', inline: true }
    )
    .setFooter({ text: `Tạo lúc: ${formatFullDateTime(booking.createdAt, tz)}` });

  if (booking.status === 'CANCELLED' && booking.cancellationReason) {
    embed.addFields({ name: '❌ Lý do hủy', value: booking.cancellationReason, inline: false });
  }

  return embed;
}

export function createBookingCardButtons(bookingCode: string, status: string): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const isCancelled = status === 'CANCELLED';
  const isCompleted = status === 'COMPLETED';

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`book_complete:${bookingCode}`)
      .setLabel('Hoàn thành')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isCancelled || isCompleted),

    new ButtonBuilder()
      .setCustomId(`book_reschedule:${bookingCode}`)
      .setLabel('Dời lịch')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isCancelled || isCompleted),

    new ButtonBuilder()
      .setCustomId(`book_extend:${bookingCode}`)
      .setLabel('Gia hạn')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isCancelled || isCompleted),

    new ButtonBuilder()
      .setCustomId(`book_cancel:${bookingCode}`)
      .setLabel('Hủy lịch')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isCancelled || isCompleted)
  );

  return [row];
}

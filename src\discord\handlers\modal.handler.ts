import { ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { assertOwnerOrAdmin } from '../permissions.js';
import { bookingService } from '../../services/booking.service.js';
import { customerService } from '../../services/customer.service.js';
import { dashboardService } from '../../services/dashboard.service.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../components/booking-card.js';
import { formatErrorMessage, ConflictError } from '../../utils/errors.js';
import { formatTime, formatDate } from '../../utils/timezone.js';
import { formatDuration } from '../../utils/duration.js';
import { EMBED_COLORS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export async function handleModalInteraction(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  try {
    assertOwnerOrAdmin(interaction);

    if (customId === 'modal_quick_book') {
      const customerName = interaction.fields.getTextInputValue('customer_name');
      const dateStr = interaction.fields.getTextInputValue('booking_date');
      const startTimeStr = interaction.fields.getTextInputValue('booking_time');
      const durationStr = interaction.fields.getTextInputValue('booking_duration');
      const note = interaction.fields.getTextInputValue('booking_note') || undefined;

      const booking = await bookingService.createBooking({
        guildId: interaction.guildId || '',
        customerName,
        dateStr,
        startTimeStr,
        durationStr,
        note,
        createdBy: interaction.user.id,
      });

      await dashboardService.refreshAll(interaction.guildId || '');

      const embed = createBookingCardEmbed(booking);
      const buttons = createBookingCardButtons(booking.bookingCode, booking.status);

      await interaction.reply({
        content: `✅ **ĐẶT LỊCH THÀNH CÔNG!** Mã booking: \`${booking.bookingCode}\``,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
      return;
    }

    if (customId.startsWith('modal_reschedule:')) {
      const bookingCode = customId.split(':')[1];
      const newDateStr = interaction.fields.getTextInputValue('new_date');
      const newStartTimeStr = interaction.fields.getTextInputValue('new_time');

      const updated = await bookingService.rescheduleBooking({
        guildId: interaction.guildId || '',
        bookingCode,
        newDateStr,
        newStartTimeStr,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(interaction.guildId || '');

      const embed = createBookingCardEmbed(updated);
      const buttons = createBookingCardButtons(updated.bookingCode, updated.status);

      await interaction.reply({
        content: `🔄 **ĐÃ DỜI LỊCH THÀNH CÔNG!** Booking \`${updated.bookingCode}\` của khách **${updated.customerName}** đã chuyển sang **${newDateStr} lúc ${newStartTimeStr}**.`,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
      return;
    }

    if (customId.startsWith('modal_extend:')) {
      const bookingCode = customId.split(':')[1];
      const extraDuration = interaction.fields.getTextInputValue('extra_duration');

      const updated = await bookingService.extendBooking({
        guildId: interaction.guildId || '',
        bookingCode,
        extraDurationStr: extraDuration,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(interaction.guildId || '');

      const embed = createBookingCardEmbed(updated);
      const buttons = createBookingCardButtons(updated.bookingCode, updated.status);

      await interaction.reply({
        content: `➕ **ĐÃ GIA HẠN THÀNH CÔNG!** Booking \`${updated.bookingCode}\` đã được gia hạn thêm **${extraDuration}**. Giờ kết thúc mới: **${formatTime(updated.endAt)}**.`,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
      return;
    }

    if (customId.startsWith('modal_cancel:')) {
      const bookingCode = customId.split(':')[1];
      const reason = interaction.fields.getTextInputValue('cancel_reason') || undefined;

      const cancelled = await bookingService.cancelBooking({
        guildId: interaction.guildId || '',
        bookingCode,
        reason,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(interaction.guildId || '');

      await interaction.reply({
        content: `❌ **ĐÃ HỦY BOOKING!** Mã: \`${cancelled.bookingCode}\` của khách **${cancelled.customerName}** đã được hủy.`,
        ephemeral: true,
      });
      return;
    }
  } catch (error: any) {
    logger.error({ error, customId }, 'Error in modal interaction handler');

    if (error instanceof ConflictError && error.conflictDetails) {
      const cd = error.conflictDetails;
      let desc = `❌ **KHÔNG THỂ THỰC HIỆN**\n\n${error.message}\n\n`;
      if (cd.suggestedFreeSlots && cd.suggestedFreeSlots.length > 0) {
        desc += `🟢 **Khoảng trống gần nhất:**\n`;
        for (const s of cd.suggestedFreeSlots) {
          desc += `• \`${formatTime(s.start)} → ${formatTime(s.end)}\` (${formatDuration(s.durationMinutes)})\n`;
        }
      }

      const conflictEmbed = new EmbedBuilder()
        .setTitle('❌ XUNG ĐỘT THỜI GIAN')
        .setColor(EMBED_COLORS.DANGER)
        .setDescription(desc);

      await interaction.reply({ embeds: [conflictEmbed], ephemeral: true });
      return;
    }

    const msg = `❌ ${formatErrorMessage(error)}`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}

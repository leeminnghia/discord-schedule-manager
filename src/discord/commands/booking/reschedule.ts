import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { prisma } from '../../../database/prisma.js';
import { formatErrorMessage, ConflictError } from '../../../utils/errors.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../../components/booking-card.js';
import { formatTime, formatDate } from '../../../utils/timezone.js';
import { formatDuration } from '../../../utils/duration.js';
import { getDateChoices, getTimeChoices } from '../../../utils/autocomplete.js';
import { EMBED_COLORS } from '../../../config/constants.js';

export const rescheduleCommand = {
  data: new SlashCommandBuilder()
    .setName('reschedule')
    .setDescription('Dời lịch của một booking sang ngày hoặc giờ mới')
    .addStringOption((opt) =>
      opt.setName('booking').setDescription('Mã booking').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('new_date').setDescription('Ngày mới (chọn hoặc nhập DD/MM/YYYY)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('new_start_time').setDescription('Giờ bắt đầu mới (chọn hoặc nhập 15:00, 15h...)').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'booking') {
      const focusedValue = focused.value.trim().toUpperCase();
      const bookings = await prisma.booking.findMany({
        where: {
          guildId: interaction.guild.id,
          status: { in: ['CONFIRMED', 'PENDING', 'PAID'] },
          OR: [
            { bookingCode: { contains: focusedValue } },
            { customerName: { contains: focusedValue } },
          ],
        },
        orderBy: { startAt: 'asc' },
        take: 15,
      });

      await interaction.respond(
        bookings.map((b) => ({
          name: `${b.bookingCode} | ${b.customerName} | ${formatDate(b.startAt)} ${formatTime(b.startAt)}`,
          value: b.bookingCode,
        }))
      );
      return;
    }

    if (focused.name === 'new_date') {
      const choices = getDateChoices(focused.value);
      await interaction.respond(choices);
      return;
    }

    if (focused.name === 'new_start_time') {
      const choices = getTimeChoices(focused.value);
      await interaction.respond(choices);
      return;
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const bookingCode = interaction.options.getString('booking', true);
    const newDateStr = interaction.options.getString('new_date', true);
    const newStartTimeStr = interaction.options.getString('new_start_time', true);

    try {
      const updated = await bookingService.rescheduleBooking({
        guildId,
        bookingCode,
        newDateStr,
        newStartTimeStr,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(guildId);

      const embed = createBookingCardEmbed(updated);
      const buttons = createBookingCardButtons(updated.bookingCode, updated.status);

      await interaction.reply({
        content: `🔄 **ĐÃ DỜI LỊCH THÀNH CÔNG!** Booking \`${updated.bookingCode}\` của khách **${updated.customerName}** đã được chuyển sang **${newDateStr} lúc ${newStartTimeStr}**.`,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
    } catch (error: any) {
      if (error instanceof ConflictError && error.conflictDetails) {
        const cd = error.conflictDetails;
        let desc = `❌ **KHÔNG THỂ DỜI LỊCH**\n\n${error.message}\n\n`;
        if (cd.suggestedFreeSlots && cd.suggestedFreeSlots.length > 0) {
          desc += `🟢 **Các khoảng trống gợi ý:**\n`;
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

      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

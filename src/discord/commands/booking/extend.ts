import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { prisma } from '../../../database/prisma.js';
import { formatErrorMessage } from '../../../utils/errors.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../../components/booking-card.js';
import { formatTime, formatDate } from '../../../utils/timezone.js';
import { getDurationChoices } from '../../../utils/autocomplete.js';

export const extendCommand = {
  data: new SlashCommandBuilder()
    .setName('extend')
    .setDescription('Gia hạn thêm thời lượng cho một booking')
    .addStringOption((opt) =>
      opt.setName('booking').setDescription('Mã booking').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('extra').setDescription('Thời lượng muốn tăng thêm (chọn hoặc nhập 30m, 1h, 2h...)').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'booking') {
      const focusedValue = focused.value.trim().toUpperCase();
      const bookings = await prisma.booking.findMany({
        where: {
          guildId: interaction.guild.id,
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING'] },
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

    if (focused.name === 'extra') {
      const choices = getDurationChoices(focused.value);
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
    const extra = interaction.options.getString('extra', true);

    try {
      const updated = await bookingService.extendBooking({
        guildId,
        bookingCode,
        extraDurationStr: extra,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(guildId);

      const embed = createBookingCardEmbed(updated);
      const buttons = createBookingCardButtons(updated.bookingCode, updated.status);

      await interaction.reply({
        content: `➕ **ĐÃ GIA HẠN THÀNH CÔNG!** Booking \`${updated.bookingCode}\` của khách **${updated.customerName}** đã được gia hạn thêm **${extra}**. Giờ kết thúc mới: **${formatTime(updated.endAt)}**.`,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

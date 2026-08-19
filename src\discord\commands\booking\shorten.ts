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

export const shortenCommand = {
  data: new SlashCommandBuilder()
    .setName('shorten')
    .setDescription('Rút ngắn thời lượng booking')
    .addStringOption((opt) =>
      opt.setName('booking').setDescription('Mã booking').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('new_end_time').setDescription('Giờ kết thúc mới (HH:mm, ví dụ: 16:00)').setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName('minutes').setDescription('Số phút muốn rút ngắn bớt (ví dụ: 30, 60)').setRequired(false)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const focusedValue = interaction.options.getFocused().trim().toUpperCase();

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
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const bookingCode = interaction.options.getString('booking', true);
    const newEndTimeStr = interaction.options.getString('new_end_time') || undefined;
    const minutes = interaction.options.getInteger('minutes') || undefined;

    try {
      const updated = await bookingService.shortenBooking({
        guildId,
        bookingCode,
        newEndTimeStr,
        shortenByMinutes: minutes,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(guildId);

      const embed = createBookingCardEmbed(updated);
      const buttons = createBookingCardButtons(updated.bookingCode, updated.status);

      await interaction.reply({
        content: `➖ **ĐÃ RÚT NGẮN THÀNH CÔNG!** Booking \`${updated.bookingCode}\` của khách **${updated.customerName}** có giờ kết thúc mới: **${formatTime(updated.endAt)}**.`,
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

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { settingsService } from '../../../services/settings.service.js';
import { prisma } from '../../../database/prisma.js';
import { discordClient } from '../../client.js';
import { createBookingCardEmbed } from '../../components/booking-card.js';
import { formatErrorMessage } from '../../../utils/errors.js';
import { formatTime, formatDate } from '../../../utils/timezone.js';
import { TextChannel } from 'discord.js';

export const cancelCommand = {
  data: new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Hủy một booking của khách')
    .addStringOption((opt) =>
      opt.setName('booking').setDescription('Mã booking').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Lý do hủy (tùy chọn)').setRequired(false)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const focusedValue = interaction.options.getFocused().trim().toUpperCase();

    const bookings = await prisma.booking.findMany({
      where: {
        guildId: interaction.guild.id,
        status: { not: 'CANCELLED' },
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
    const reason = interaction.options.getString('reason') || undefined;

    try {
      const cancelled = await bookingService.cancelBooking({
        guildId,
        bookingCode,
        reason,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(guildId);

      // Post embed to ❌・lich-da-huy if configured
      const settings = await settingsService.getSettings(guildId);
      if (settings.channelCancelledId) {
        const cancelledChan = await discordClient.channels.fetch(settings.channelCancelledId).catch(() => null);
        if (cancelledChan && cancelledChan instanceof TextChannel) {
          const card = createBookingCardEmbed(cancelled);
          await cancelledChan.send({ embeds: [card] });
        }
      }

      await interaction.reply({
        content: `❌ **ĐÃ HỦY BOOKING!** Mã: \`${cancelled.bookingCode}\` của khách **${cancelled.customerName}** đã được chuyển sang trạng thái hủy. Khung giờ hẹn đã được mở lại thành giờ trống.`,
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

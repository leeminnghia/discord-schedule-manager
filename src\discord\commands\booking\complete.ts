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

export const completeCommand = {
  data: new SlashCommandBuilder()
    .setName('complete')
    .setDescription('Đánh dấu hoàn thành một booking')
    .addStringOption((opt) =>
      opt.setName('booking').setDescription('Mã booking').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const focusedValue = interaction.options.getFocused().trim().toUpperCase();

    const bookings = await prisma.booking.findMany({
      where: {
        guildId: interaction.guild.id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PAID', 'PENDING'] },
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

    try {
      const completed = await bookingService.completeBooking({
        guildId,
        bookingCode,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(guildId);

      // Post embed to ✅・lich-hoan-thanh if configured
      const settings = await settingsService.getSettings(guildId);
      if (settings.channelCompletedId) {
        const compChan = await discordClient.channels.fetch(settings.channelCompletedId).catch(() => null);
        if (compChan && compChan instanceof TextChannel) {
          const card = createBookingCardEmbed(completed);
          await compChan.send({ embeds: [card] });
        }
      }

      await interaction.reply({
        content: `✅ **ĐÃ HOÀN THÀNH BOOKING!** Mã: \`${completed.bookingCode}\` của khách **${completed.customerName}** đã được lưu vào lịch sử hoàn thành.`,
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

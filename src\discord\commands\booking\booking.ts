import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { prisma } from '../../../database/prisma.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../../components/booking-card.js';
import { formatErrorMessage } from '../../../utils/errors.js';
import { formatTime, formatDate } from '../../../utils/timezone.js';

export const bookingDetailCommand = {
  data: new SlashCommandBuilder()
    .setName('booking')
    .setDescription('Xem thông tin chi tiết của một mã booking')
    .addStringOption((opt) =>
      opt.setName('code').setDescription('Mã booking (ví dụ: BK-20260819-001)').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const focusedValue = interaction.options.getFocused().trim().toUpperCase();

    const bookings = await prisma.booking.findMany({
      where: {
        guildId: interaction.guild.id,
        OR: [
          { bookingCode: { contains: focusedValue } },
          { customerName: { contains: focusedValue } },
        ],
      },
      orderBy: { startAt: 'desc' },
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

    const code = interaction.options.getString('code', true);

    try {
      const booking = await bookingService.getBookingByCode(code, interaction.guild.id);
      const embed = createBookingCardEmbed(booking);
      const buttons = createBookingCardButtons(booking.bookingCode, booking.status);

      await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

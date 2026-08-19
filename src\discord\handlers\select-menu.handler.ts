import { StringSelectMenuInteraction } from 'discord.js';
import { assertOwnerOrAdmin } from '../permissions.js';
import { bookingService } from '../../services/booking.service.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../components/booking-card.js';
import { formatErrorMessage } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const customId = interaction.customId;

  try {
    assertOwnerOrAdmin(interaction);

    if (customId === 'dashboard_select_booking') {
      const selectedBookingCode = interaction.values[0];
      const booking = await bookingService.getBookingByCode(
        selectedBookingCode,
        interaction.guildId || undefined
      );

      const embed = createBookingCardEmbed(booking);
      const buttons = createBookingCardButtons(booking.bookingCode, booking.status);

      await interaction.reply({
        content: `⚙️ **TÙY CHỈNH BOOKING \`${booking.bookingCode}\` (${booking.customerName})**\n*Bấm các nút bên dưới để thao tác:*`,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
      return;
    }
  } catch (error) {
    logger.error({ error, customId }, 'Error in select menu interaction handler');
    const msg = `❌ ${formatErrorMessage(error)}`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}

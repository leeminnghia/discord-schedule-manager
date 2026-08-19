import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { customerService } from '../../../services/customer.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../../components/booking-card.js';
import { formatErrorMessage, ConflictError } from '../../../utils/errors.js';
import { formatTime } from '../../../utils/timezone.js';
import { formatDuration } from '../../../utils/duration.js';
import { getDateChoices, getTimeChoices, getDurationChoices } from '../../../utils/autocomplete.js';
import { EMBED_COLORS } from '../../../config/constants.js';

export const bookCommand = {
  data: new SlashCommandBuilder()
    .setName('book')
    .setDescription('Tạo một lịch đặt hẹn mới cho khách')
    .addStringOption((opt) =>
      opt.setName('customer').setDescription('Tên khách hàng').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Ngày hẹn (chọn hoặc nhập DD/MM/YYYY)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('start_time').setDescription('Giờ bắt đầu (chọn hoặc nhập 14:00, 14h, 9h30...)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('Thời lượng (chọn hoặc nhập 1h, 2h, 30m, 2...)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('note').setDescription('Ghi chú thêm cho booking (tùy chọn)').setRequired(false)
    )
    .addUserOption((opt) =>
      opt.setName('discord_user').setDescription('Tag tài khoản Discord của khách (tùy chọn)').setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName('override').setDescription('Bỏ qua kiểm tra trùng lịch (admin override)').setRequired(false)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'customer') {
      const customers = await customerService.searchCustomers(focusedOption.value, 10);
      const choices = customers.map((c) => ({
        name: `${c.name}${c.phone ? ` (${c.phone})` : ''}`,
        value: c.name,
      }));
      // If user typed a custom name that is not in database yet, also provide it as first choice
      if (focusedOption.value && !choices.some((c) => c.value.toLowerCase() === focusedOption.value.toLowerCase())) {
        choices.unshift({ name: `➕ Khách mới: "${focusedOption.value}"`, value: focusedOption.value });
      }
      await interaction.respond(choices.slice(0, 25));
      return;
    }

    if (focusedOption.name === 'date') {
      const choices = getDateChoices(focusedOption.value);
      await interaction.respond(choices);
      return;
    }

    if (focusedOption.name === 'start_time') {
      const choices = getTimeChoices(focusedOption.value);
      await interaction.respond(choices);
      return;
    }

    if (focusedOption.name === 'duration') {
      const choices = getDurationChoices(focusedOption.value);
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
    const customerName = interaction.options.getString('customer', true);
    const dateStr = interaction.options.getString('date', true);
    const startTimeStr = interaction.options.getString('start_time', true);
    const durationStr = interaction.options.getString('duration', true);
    const note = interaction.options.getString('note') || undefined;
    const discordUser = interaction.options.getUser('discord_user');
    const bypassConflictCheck = interaction.options.getBoolean('override') || false;

    try {
      const booking = await bookingService.createBooking({
        guildId,
        customerName,
        discordUserId: discordUser?.id,
        dateStr,
        startTimeStr,
        durationStr,
        note,
        createdBy: interaction.user.id,
        bypassConflictCheck,
      });

      // Refresh persistent dashboard embeds
      await dashboardService.refreshAll(guildId);

      const embed = createBookingCardEmbed(booking);
      const buttons = createBookingCardButtons(booking.bookingCode, booking.status);

      await interaction.reply({
        content: `✅ **ĐẶT LỊCH THÀNH CÔNG!** Mã booking: \`${booking.bookingCode}\``,
        embeds: [embed],
        components: buttons,
        ephemeral: true,
      });
    } catch (error: any) {
      if (error instanceof ConflictError && error.conflictDetails) {
        const cd = error.conflictDetails;
        let desc = `❌ **KHÔNG THỂ ĐẶT LỊCH**\n\n`;
        desc += `Thời gian yêu cầu bị trùng.\n\n`;
        if (cd.conflictingItem) {
          desc += `**Bị trùng với:**\n${cd.conflictingItem.title}\n\n`;
        }
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

      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

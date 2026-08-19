import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { scheduleService } from '../../../services/schedule.service.js';
import { settingsService } from '../../../services/settings.service.js';
import { EMBED_COLORS } from '../../../config/constants.js';
import { formatTime, formatDate } from '../../../utils/timezone.js';
import { formatDuration } from '../../../utils/duration.js';
import { formatRemainingTime, formatTimeRange } from '../../../utils/formatters.js';

export const nextCommand = {
  data: new SlashCommandBuilder()
    .setName('next')
    .setDescription('Xem lịch hẹn đang diễn ra hoặc lịch tiếp theo gần nhất'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;

    const nextOverview = await scheduleService.getNextBookingOverview(guildId);

    if (!nextOverview.currentOrNext) {
      await interaction.reply({
        content: '🟢 Hiện tại bạn không có lịch nào đang thực hiện hoặc sắp tới.',
        ephemeral: true,
      });
      return;
    }

    const b = nextOverview.currentOrNext;
    const now = new Date();
    const timeRange = formatTimeRange(b.startAt, b.endAt, tz);
    const durationText = formatDuration(b.durationMinutes);
    const dateStr = formatDate(b.startAt, tz);

    const embed = new EmbedBuilder();

    if (nextOverview.isCurrentlyActive) {
      const remainingTime = formatRemainingTime(b.endAt, now);
      embed
        .setTitle('▶️ ĐANG THỰC HIỆN')
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(
          `👤 **Khách hàng:** ${b.customerName}\n` +
          `📅 **Ngày:** ${dateStr}\n` +
          `🕐 **Khung giờ:** ${timeRange}\n` +
          `⏱️ **Thời lượng:** ${durationText}\n` +
          `⏳ **Còn lại:** ${remainingTime}\n` +
          `📋 **Mã booking:** \`${b.bookingCode}\``
        );
    } else {
      const startsIn = formatRemainingTime(b.startAt, now);
      embed
        .setTitle('🔴 LỊCH TIẾP THEO')
        .setColor(EMBED_COLORS.WARNING)
        .setDescription(
          `👤 **Khách hàng:** ${b.customerName}\n` +
          `📅 **Ngày:** ${dateStr}\n` +
          `🕐 **Khung giờ:** ${timeRange}\n` +
          `⏱️ **Thời lượng:** ${durationText}\n` +
          `⏳ **Bắt đầu sau:** ${startsIn}\n` +
          `📋 **Mã booking:** \`${b.bookingCode}\``
        );
    }

    if (nextOverview.followingBooking) {
      const fol = nextOverview.followingBooking;
      embed.addFields({
        name: '➡️ Lịch kế tiếp sau đó',
        value: `${fol.customerName} — \`${formatTimeRange(fol.startAt, fol.endAt, tz)}\` (${formatDate(fol.startAt, tz)})`,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

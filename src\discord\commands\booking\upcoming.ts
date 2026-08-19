import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { scheduleService } from '../../../services/schedule.service.js';
import { settingsService } from '../../../services/settings.service.js';
import { EMBED_COLORS } from '../../../config/constants.js';
import { formatDate, formatTime } from '../../../utils/timezone.js';
import { formatTimeRange } from '../../../utils/formatters.js';

export const upcomingCommand = {
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Xem danh sách 5-10 lịch sắp tới gần nhất')
    .addIntegerOption((opt) =>
      opt.setName('limit').setDescription('Số lượng lịch muốn xem (mặc định: 5)').setRequired(false).setMinValue(1).setMaxValue(15)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const limit = interaction.options.getInteger('limit') || 5;

    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;

    const bookings = await scheduleService.getUpcomingBookings(guildId, limit);

    if (bookings.length === 0) {
      await interaction.reply({
        content: '📅 Hiện tại không có lịch hẹn nào sắp tới.',
        ephemeral: true,
      });
      return;
    }

    const lines = bookings.map((b, idx) => {
      const dateStr = formatDate(b.startAt, tz);
      const timeRange = formatTimeRange(b.startAt, b.endAt, tz);
      return `**${idx + 1}. ${b.customerName}** (\`${b.bookingCode}\`)\n   📅 ${dateStr} — \`${timeRange}\``;
    });

    const embed = new EmbedBuilder()
      .setTitle('📅 DANH SÁCH LỊCH SẮP TỚI')
      .setColor(EMBED_COLORS.PRIMARY)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Hiển thị ${bookings.length} lịch sắp tới` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

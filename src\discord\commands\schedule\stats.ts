import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { scheduleService } from '../../../services/schedule.service.js';
import { EMBED_COLORS } from '../../../config/constants.js';
import { formatDuration } from '../../../utils/duration.js';

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Xem thống kê hiệu suất làm việc và lịch đặt')
    .addSubcommand((sub) => sub.setName('today').setDescription('Thống kê chi tiết hôm nay'))
    .addSubcommand((sub) => sub.setName('week').setDescription('Thống kê trong tuần này'))
    .addSubcommand((sub) => sub.setName('month').setDescription('Thống kê trong tháng này')),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand() as 'today' | 'week' | 'month';

    const stats = await scheduleService.getStats(guildId, subcommand);

    const timeframeName =
      subcommand === 'today' ? 'HÔM NAY' : subcommand === 'week' ? 'TUẦN NÀY' : 'THÁNG NÀY';

    const totalHours = (stats.totalBookedMinutes / 60).toFixed(1).replace('.0', '');
    const completedHours = (stats.completedMinutes / 60).toFixed(1).replace('.0', '');
    const remainingMinutes = stats.totalBookedMinutes - stats.completedMinutes;
    const remainingHours = (remainingMinutes / 60).toFixed(1).replace('.0', '');

    const embed = new EmbedBuilder()
      .setTitle(`📊 THỐNG KÊ ${timeframeName}`)
      .setColor(EMBED_COLORS.PRIMARY)
      .addFields(
        {
          name: '📋 Số lượng lịch',
          value:
            `• Tổng lịch: **${stats.totalBookings}**\n` +
            `• ✅ Hoàn thành: **${stats.completedBookings}**\n` +
            `• ▶️ Đang thực hiện: **${stats.inProgressBookings}**\n` +
            `• 🟢 Sắp tới: **${stats.upcomingBookings}**\n` +
            `• ❌ Đã hủy: **${stats.cancelledBookings}**`,
          inline: true,
        },
        {
          name: '⏱️ Thời lượng làm việc',
          value:
            `• Tổng giờ đã đặt: **${totalHours}H**\n` +
            `• Đã làm: **${completedHours}H**\n` +
            `• Còn lại: **${remainingHours}H**`,
          inline: true,
        }
      );

    if (stats.topCustomers && stats.topCustomers.length > 0) {
      const topLines = stats.topCustomers.map(
        (c, idx) => `${idx + 1}. **${c.name}** — ${c.bookingsCount} lịch (${formatDuration(c.minutes)})`
      );
      embed.addFields({
        name: '👥 Khách đặt nhiều nhất',
        value: topLines.join('\n'),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

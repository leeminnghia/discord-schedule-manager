import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { settingsService } from '../../../services/settings.service.js';
import { EMBED_COLORS, BOOKING_STATUS_DISPLAY } from '../../../config/constants.js';
import { formatDate, formatTime, parseDateStartOfDay } from '../../../utils/timezone.js';
import { createPaginationButtons } from '../../components/pagination.js';

export const searchCommand = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Tìm kiếm danh sách các booking theo từ khóa, ngày hoặc trạng thái')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Tên khách, ghi chú hoặc mã booking').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Tìm theo ngày (DD/MM/YYYY)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Lọc theo trạng thái')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Đã xác nhận (CONFIRMED)', value: 'CONFIRMED' },
          { name: '▶️ Đang thực hiện (IN_PROGRESS)', value: 'IN_PROGRESS' },
          { name: '✅ Hoàn thành (COMPLETED)', value: 'COMPLETED' },
          { name: '❌ Đã hủy (CANCELLED)', value: 'CANCELLED' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const query = interaction.options.getString('query') || undefined;
    const dateStr = interaction.options.getString('date') || undefined;
    const status = interaction.options.getString('status') || undefined;

    const settings = await settingsService.getSettings(guildId);
    const tz = settings.timezone;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (dateStr) {
      startDate = parseDateStartOfDay(dateStr, tz);
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    const result = await bookingService.searchBookings(
      {
        guildId,
        searchQuery: query,
        status: status as any,
        startDate,
        endDate,
      },
      1,
      8
    );

    if (result.bookings.length === 0) {
      await interaction.reply({
        content: '🔍 Không tìm thấy lịch đặt nào phù hợp với điều kiện tìm kiếm.',
        ephemeral: true,
      });
      return;
    }

    const lines = result.bookings.map((b) => {
      const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[b.status]?.emoji || '⚪';
      return `${statusEmoji} \`${b.bookingCode}\` • **${b.customerName}** • \`${formatDate(b.startAt, tz)} ${formatTime(b.startAt, tz)} → ${formatTime(b.endAt, tz)}\``;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🔎 KẾT QUẢ TÌM KIẾM BOOKING (Tìm thấy: ${result.totalCount})`)
      .setColor(EMBED_COLORS.PRIMARY)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Trang 1 / ${result.totalPages}` });

    const components = result.totalPages > 1 ? createPaginationButtons('search', 1, result.totalPages) : [];

    await interaction.reply({ embeds: [embed], components });
  },
};

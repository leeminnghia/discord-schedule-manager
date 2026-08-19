import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { prisma } from '../../../database/prisma.js';
import { EMBED_COLORS } from '../../../config/constants.js';
import { formatDuration } from '../../../utils/duration.js';
import { createPaginationButtons } from '../../components/pagination.js';

export const customersListCommand = {
  data: new SlashCommandBuilder()
    .setName('customers')
    .setDescription('Xem danh sách tất cả khách hàng đã từng đặt lịch'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const pageSize = 10;
    const totalCount = await prisma.customer.count();

    if (totalCount === 0) {
      await interaction.reply({ content: '👤 Chưa có khách hàng nào trong cơ sở dữ liệu.', ephemeral: true });
      return;
    }

    const totalPages = Math.ceil(totalCount / pageSize);
    const customers = await prisma.customer.findMany({
      orderBy: { totalBookings: 'desc' },
      take: pageSize,
    });

    const lines = customers.map(
      (c, idx) =>
        `**${idx + 1}. ${c.name}**\n` +
        `   • ${c.totalBookings} lịch (${formatDuration(c.totalMinutes)}) • Hoàn thành: ${c.completedBookings} • Hủy: ${c.cancelledBookings}`
    );

    const embed = new EmbedBuilder()
      .setTitle(`👥 DANH SÁCH KHÁCH HÀNG (${totalCount} khách)`)
      .setColor(EMBED_COLORS.PRIMARY)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Trang 1 / ${totalPages}` });

    const components = totalPages > 1 ? createPaginationButtons('customers', 1, totalPages) : [];

    await interaction.reply({ embeds: [embed], components });
  },
};

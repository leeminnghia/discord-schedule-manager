import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { customerService } from '../../../services/customer.service.js';
import { prisma } from '../../../database/prisma.js';
import { EMBED_COLORS, BOOKING_STATUS_DISPLAY, TIMEZONE } from '../../../config/constants.js';
import { formatDate, formatTime } from '../../../utils/timezone.js';
import { formatDuration } from '../../../utils/duration.js';
import { createPaginationButtons } from '../../components/pagination.js';
import { formatErrorMessage } from '../../../utils/errors.js';

export const historyCommand = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Xem lịch sử các lần đặt lịch của một khách hàng')
    .addStringOption((opt) =>
      opt.setName('customer').setDescription('Tên khách hàng').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused();
    const customers = await customerService.searchCustomers(focused, 15);
    await interaction.respond(
      customers.map((c) => ({
        name: `${c.name} | ${c.totalBookings} lịch`,
        value: c.name,
      }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const customerName = interaction.options.getString('customer', true);

    try {
      const customers = await customerService.searchCustomers(customerName, 1);
      if (customers.length === 0) {
        await interaction.reply({ content: `❌ Không tìm thấy khách hàng: "${customerName}".`, ephemeral: true });
        return;
      }

      const customer = customers[0];
      const pageSize = 8;
      const totalCount = await prisma.booking.count({
        where: { customerId: customer.id },
      });

      if (totalCount === 0) {
        await interaction.reply({
          content: `📜 Khách hàng **${customer.name}** chưa có lịch sử booking nào.`,
          ephemeral: true,
        });
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const bookings = await prisma.booking.findMany({
        where: { customerId: customer.id },
        orderBy: { startAt: 'desc' },
        take: pageSize,
      });

      const lines = bookings.map((b) => {
        const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[b.status]?.emoji || '⚪';
        const dateStr = formatDate(b.startAt);
        const timeRange = `${formatTime(b.startAt)} → ${formatTime(b.endAt)}`;
        const dur = formatDuration(b.durationMinutes);
        return `${statusEmoji} **${dateStr}** (\`${timeRange}\`) — ${dur} (\`${b.bookingCode}\`)${b.cancellationReason ? `\n   *Lý do hủy: ${b.cancellationReason}*` : ''}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📜 LỊCH SỬ BOOKING — ${customer.name}`)
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Trang 1 / ${totalPages} • Tổng ${totalCount} lần đặt` });

      const components = totalPages > 1 ? createPaginationButtons(`history:${customer.id}`, 1, totalPages) : [];

      await interaction.reply({ embeds: [embed], components });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

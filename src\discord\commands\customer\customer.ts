import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { customerService } from '../../../services/customer.service.js';
import { EMBED_COLORS, TIMEZONE } from '../../../config/constants.js';
import { formatDate } from '../../../utils/timezone.js';
import { formatDuration } from '../../../utils/duration.js';
import { formatErrorMessage } from '../../../utils/errors.js';

export const customerDetailCommand = {
  data: new SlashCommandBuilder()
    .setName('customer')
    .setDescription('Xem hồ sơ và thống kê của khách hàng')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Tên khách hàng hoặc ID').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused();
    const customers = await customerService.searchCustomers(focused, 15);
    await interaction.respond(
      customers.map((c) => ({
        name: `${c.name}${c.phone ? ` (${c.phone})` : ''} | ${c.totalBookings} lịch`,
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

    const nameOrId = interaction.options.getString('name', true);

    try {
      const customers = await customerService.searchCustomers(nameOrId, 1);
      if (customers.length === 0) {
        await interaction.reply({
          content: `❌ Không tìm thấy khách hàng: "${nameOrId}".`,
          ephemeral: true,
        });
        return;
      }

      const c = customers[0];
      const stats = await customerService.recalculateCustomerStats(c.id);

      const embed = new EmbedBuilder()
        .setTitle(`👤 HỒ SƠ KHÁCH HÀNG — ${stats.name}`)
        .setColor(EMBED_COLORS.PRIMARY)
        .addFields(
          {
            name: 'ℹ️ Thông tin cá nhân',
            value:
              `• Discord: ${stats.discordUserId ? `<@${stats.discordUserId}>` : '*Chưa liên kết*'}\n` +
              `• Số điện thoại: ${stats.phone || '*Chưa có*'}\n` +
              `• Ghi chú: ${stats.note || '*Không có*'}`,
            inline: false,
          },
          {
            name: '📊 Thống kê hoạt động',
            value:
              `• Tổng booking: **${stats.totalBookings}**\n` +
              `• Hoàn thành: **${stats.completedBookings}**\n` +
              `• Đã hủy: **${stats.cancelledBookings}**\n` +
              `• Tổng thời gian: **${formatDuration(stats.totalMinutes)}**`,
            inline: true,
          },
          {
            name: '📅 Lịch hẹn',
            value:
              `• Lần gần nhất: ${stats.lastBookingDate ? formatDate(stats.lastBookingDate) : '*Chưa có*'}\n` +
              `• Lịch tiếp theo: ${stats.nextBookingDate ? formatDate(stats.nextBookingDate) : '*Chưa có*'}`,
            inline: true,
          }
        )
        .setFooter({ text: `Customer ID: ${stats.id}` });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`cust_history:${stats.id}`)
          .setLabel('Lịch sử')
          .setEmoji('📜')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`cust_note:${stats.id}`)
          .setLabel('Sửa Note')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

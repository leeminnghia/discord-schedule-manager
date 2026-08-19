import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { bookingService } from '../../../services/booking.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { formatDate } from '../../../utils/timezone.js';
import { env } from '../../../config/env.js';

export const devseedCommand = {
  data: new SlashCommandBuilder()
    .setName('devseed')
    .setDescription('[DEV ONLY] Tạo dữ liệu mẫu nhanh để test bot'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (env.NODE_ENV === 'production') {
      await interaction.reply({
        content: '❌ Lệnh này chỉ khả dụng trong môi trường phát triển (development).',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const todayStr = formatDate(new Date());

    try {
      // Seed 3 sample bookings
      await bookingService.createBooking({
        guildId,
        customerName: 'Khách A',
        dateStr: todayStr,
        startTimeStr: '09:00',
        durationStr: '2h',
        note: 'Khách đặt qua Zalo',
        createdBy: interaction.user.id,
      });

      await bookingService.createBooking({
        guildId,
        customerName: 'Khách B',
        dateStr: todayStr,
        startTimeStr: '14:00',
        durationStr: '3h',
        note: 'Khách quen VIP',
        createdBy: interaction.user.id,
      });

      await bookingService.createBooking({
        guildId,
        customerName: 'Khách C',
        dateStr: todayStr,
        startTimeStr: '20:00',
        durationStr: '2h30m',
        note: 'Khách thanh toán trước',
        createdBy: interaction.user.id,
      });

      await dashboardService.refreshAll(guildId);

      await interaction.editReply({
        content: `✅ Đã tạo thành công 3 lịch mẫu cho ngày hôm nay (${todayStr}) và cập nhật Dashboard!`,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Lỗi khi seed dữ liệu: ${err.message}` });
    }
  },
};

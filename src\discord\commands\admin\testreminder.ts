import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { settingsService } from '../../../services/settings.service.js';
import { EMBED_COLORS } from '../../../config/constants.js';

export const testReminderCommand = {
  data: new SlashCommandBuilder()
    .setName('testreminder')
    .setDescription('Thử nghiệm gửi tin nhắn thông báo nhắc lịch vào kênh này'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    await settingsService.updateSettings(guildId, {
      channelRemindersId: interaction.channelId,
    });

    const embed = new EmbedBuilder()
      .setTitle('🔔 CÒN 30 PHÚT — Khách Hàng Test')
      .setColor(EMBED_COLORS.WARNING)
      .addFields(
        { name: '👤 Khách hàng', value: '**Khách Hàng Test**', inline: true },
        { name: '📅 Ngày', value: '19/08/2026', inline: true },
        { name: '🕐 Khung giờ', value: '`17:00 → 19:00`', inline: true },
        { name: '⏱️ Thời lượng', value: '2 giờ', inline: true },
        { name: '📝 Ghi chú', value: 'Đây là tin nhắn thông báo nhắc lịch mẫu', inline: false }
      )
      .setFooter({ text: 'Hệ thống tự động nhắc trước 30p, 10p và đúng giờ' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('remind_test_start')
        .setLabel('Bắt đầu làm')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('remind_test_snooze')
        .setLabel('Nhắc lại sau 5p')
        .setEmoji('⏰')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('remind_test_complete')
        .setLabel('Hoàn thành')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      content: `🔔 **THÔNG BÁO NHẮC LỊCH SẮP TỚI!** *(Đã liên kết kênh này để nhận tự động)*`,
      embeds: [embed],
      components: [row],
    });
  },
};

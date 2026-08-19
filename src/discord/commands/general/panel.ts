import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { settingsService } from '../../../services/settings.service.js';
import {
  buildLiveDashboardEmbed,
  buildLiveDashboardComponents,
} from '../../components/control-panel.js';

export const panelCommand = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Gửi bảng tổng quan quản lý lịch hẹn trực tiếp vào kênh này'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong kênh văn bản của server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;

    // Automatically set this channel as active command and reminder channel
    await settingsService.updateSettings(guildId, {
      channelCommandId: interaction.channelId,
      channelRemindersId: interaction.channelId,
    });

    const embed = await buildLiveDashboardEmbed(guildId);
    const components = await buildLiveDashboardComponents(guildId);

    // Reply with the comprehensive master dashboard and booking dropdown
    await interaction.reply({
      embeds: [embed],
      components,
    });
  },
};

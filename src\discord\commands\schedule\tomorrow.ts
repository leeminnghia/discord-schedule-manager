import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { buildTomorrowScheduleEmbed } from '../../components/dashboard-embed.js';

export const tomorrowCommand = {
  data: new SlashCommandBuilder()
    .setName('tomorrow')
    .setDescription('Xem chi tiết lịch hẹn và timeline làm việc của ngày mai'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const embed = await buildTomorrowScheduleEmbed(interaction.guild.id);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

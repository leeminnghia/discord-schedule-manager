import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { buildTodayScheduleEmbed } from '../../components/dashboard-embed.js';

export const todayCommand = {
  data: new SlashCommandBuilder()
    .setName('today')
    .setDescription('Xem lịch chi tiết và timeline làm việc của ngày hôm nay'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const embed = await buildTodayScheduleEmbed(interaction.guild.id, new Date());
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

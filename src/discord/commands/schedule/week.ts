import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { buildWeekScheduleEmbed, createWeekNavigationButtons } from '../../components/dashboard-embed.js';

export const weekCommand = {
  data: new SlashCommandBuilder()
    .setName('week')
    .setDescription('Xem tổng quan lịch làm việc trong tuần hiện tại'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const now = new Date();
    const embed = await buildWeekScheduleEmbed(interaction.guild.id, now);
    const buttons = createWeekNavigationButtons(now);

    await interaction.reply({ embeds: [embed], components: buttons });
  },
};

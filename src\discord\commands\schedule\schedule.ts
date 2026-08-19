import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { buildTodayScheduleEmbed } from '../../components/dashboard-embed.js';
import { settingsService } from '../../../services/settings.service.js';
import { parseDateStartOfDay } from '../../../utils/timezone.js';
import { getDateChoices } from '../../../utils/autocomplete.js';
import { formatErrorMessage } from '../../../utils/errors.js';

export const scheduleCommand = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Xem lịch chi tiết của một ngày bất kỳ')
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Ngày cần xem (chọn hoặc nhập DD/MM/YYYY)').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused();
    const choices = getDateChoices(focused);
    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const dateStr = interaction.options.getString('date', true);

    try {
      const settings = await settingsService.getSettings(interaction.guild.id);
      const targetDate = parseDateStartOfDay(dateStr, settings.timezone);
      const embed = await buildTodayScheduleEmbed(interaction.guild.id, targetDate);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

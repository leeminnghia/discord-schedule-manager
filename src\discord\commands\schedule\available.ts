import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { availabilityService } from '../../../services/availability.service.js';
import { settingsService } from '../../../services/settings.service.js';
import { parseDateStartOfDay } from '../../../utils/timezone.js';
import { getDateChoices } from '../../../utils/autocomplete.js';
import { formatErrorMessage } from '../../../utils/errors.js';

export const availableCommand = {
  data: new SlashCommandBuilder()
    .setName('available')
    .setDescription('Tạo nội dung các khung giờ trống dạng tin nhắn ngắn gọn để gửi cho khách')
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Ngày cần tạo (chọn hoặc nhập DD/MM/YYYY)').setRequired(false).setAutocomplete(true)
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

    const dateStr = interaction.options.getString('date');

    try {
      const settings = await settingsService.getSettings(interaction.guild.id);
      const targetDate = dateStr ? parseDateStartOfDay(dateStr, settings.timezone) : new Date();

      const text = await availabilityService.formatAvailableSlotsForClient(interaction.guild.id, targetDate);

      await interaction.reply({
        content: `\`\`\`text\n${text}\n\`\`\`\n*Bạn có thể bấm sao chép đoạn trên để gửi nhanh cho khách hàng.*`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

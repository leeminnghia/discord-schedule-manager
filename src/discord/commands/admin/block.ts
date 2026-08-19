import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { blockedTimeService } from '../../../services/blocked-time.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { auditService } from '../../../services/audit.service.js';
import { EMBED_COLORS, AUDIT_ACTIONS } from '../../../config/constants.js';
import { formatErrorMessage } from '../../../utils/errors.js';
import { getDateChoices, getTimeChoices } from '../../../utils/autocomplete.js';

export const blockCommand = {
  data: new SlashCommandBuilder()
    .setName('block')
    .setDescription('Khóa một khoảng thời gian cá nhân hoặc nghỉ ngơi để không nhận lịch')
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Ngày khóa (chọn hoặc nhập DD/MM/YYYY)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('start_time').setDescription('Giờ bắt đầu khóa (chọn hoặc nhập 12:00, 12h...)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('end_time').setDescription('Giờ kết thúc khóa (chọn hoặc nhập 14:00, 14h...)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Lý do khóa (ví dụ: Ăn trưa, Việc cá nhân)').setRequired(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'date') {
      const choices = getDateChoices(focused.value);
      await interaction.respond(choices);
      return;
    }

    if (focused.name === 'start_time' || focused.name === 'end_time') {
      const choices = getTimeChoices(focused.value);
      await interaction.respond(choices);
      return;
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const dateStr = interaction.options.getString('date', true);
    const startTimeStr = interaction.options.getString('start_time', true);
    const endTimeStr = interaction.options.getString('end_time', true);
    const reason = interaction.options.getString('reason', true);

    try {
      const block = await blockedTimeService.createBlock({
        guildId,
        dateStr,
        startTimeStr,
        endTimeStr,
        reason,
        createdBy: interaction.user.id,
      });

      await dashboardService.refreshAll(guildId);

      await auditService.logEvent({
        guildId,
        action: AUDIT_ACTIONS.TIME_BLOCK_CREATED,
        targetId: block.id,
        targetType: 'BLOCKED_TIME',
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: {
          date: dateStr,
          time: `${startTimeStr} → ${endTimeStr}`,
          reason,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('🔒 ĐÃ KHÓA THỜI GIAN CÁ NHÂN')
        .setColor(EMBED_COLORS.WARNING)
        .addFields(
          { name: '📅 Ngày', value: dateStr, inline: true },
          { name: '🕐 Khung giờ', value: `${startTimeStr} → ${endTimeStr}`, inline: true },
          { name: '📝 Lý do', value: reason, inline: false }
        )
        .setFooter({ text: `ID: ${block.id}` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

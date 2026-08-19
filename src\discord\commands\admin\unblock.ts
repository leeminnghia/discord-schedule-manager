import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { blockedTimeService } from '../../../services/blocked-time.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { auditService } from '../../../services/audit.service.js';
import { prisma } from '../../../database/prisma.js';
import { EMBED_COLORS, AUDIT_ACTIONS } from '../../../config/constants.js';
import { formatErrorMessage } from '../../../utils/errors.js';
import { formatTime, formatDate } from '../../../utils/timezone.js';

export const unblockCommand = {
  data: new SlashCommandBuilder()
    .setName('unblock')
    .setDescription('Mở khóa một khoảng thời gian đã block trước đó')
    .addStringOption((opt) =>
      opt.setName('block_id').setDescription('Chọn khoảng thời gian muốn mở khóa').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;
    const now = new Date();
    const blocks = await prisma.blockedTime.findMany({
      where: {
        guildId: interaction.guild.id,
        endAt: { gte: now },
      },
      orderBy: { startAt: 'asc' },
      take: 25,
    });

    const choices = blocks.map((b) => ({
      name: `${formatDate(b.startAt)} ${formatTime(b.startAt)} - ${formatTime(b.endAt)} | ${b.reason}`,
      value: b.id,
    }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const blockId = interaction.options.getString('block_id', true);

    try {
      const removed = await blockedTimeService.removeBlock(blockId, guildId);
      await dashboardService.refreshAll(guildId);

      await auditService.logEvent({
        guildId,
        action: AUDIT_ACTIONS.TIME_BLOCK_REMOVED,
        targetId: removed.id,
        targetType: 'BLOCKED_TIME',
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        details: {
          reason: removed.reason,
          startAt: removed.startAt,
          endAt: removed.endAt,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle('🔓 ĐÃ MỞ KHÓA THỜI GIAN')
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(
          `Khoảng thời gian **${formatDate(removed.startAt)} ${formatTime(removed.startAt)} → ${formatTime(
            removed.endAt
          )}** ("${removed.reason}") đã được mở lại để nhận lịch.`
        );

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

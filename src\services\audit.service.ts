import { prisma } from '../database/prisma.js';
import { settingsService } from './settings.service.js';
import { discordClient } from '../discord/client.js';
import { EmbedBuilder, TextChannel, ColorResolvable } from 'discord.js';
import { EMBED_COLORS, TIMEZONE } from '../config/constants.js';
import { formatFullDateTime } from '../utils/timezone.js';
import { logger } from '../utils/logger.js';

export interface LogAuditEventInput {
  guildId: string;
  action: string;
  targetId?: string;
  targetType: string;
  executorId: string;
  executorTag: string;
  details: Record<string, any>;
}

export class AuditService {
  /**
   * Logs an audit event to DB and posts an embed in the bot-log channel if configured.
   */
  async logEvent(input: LogAuditEventInput): Promise<void> {
    try {
      const detailsJson = JSON.stringify(input.details);

      // Save to database
      await prisma.auditLog.create({
        data: {
          guildId: input.guildId,
          action: input.action,
          targetId: input.targetId,
          targetType: input.targetType,
          executorId: input.executorId,
          executorTag: input.executorTag,
          detailsJson,
        },
      });

      // Try sending to Discord audit log channel
      const settings = await settingsService.getSettings(input.guildId);
      if (!settings.channelLogId || !discordClient.isReady()) {
        return;
      }

      const channel = await discordClient.channels.fetch(settings.channelLogId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        return;
      }

      const now = new Date();
      const formattedTime = formatFullDateTime(now, settings.timezone || TIMEZONE);

      let actionTitle = `📋 ${input.action}`;
      let embedColor: ColorResolvable = EMBED_COLORS.INFO;

      if (input.action.includes('CREATED')) {
        actionTitle = `🟢 ${input.action}`;
        embedColor = EMBED_COLORS.SUCCESS;
      } else if (input.action.includes('CANCELLED') || input.action.includes('REMOVED')) {
        actionTitle = `❌ ${input.action}`;
        embedColor = EMBED_COLORS.DANGER;
      } else if (input.action.includes('RESCHEDULED') || input.action.includes('UPDATED')) {
        actionTitle = `🔄 ${input.action}`;
        embedColor = EMBED_COLORS.WARNING;
      } else if (input.action.includes('COMPLETED')) {
        actionTitle = `✅ ${input.action}`;
        embedColor = EMBED_COLORS.SUCCESS;
      }

      const embed = new EmbedBuilder()
        .setTitle(actionTitle)
        .setColor(embedColor)
        .addFields(
          { name: 'Người thực hiện', value: `<@${input.executorId}> (${input.executorTag})`, inline: true },
          { name: 'Thời gian', value: formattedTime, inline: true }
        )
        .setFooter({ text: `Target: ${input.targetType} ${input.targetId ? `(${input.targetId})` : ''}` })
        .setTimestamp();

      // Add details fields
      for (const [key, value] of Object.entries(input.details)) {
        if (value !== undefined && value !== null) {
          const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          embed.addFields({ name: key, value: valStr.slice(0, 1024), inline: false });
        }
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error({ error }, 'Failed to log audit event to Discord channel');
    }
  }
}

export const auditService = new AuditService();

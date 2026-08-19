import { reminderService, DueReminderWithDetails } from '../services/reminder.service.js';
import { settingsService } from '../services/settings.service.js';
import { scheduleService } from '../services/schedule.service.js';
import { availabilityService } from '../services/availability.service.js';
import { discordClient } from '../discord/client.js';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ColorResolvable,
  ChannelType,
} from 'discord.js';
import { EMBED_COLORS, TIMEZONE } from '../config/constants.js';
import { formatTime, formatDate } from '../utils/timezone.js';
import { formatDuration } from '../utils/duration.js';
import { formatTimeRange } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  start(intervalMs: number = 30000): void {
    if (this.timer) return;

    logger.info('⏰ Reminder scheduler started (tick interval: 30s).');
    this.timer = setInterval(() => this.tick(), intervalMs);
    // Initial immediate tick
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Reminder scheduler stopped.');
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning || !discordClient.isReady()) return;
    this.isRunning = true;

    try {
      const dueReminders = await reminderService.getDueReminders();
      for (const reminder of dueReminders) {
        await this.dispatchReminder(reminder);
      }
    } catch (error) {
      logger.error({ error }, 'Error running reminder scheduler tick');
    } finally {
      this.isRunning = false;
    }
  }

  private async dispatchReminder(reminder: DueReminderWithDetails): Promise<void> {
    const { booking } = reminder;
    const settings = await settingsService.getSettings(reminder.guildId);
    const tz = settings.timezone || TIMEZONE;

    // Find the best channel to send reminder
    let targetChannel: TextChannel | null = null;

    if (settings.channelRemindersId) {
      const ch = await discordClient.channels.fetch(settings.channelRemindersId).catch(() => null);
      if (ch && ch instanceof TextChannel) {
        targetChannel = ch;
      }
    }

    // Smart fallback if channelRemindersId not configured
    if (!targetChannel) {
      const guild = await discordClient.guilds.fetch(reminder.guildId).catch(() => null);
      if (guild) {
        const channels = await guild.channels.fetch().catch(() => null);
        if (channels) {
          const matchingChannel = channels.find(
            (c) =>
              c &&
              c.type === ChannelType.GuildText &&
              (c.name.includes('nhac-lich') ||
                c.name.includes('booking') ||
                c.name.includes('đặt-lịch') ||
                c.name.includes('chung') ||
                c.name.includes('general'))
          );
          if (matchingChannel && matchingChannel instanceof TextChannel) {
            targetChannel = matchingChannel;
          } else if (guild.systemChannel) {
            targetChannel = guild.systemChannel;
          }
        }
      }
    }

    if (!targetChannel) {
      logger.warn(`No suitable text channel found in guild ${reminder.guildId} to send reminder.`);
      await reminderService.markAsSent(reminder.id);
      return;
    }

    const offset = reminder.offsetMinutes;
    const timeRange = formatTimeRange(booking.startAt, booking.endAt, tz);
    const durationText = formatDuration(booking.durationMinutes);
    const dateStr = formatDate(booking.startAt, tz);

    let title = '';
    let color: ColorResolvable = EMBED_COLORS.INFO;

    if (offset === 30) {
      title = `🔔 CÒN 30 PHÚT — ${booking.customerName}`;
      color = EMBED_COLORS.WARNING;
    } else if (offset === 10) {
      title = `⚠️ CÒN 10 PHÚT — ${booking.customerName}`;
      color = EMBED_COLORS.WARNING;
    } else if (offset === 0) {
      title = `🔴 ĐÃ ĐẾN GIỜ LỊCH HẸN — ${booking.customerName}`;
      color = EMBED_COLORS.DANGER;
    } else if (offset < 0) {
      title = `⏰ NHẮC LẠI (${Math.abs(offset)} PHÚT) — ${booking.customerName}`;
      color = EMBED_COLORS.INFO;
    } else {
      title = `🔔 CÒN ${offset} PHÚT — ${booking.customerName}`;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .addFields(
        {
          name: '👤 Khách hàng',
          value: `**${booking.customerName}**${booking.discordUserId ? ` (<@${booking.discordUserId}>)` : ''}`,
          inline: true,
        },
        { name: '📅 Ngày', value: dateStr, inline: true },
        { name: '🕐 Khung giờ', value: `\`${timeRange}\``, inline: true },
        { name: '⏱️ Thời lượng', value: durationText, inline: true }
      );

    if (booking.note) {
      embed.addFields({ name: '📝 Ghi chú', value: booking.note, inline: false });
    }

    embed.setFooter({
      text: `Mã: ${booking.bookingCode} • ⏱️ Tin nhắn này sẽ tự động biến mất sau 15 phút`,
    });

    // Action Buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`remind_start:${booking.bookingCode}`)
        .setLabel('Bắt đầu làm')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`remind_snooze:${booking.id}`)
        .setLabel('Nhắc lại sau 5p')
        .setEmoji('⏰')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`remind_complete:${booking.bookingCode}`)
        .setLabel('Hoàn thành')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const sentMessage = await targetChannel.send({
        content: `🔔 **THÔNG BÁO NHẮC LỊCH SẮP TỚI!**`,
        embeds: [embed],
        components: [row],
      });
      logger.info(
        `✅ Sent reminder (${offset}m) for booking ${booking.bookingCode} to #${targetChannel.name}`
      );

      // Auto delete reminder message after 15 minutes (15 * 60 * 1000 ms)
      setTimeout(async () => {
        try {
          await sentMessage.delete().catch(() => {});
          logger.info(`🧹 Auto-deleted reminder message for ${booking.bookingCode} after 15 minutes.`);
        } catch (delErr) {
          // Message might already be deleted manually
        }
      }, 15 * 60 * 1000);
    } catch (err: any) {
      logger.error({ err }, `Failed to send reminder message to channel #${targetChannel.name}`);
    }

    await reminderService.markAsSent(reminder.id);
  }
}

export const reminderScheduler = new ReminderScheduler();

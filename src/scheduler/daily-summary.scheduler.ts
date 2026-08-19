import { prisma } from '../database/prisma.js';
import { settingsService } from '../services/settings.service.js';
import { scheduleService } from '../services/schedule.service.js';
import { availabilityService } from '../services/availability.service.js';
import { discordClient } from '../discord/client.js';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { EMBED_COLORS } from '../config/constants.js';
import { formatTime, formatDate, addDaysTz } from '../utils/timezone.js';
import { formatDuration } from '../utils/duration.js';
import { logger } from '../utils/logger.js';

export class DailySummaryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastSummarySentDate: string = '';
  private lastTomorrowSentDate: string = '';

  start(intervalMs: number = 60000): void {
    if (this.timer) return;

    logger.info('📊 Daily summary scheduler started.');
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Daily summary scheduler stopped.');
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning || !discordClient.isReady()) return;
    this.isRunning = true;

    try {
      const allSettings = await prisma.guildSettings.findMany();
      const now = new Date();

      for (const settings of allSettings) {
        const tz = settings.timezone;
        const nowTimeStr = formatTime(now, tz);
        const nowDateStr = formatDate(now, tz);

        // Check Daily Summary
        if (nowTimeStr === settings.dailySummaryTime && this.lastSummarySentDate !== nowDateStr) {
          this.lastSummarySentDate = nowDateStr;
          await this.sendDailySummary(settings.guildId);
        }

        // Check Tomorrow Summary
        if (nowTimeStr === settings.tomorrowSummaryTime && this.lastTomorrowSentDate !== nowDateStr) {
          this.lastTomorrowSentDate = nowDateStr;
          await this.sendTomorrowSummary(settings.guildId);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error running daily summary tick');
    } finally {
      this.isRunning = false;
    }
  }

  private async sendDailySummary(guildId: string): Promise<void> {
    try {
      const settings = await settingsService.getSettings(guildId);
      if (!settings.channelOverviewId) return;

      const channel = await discordClient.channels.fetch(settings.channelOverviewId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const tz = settings.timezone;
      const now = new Date();
      const stats = await scheduleService.getStats(guildId, 'today');
      const tomorrow = addDaysTz(now, 1, tz);
      const tomorrowSchedule = await scheduleService.getDaySchedule(guildId, tomorrow);

      const totalHours = (stats.totalBookedMinutes / 60).toFixed(1).replace('.0', '');
      const tomorrowHours = (tomorrowSchedule.totalBookedMinutes / 60).toFixed(1).replace('.0', '');

      const embed = new EmbedBuilder()
        .setTitle(`📊 TỔNG KẾT NGÀY ${formatDate(now, tz)}`)
        .setColor(EMBED_COLORS.PRIMARY)
        .addFields(
          {
            name: '📋 Kết quả hôm nay',
            value:
              `• Tổng lịch: **${stats.totalBookings}**\n` +
              `• Hoàn thành: **${stats.completedBookings}**\n` +
              `• Đã hủy: **${stats.cancelledBookings}**\n` +
              `• Tổng giờ làm: **${totalHours}H**\n` +
              `• Số khách: **${stats.topCustomers.length}**`,
            inline: false,
          },
          {
            name: `🟢 Lịch ngày mai (${formatDate(tomorrow, tz)})`,
            value: `• **${tomorrowSchedule.totalBookings}** lịch hẹn\n• **${tomorrowHours}H** đã đặt trước`,
            inline: false,
          }
        )
        .setFooter({ text: 'Daily Summary Scheduler' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error({ error, guildId }, 'Failed to send daily summary');
    }
  }

  private async sendTomorrowSummary(guildId: string): Promise<void> {
    try {
      const settings = await settingsService.getSettings(guildId);
      if (!settings.channelTodayId) return;

      const channel = await discordClient.channels.fetch(settings.channelTodayId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const tz = settings.timezone;
      const now = new Date();
      const tomorrow = addDaysTz(now, 1, tz);
      const tomorrowSchedule = await scheduleService.getDaySchedule(guildId, tomorrow);
      const freeSlots = await availabilityService.getFreeSlotsForDay(guildId, tomorrow);

      const embed = new EmbedBuilder()
        .setTitle(`🗓️ LỊCH NGÀY MAI — ${formatDate(tomorrow, tz)}`)
        .setColor(EMBED_COLORS.INFO)
        .setFooter({ text: 'Tomorrow Schedule Preview' });

      if (tomorrowSchedule.items.filter((i) => i.type === 'BOOKING').length === 0) {
        embed.setDescription('Ngày mai hiện chưa có lịch đặt nào.');
      } else {
        const lines = tomorrowSchedule.items
          .filter((i) => i.type === 'BOOKING')
          .map((i) => `• \`${formatTime(i.start, tz)} → ${formatTime(i.end, tz)}\` **${i.title}**`)
          .join('\n');

        const totalHours = (tomorrowSchedule.totalBookedMinutes / 60).toFixed(1).replace('.0', '');
        embed.addFields({
          name: `Danh sách lịch (${tomorrowSchedule.totalBookings} lịch, ${totalHours}H)`,
          value: lines,
          inline: false,
        });
      }

      if (freeSlots.length > 0) {
        const freeText = freeSlots
          .map((s) => `🟢 ${formatTime(s.start, tz)} → ${formatTime(s.end, tz)} (${formatDuration(s.durationMinutes)})`)
          .join('\n');
        embed.addFields({ name: '🟢 Khung giờ còn trống', value: freeText, inline: false });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error({ error, guildId }, 'Failed to send tomorrow summary');
    }
  }
}

export const dailySummaryScheduler = new DailySummaryScheduler();

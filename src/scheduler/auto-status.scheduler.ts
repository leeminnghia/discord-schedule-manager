import { prisma } from '../database/prisma.js';
import { BOOKING_STATUS, EMBED_COLORS } from '../config/constants.js';
import { dashboardService } from '../services/dashboard.service.js';
import { settingsService } from '../services/settings.service.js';
import { discordClient } from '../discord/client.js';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { logger } from '../utils/logger.js';
import { formatTime } from '../utils/timezone.js';

export class AutoStatusScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private notifiedEndingBookings = new Set<string>();

  start(intervalMs: number = 60000): void {
    if (this.timer) return;

    logger.info('🔄 Auto-status scheduler started (tick interval: 60s).');
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Auto-status scheduler stopped.');
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning || !discordClient.isReady()) return;
    this.isRunning = true;

    try {
      const now = new Date();

      // 1. CONFIRMED -> IN_PROGRESS when startAt <= now < endAt
      const startingBookings = await prisma.booking.findMany({
        where: {
          status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PAID] },
          startAt: { lte: now },
          endAt: { gt: now },
        },
      });

      for (const b of startingBookings) {
        await prisma.booking.update({
          where: { id: b.id },
          data: { status: BOOKING_STATUS.IN_PROGRESS },
        });
        logger.info(`[Auto-Status] Booking ${b.bookingCode} transitioned to IN_PROGRESS.`);
        await dashboardService.refreshOverview(b.guildId);
      }

      // 2. Ending notification prompt when now >= endAt and status = IN_PROGRESS
      const endingBookings = await prisma.booking.findMany({
        where: {
          status: BOOKING_STATUS.IN_PROGRESS,
          endAt: { lte: now },
        },
      });

      for (const b of endingBookings) {
        if (!this.notifiedEndingBookings.has(b.id)) {
          this.notifiedEndingBookings.add(b.id);
          await this.notifyBookingEnded(b);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error in auto-status scheduler tick');
    } finally {
      this.isRunning = false;
    }
  }

  private async notifyBookingEnded(booking: any): Promise<void> {
    try {
      const settings = await settingsService.getSettings(booking.guildId);
      if (!settings.channelRemindersId) return;

      const channel = await discordClient.channels.fetch(settings.channelRemindersId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const embed = new EmbedBuilder()
        .setTitle('⏰ LỊCH ĐÃ ĐẾN GIỜ KẾT THÚC')
        .setColor(EMBED_COLORS.WARNING)
        .setDescription(
          `Lịch hẹn của **${booking.customerName}** (\`${booking.bookingCode}\`) đã đến giờ kết thúc (${formatTime(
            booking.endAt,
            settings.timezone
          )}).\n\nVui lòng xác nhận trạng thái hoàn thành hoặc gia hạn thêm giờ:`
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`book_complete:${booking.bookingCode}`)
          .setLabel('Hoàn thành')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`book_extend:${booking.bookingCode}`)
          .setLabel('Gia hạn')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Secondary)
      );

      await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error({ error, bookingId: booking.id }, 'Failed to send booking ended notification');
    }
  }
}

export const autoStatusScheduler = new AutoStatusScheduler();

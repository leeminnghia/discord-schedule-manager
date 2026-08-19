import { discordClient } from '../discord/client.js';
import { settingsService } from './settings.service.js';
import {
  buildOverviewEmbed,
  buildTodayScheduleEmbed,
  buildWeekScheduleEmbed,
  createWeekNavigationButtons,
  buildFreeSlotsEmbed,
} from '../discord/components/dashboard-embed.js';
import {
  buildControlPanelEmbed,
  buildControlPanelButtons,
} from '../discord/components/control-panel.js';
import { TextChannel, Message } from 'discord.js';
import { logger } from '../utils/logger.js';

export class DashboardService {
  /**
   * Refreshes all persistent dashboard messages in a guild.
   */
  async refreshAll(guildId: string): Promise<void> {
    try {
      await Promise.allSettled([
        this.refreshOverview(guildId),
        this.refreshToday(guildId),
        this.refreshWeek(guildId),
        this.refreshFreeSlots(guildId),
        this.refreshControlPanel(guildId),
      ]);
    } catch (error) {
      logger.error({ error, guildId }, 'Error refreshing all dashboard panels');
    }
  }

  /**
   * Helper to safely edit or recreate persistent message in a text channel.
   */
  private async updateOrCreatePersistentMessage(
    channelId: string | null | undefined,
    currentMsgId: string | null | undefined,
    embedBuilder: () => Promise<any> | any,
    components: any[] = []
  ): Promise<string | null> {
    if (!channelId || !discordClient.isReady()) return null;

    try {
      const channel = await discordClient.channels.fetch(channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return null;

      const embed = await embedBuilder();

      if (currentMsgId) {
        try {
          const existingMsg = await channel.messages.fetch(currentMsgId).catch(() => null);
          if (existingMsg) {
            await existingMsg.edit({ embeds: [embed], components });
            return existingMsg.id;
          }
        } catch {
          // Message might have been deleted, create new below
        }
      }

      // Recreate message
      const newMsg = await channel.send({ embeds: [embed], components });
      return newMsg.id;
    } catch (error) {
      logger.error({ error, channelId }, 'Failed to update persistent message');
      return null;
    }
  }

  /**
   * Refreshes Overview Dashboard message (📊・tong-quan)
   */
  async refreshOverview(guildId: string): Promise<void> {
    const settings = await settingsService.getSettings(guildId);
    const newMsgId = await this.updateOrCreatePersistentMessage(
      settings.channelOverviewId,
      settings.msgOverviewId,
      () => buildOverviewEmbed(guildId)
    );

    if (newMsgId && newMsgId !== settings.msgOverviewId) {
      await settingsService.updateSettings(guildId, { msgOverviewId: newMsgId });
    }
  }

  /**
   * Refreshes Today Schedule message (📅・lich-hom-nay)
   */
  async refreshToday(guildId: string): Promise<void> {
    const settings = await settingsService.getSettings(guildId);
    const newMsgId = await this.updateOrCreatePersistentMessage(
      settings.channelTodayId,
      settings.msgTodayId,
      () => buildTodayScheduleEmbed(guildId, new Date())
    );

    if (newMsgId && newMsgId !== settings.msgTodayId) {
      await settingsService.updateSettings(guildId, { msgTodayId: newMsgId });
    }
  }

  /**
   * Refreshes Week Schedule message (🗓️・lich-tuan)
   */
  async refreshWeek(guildId: string, anchorDate: Date = new Date()): Promise<void> {
    const settings = await settingsService.getSettings(guildId);
    const buttons = createWeekNavigationButtons(anchorDate);

    const newMsgId = await this.updateOrCreatePersistentMessage(
      settings.channelWeekId,
      settings.msgWeekId,
      () => buildWeekScheduleEmbed(guildId, anchorDate),
      buttons
    );

    if (newMsgId && newMsgId !== settings.msgWeekId) {
      await settingsService.updateSettings(guildId, { msgWeekId: newMsgId });
    }
  }

  /**
   * Refreshes Free Slots message (🟢・gio-con-trong)
   */
  async refreshFreeSlots(guildId: string): Promise<void> {
    const settings = await settingsService.getSettings(guildId);
    const newMsgId = await this.updateOrCreatePersistentMessage(
      settings.channelFreeSlotsId,
      settings.msgFreeSlotsId,
      () => buildFreeSlotsEmbed(guildId, new Date())
    );

    if (newMsgId && newMsgId !== settings.msgFreeSlotsId) {
      await settingsService.updateSettings(guildId, { msgFreeSlotsId: newMsgId });
    }
  }

  /**
   * Refreshes Control Panel message (🤖・bot-command)
   */
  async refreshControlPanel(guildId: string): Promise<void> {
    const settings = await settingsService.getSettings(guildId);
    const components = await buildControlPanelButtons(guildId);
    const newMsgId = await this.updateOrCreatePersistentMessage(
      settings.channelCommandId,
      settings.msgControlPanelId,
      () => buildControlPanelEmbed(guildId),
      components
    );

    if (newMsgId && newMsgId !== settings.msgControlPanelId) {
      await settingsService.updateSettings(guildId, { msgControlPanelId: newMsgId });
    }
  }
}

export const dashboardService = new DashboardService();

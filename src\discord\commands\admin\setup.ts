import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  Guild,
  CategoryChannel,
  TextChannel,
  PermissionsBitField,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { settingsService } from '../../../services/settings.service.js';
import { dashboardService } from '../../../services/dashboard.service.js';
import { CATEGORIES, CHANNELS, EMBED_COLORS } from '../../../config/constants.js';
import { logger } from '../../../utils/logger.js';

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Tự động khởi tạo và cấu hình các danh mục, kênh và dashboard cho server')
    .addBooleanOption((option) =>
      option
        .setName('repair')
        .setDescription('Sửa chữa và khôi phục các kênh/message dashboard bị thiếu')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh này chỉ có thể dùng trong server Discord.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const isRepair = interaction.options.getBoolean('repair') || false;

    try {
      // 1. Fetch or create Categories
      const catDashboard = await getOrCreateCategory(guild, CATEGORIES.DASHBOARD);
      const catManagement = await getOrCreateCategory(guild, CATEGORIES.MANAGEMENT);
      const catSystem = await getOrCreateCategory(guild, CATEGORIES.SYSTEM);

      // 2. Fetch or create Channels
      const chOverview = await getOrCreateTextChannel(guild, CHANNELS.OVERVIEW, catDashboard.id);
      const chToday = await getOrCreateTextChannel(guild, CHANNELS.TODAY, catDashboard.id);
      const chWeek = await getOrCreateTextChannel(guild, CHANNELS.WEEK, catDashboard.id);
      const chFreeSlots = await getOrCreateTextChannel(guild, CHANNELS.FREE_SLOTS, catDashboard.id);
      const chReminders = await getOrCreateTextChannel(guild, CHANNELS.REMINDERS, catDashboard.id);

      const chCustomers = await getOrCreateTextChannel(guild, CHANNELS.CUSTOMERS, catManagement.id);
      const chCompleted = await getOrCreateTextChannel(guild, CHANNELS.COMPLETED, catManagement.id);
      const chCancelled = await getOrCreateTextChannel(guild, CHANNELS.CANCELLED, catManagement.id);
      const chNotes = await getOrCreateTextChannel(guild, CHANNELS.NOTES, catManagement.id);

      const chCommand = await getOrCreateTextChannel(guild, CHANNELS.COMMAND, catSystem.id);
      const chLog = await getOrCreateTextChannel(guild, CHANNELS.LOG, catSystem.id);
      const chSettings = await getOrCreateTextChannel(guild, CHANNELS.SETTINGS, catSystem.id);

      // 3. Save IDs to GuildSettings
      await settingsService.updateSettings(guild.id, {
        categoryIdDashboard: catDashboard.id,
        categoryIdManagement: catManagement.id,
        categoryIdSystem: catSystem.id,

        channelOverviewId: chOverview.id,
        channelTodayId: chToday.id,
        channelWeekId: chWeek.id,
        channelFreeSlotsId: chFreeSlots.id,
        channelRemindersId: chReminders.id,

        channelCustomersId: chCustomers.id,
        channelCompletedId: chCompleted.id,
        channelCancelledId: chCancelled.id,
        channelNotesId: chNotes.id,

        channelCommandId: chCommand.id,
        channelLogId: chLog.id,
        channelSettingsId: chSettings.id,
      });

      // 4. Trigger persistent dashboard rendering
      await dashboardService.refreshAll(guild.id);

      await interaction.editReply({
        content:
          `✅ **CẤU HÌNH SERVER THÀNH CÔNG!**\n\n` +
          `Đã kiểm tra và đồng bộ hoàn tất các Category và Channel:\n` +
          `• 📌 **Dashboard:** <#${chOverview.id}>, <#${chToday.id}>, <#${chWeek.id}>, <#${chFreeSlots.id}>, <#${chReminders.id}>\n` +
          `• 📂 **Quản lý:** <#${chCustomers.id}>, <#${chCompleted.id}>, <#${chCancelled.id}>, <#${chNotes.id}>\n` +
          `• ⚙️ **Hệ thống:** <#${chCommand.id}>, <#${chLog.id}>, <#${chSettings.id}>\n\n` +
          `Bảng điều khiển và các khung dashboard đã được khởi tạo và sẵn sàng sử dụng! 🚀`,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error in /setup command');
      await interaction.editReply({
        content: `❌ Quá trình cài đặt thất bại: ${error.message || 'Lỗi không xác định'}. Vui lòng kiểm tra quyền "Manage Channels" của Bot.`,
      });
    }
  },
};

async function getOrCreateCategory(guild: Guild, name: string): Promise<CategoryChannel> {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase()
  ) as CategoryChannel | undefined;

  if (existing) return existing;

  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
  });
}

async function getOrCreateTextChannel(
  guild: Guild,
  name: string,
  parentId?: string
): Promise<TextChannel> {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === name.toLowerCase()
  ) as TextChannel | undefined;

  if (existing) {
    if (parentId && existing.parentId !== parentId) {
      await existing.setParent(parentId).catch(() => {});
    }
    return existing;
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parentId,
  });
}

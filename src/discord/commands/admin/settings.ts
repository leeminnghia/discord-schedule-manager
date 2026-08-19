import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { settingsService } from '../../../services/settings.service.js';
import { EMBED_COLORS } from '../../../config/constants.js';
import { WeekWorkingHours } from '../../../types/schedule.types.js';

export const settingsCommand = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Cấu hình hệ thống đặt lịch và hoạt động bot')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('Xem toàn bộ cấu hình hiện tại của hệ thống')
    )
    .addSubcommand((sub) =>
      sub
        .setName('buffer')
        .setDescription('Thiết lập khoảng đệm tối thiểu giữa hai lịch hẹn (phút)')
        .addIntegerOption((opt) =>
          opt
            .setName('minutes')
            .setDescription('Số phút đệm (ví dụ: 0, 5, 10, 15, 30)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(120)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('working-hours')
        .setDescription('Thiết lập khung giờ làm việc cho các ngày trong tuần')
        .addStringOption((opt) =>
          opt
            .setName('day')
            .setDescription('Ngày áp dụng')
            .setRequired(true)
            .addChoices(
              { name: 'Tất cả các ngày (T2 - CN)', value: 'all' },
              { name: 'Thứ Hai (Monday)', value: 'mon' },
              { name: 'Thứ Ba (Tuesday)', value: 'tue' },
              { name: 'Thứ Tư (Wednesday)', value: 'wed' },
              { name: 'Thứ Năm (Thursday)', value: 'thu' },
              { name: 'Thứ Sáu (Friday)', value: 'fri' },
              { name: 'Thứ Bảy (Saturday)', value: 'sat' },
              { name: 'Chủ Nhật (Sunday)', value: 'sun' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('start').setDescription('Giờ bắt đầu làm việc (HH:mm, ví dụ: 08:00)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('end').setDescription('Giờ kết thúc làm việc (HH:mm, ví dụ: 23:00)').setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật hoặc tắt nhận lịch ngày này').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reminder')
        .setDescription('Cấu hình mốc thời gian nhắc lịch trước khi bắt đầu')
        .addStringOption((opt) =>
          opt
            .setName('offsets')
            .setDescription('Các mốc phút cách nhau bởi dấu phẩy (ví dụ: 30,10,0)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('daily-summary')
        .setDescription('Cấu hình giờ tự động gửi tổng kết cuối ngày')
        .addStringOption((opt) =>
          opt.setName('time').setDescription('Giờ gửi (HH:mm, ví dụ: 23:00)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('timezone')
        .setDescription('Cấu hình Timezone mặc định')
        .addStringOption((opt) =>
          opt.setName('tz').setDescription('Tên Timezone (mặc định: Asia/Ho_Chi_Minh)').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    assertOwnerOrAdmin(interaction);

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Lệnh chỉ khả dụng trong server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();
    const settings = await settingsService.getSettings(guildId);

    if (subcommand === 'view') {
      const workingHours = settingsService.parseWorkingHours(settings);
      const whLines = Object.entries(workingHours)
        .map(([day, cfg]) => {
          const dayName =
            day === 'mon'
              ? 'T2'
              : day === 'tue'
              ? 'T3'
              : day === 'wed'
              ? 'T4'
              : day === 'thu'
              ? 'T5'
              : day === 'fri'
              ? 'T6'
              : day === 'sat'
              ? 'T7'
              : 'CN';
          return `• **${dayName}:** ${cfg.enabled ? `${cfg.start} → ${cfg.end}` : '❌ *Nghỉ*'}`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('⚙️ CẤU HÌNH HỆ THỐNG BOOKING')
        .setColor(EMBED_COLORS.PRIMARY)
        .addFields(
          { name: '🌐 Múi giờ', value: `\`${settings.timezone}\``, inline: true },
          { name: '⏳ Buffer giữa 2 khách', value: `\`${settings.minimumBufferMinutes} phút\``, inline: true },
          { name: '🔔 Mốc nhắc lịch', value: `\`${settings.reminderOffsetsMinutes} phút trước\``, inline: true },
          { name: '📊 Giờ gửi Daily Summary', value: `\`${settings.dailySummaryTime}\``, inline: true },
          { name: '🗓️ Giờ gửi Tomorrow Preview', value: `\`${settings.tomorrowSummaryTime}\``, inline: true },
          { name: '⚠️ Cho phép trùng lịch (Overbooking)', value: settings.allowOverbooking ? '🟢 Bật' : '🔴 Tắt', inline: true },
          { name: '⏰ Giờ làm việc hàng tuần', value: whLines, inline: false }
        )
        .setFooter({ text: 'Dùng /settings <subcommand> để chỉnh sửa' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === 'buffer') {
      const minutes = interaction.options.getInteger('minutes', true);
      await settingsService.updateSettings(guildId, { minimumBufferMinutes: minutes });
      await interaction.reply({
        content: `✅ Đã cập nhật khoảng đệm giữa 2 khách: **${minutes} phút**.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'working-hours') {
      const day = interaction.options.getString('day', true);
      const start = interaction.options.getString('start', true);
      const end = interaction.options.getString('end', true);
      const enabled = interaction.options.getBoolean('enabled') ?? true;

      const currentWh = settingsService.parseWorkingHours(settings);
      if (day === 'all') {
        for (const key of Object.keys(currentWh)) {
          (currentWh as any)[key] = { start, end, enabled };
        }
      } else {
        (currentWh as any)[day] = { start, end, enabled };
      }

      await settingsService.updateSettings(guildId, {
        workingHoursJson: JSON.stringify(currentWh),
      });

      await interaction.reply({
        content: `✅ Đã cập nhật giờ làm việc cho **${day.toUpperCase()}**: **${start} → ${end}** (${enabled ? 'Bật' : 'Nghỉ'}).`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'reminder') {
      const offsets = interaction.options.getString('offsets', true);
      await settingsService.updateSettings(guildId, { reminderOffsetsMinutes: offsets });
      await interaction.reply({
        content: `✅ Đã cập nhật các mốc nhắc lịch: **${offsets} phút**.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'daily-summary') {
      const time = interaction.options.getString('time', true);
      await settingsService.updateSettings(guildId, { dailySummaryTime: time });
      await interaction.reply({
        content: `✅ Đã cập nhật giờ gửi tổng kết ngày: **${time}**.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'timezone') {
      const tz = interaction.options.getString('tz', true);
      await settingsService.updateSettings(guildId, { timezone: tz });
      await interaction.reply({
        content: `✅ Đã cập nhật Timezone hệ thống: **${tz}**.`,
        ephemeral: true,
      });
      return;
    }
  },
};

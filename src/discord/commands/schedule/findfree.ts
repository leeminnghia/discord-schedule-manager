import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { assertOwnerOrAdmin } from '../../permissions.js';
import { availabilityService } from '../../../services/availability.service.js';
import { settingsService } from '../../../services/settings.service.js';
import { parseDuration, formatDuration } from '../../../utils/duration.js';
import { parseDateStartOfDay, formatDate, formatTime } from '../../../utils/timezone.js';
import { formatTimeRange } from '../../../utils/formatters.js';
import { getDateChoices, getDurationChoices } from '../../../utils/autocomplete.js';
import { EMBED_COLORS } from '../../../config/constants.js';
import { formatErrorMessage } from '../../../utils/errors.js';

export const findFreeCommand = {
  data: new SlashCommandBuilder()
    .setName('findfree')
    .setDescription('Tìm các khung giờ trống liên tục có độ dài tối thiểu theo yêu cầu')
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('Thời lượng tối thiểu (chọn hoặc nhập 3h, 2h, 90m...)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Ngày bắt đầu tìm (chọn hoặc nhập DD/MM/YYYY)').setRequired(false).setAutocomplete(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('days').setDescription('Số ngày quét tìm kiếm tiếp theo (1 - 14, mặc định: 1)').setRequired(false).setMinValue(1).setMaxValue(14)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'duration') {
      const choices = getDurationChoices(focused.value);
      await interaction.respond(choices);
      return;
    }

    if (focused.name === 'date') {
      const choices = getDateChoices(focused.value);
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
    const durationStr = interaction.options.getString('duration', true);
    const dateStr = interaction.options.getString('date');
    const daysCount = interaction.options.getInteger('days') || 1;

    try {
      const minDurationMinutes = parseDuration(durationStr);
      const settings = await settingsService.getSettings(guildId);
      const tz = settings.timezone;

      const startDate = dateStr ? parseDateStartOfDay(dateStr, tz) : new Date();

      const results = await availabilityService.findFreeSlots(guildId, startDate, minDurationMinutes, daysCount);

      if (results.length === 0) {
        await interaction.reply({
          content: `🔍 Không tìm thấy khoảng thời gian trống nào có tối thiểu **${durationStr}** trong ${daysCount} ngày tới.`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔎 SLOT TRỐNG TỐI THIỂU ${durationStr.toUpperCase()}`)
        .setColor(EMBED_COLORS.SUCCESS)
        .setFooter({ text: `Tìm kiếm trong ${daysCount} ngày` });

      const sections = results.map((r) => {
        const dayTitle = `📅 **${formatDate(r.date, tz)}**`;
        const slotLines = r.slots.map(
          (s) => `🟢 \`${formatTimeRange(s.start, s.end, tz)}\` — Có thể nhận **${formatDuration(s.durationMinutes)}**`
        );
        return `${dayTitle}\n${slotLines.join('\n')}`;
      });

      embed.setDescription(sections.join('\n\n━━━━━━━━━━━━━━━━━━\n\n'));

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${formatErrorMessage(error)}`,
        ephemeral: true,
      });
    }
  },
};

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { assertOwnerOrAdmin } from '../permissions.js';
import { bookingService } from '../../services/booking.service.js';
import { dashboardService } from '../../services/dashboard.service.js';
import { reminderService } from '../../services/reminder.service.js';
import { customerService } from '../../services/customer.service.js';
import { scheduleService } from '../../services/schedule.service.js';
import { prisma } from '../../database/prisma.js';
import {
  createRescheduleModal,
  createExtendModal,
  createCancelModal,
  createQuickBookModal,
} from '../components/modals.js';
import {
  buildLiveDashboardEmbed,
  buildLiveDashboardComponents,
} from '../components/control-panel.js';
import {
  buildTodayScheduleEmbed,
  buildTomorrowScheduleEmbed,
  buildWeekScheduleEmbed,
  createWeekNavigationButtons,
  buildFreeSlotsEmbed,
} from '../components/dashboard-embed.js';
import { createBookingCardEmbed, createBookingCardButtons } from '../components/booking-card.js';
import { createPaginationButtons } from '../components/pagination.js';
import { BOOKING_STATUS, EMBED_COLORS, BOOKING_STATUS_DISPLAY } from '../../config/constants.js';
import { formatTime, formatDate, addDaysTz } from '../../utils/timezone.js';
import { formatDuration } from '../../utils/duration.js';
import { formatErrorMessage } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  try {
    assertOwnerOrAdmin(interaction);

    // 1. Booking Actions via Card / Reminders
    if (customId.startsWith('book_complete:') || customId.startsWith('remind_complete:')) {
      const code = customId.split(':')[1];
      const updated = await bookingService.completeBooking({
        guildId: interaction.guildId || '',
        bookingCode: code,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
      });

      await dashboardService.refreshAll(interaction.guildId || '');
      const embed = createBookingCardEmbed(updated);
      const buttons = createBookingCardButtons(updated.bookingCode, updated.status);

      await interaction.update({
        content: `✅ Đã đánh dấu hoàn thành booking \`${code}\` của khách **${updated.customerName}**!`,
        embeds: [embed],
        components: buttons,
      });
      return;
    }

    if (customId.startsWith('book_reschedule:')) {
      const code = customId.split(':')[1];
      const modal = createRescheduleModal(code);
      await interaction.showModal(modal);
      return;
    }

    if (customId.startsWith('book_extend:')) {
      const code = customId.split(':')[1];
      const modal = createExtendModal(code);
      await interaction.showModal(modal);
      return;
    }

    if (customId.startsWith('book_cancel:')) {
      const code = customId.split(':')[1];
      const modal = createCancelModal(code);
      await interaction.showModal(modal);
      return;
    }

    if (customId.startsWith('remind_start:')) {
      const code = customId.split(':')[1];
      const updated = await prisma.booking.update({
        where: { bookingCode: code },
        data: { status: BOOKING_STATUS.IN_PROGRESS },
        include: { customer: true },
      });

      await dashboardService.refreshOverview(interaction.guildId || '');
      await interaction.reply({
        content: `▶️ Đã bắt đầu thực hiện booking \`${code}\` (${updated.customerName})!`,
        ephemeral: true,
      });
      return;
    }

    if (customId.startsWith('remind_snooze:')) {
      const bookingId = customId.split(':')[1];
      await reminderService.snoozeReminder(bookingId, 5);
      await interaction.reply({
        content: `⏰ Đã hoãn nhắc nhở. Bot sẽ gửi lại thông báo sau 5 phút.`,
        ephemeral: true,
      });
      return;
    }

    // 2. Control Panel Actions
    if (customId === 'panel_quick_book') {
      const modal = createQuickBookModal();
      await interaction.showModal(modal);
      return;
    }

    if (customId === 'panel_refresh') {
      const guildId = interaction.guildId || '';
      const embed = await buildLiveDashboardEmbed(guildId);
      const components = await buildLiveDashboardComponents(guildId);
      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (customId === 'panel_today') {
      const embed = await buildTodayScheduleEmbed(interaction.guildId || '', new Date());
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (customId === 'panel_tomorrow') {
      const embed = await buildTomorrowScheduleEmbed(interaction.guildId || '');
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (customId === 'panel_free') {
      const embed = await buildFreeSlotsEmbed(interaction.guildId || '', new Date());
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (customId === 'panel_next') {
      const nextOverview = await scheduleService.getNextBookingOverview(interaction.guildId || '');
      if (!nextOverview.currentOrNext) {
        await interaction.reply({ content: '🟢 Hiện tại không có lịch tiếp theo.', ephemeral: true });
        return;
      }
      const b = nextOverview.currentOrNext;
      await interaction.reply({
        content: `🔴 **Lịch tiếp theo:** ${b.customerName} (\`${formatTime(b.startAt)} → ${formatTime(b.endAt)}\` - ${formatDate(b.startAt)})`,
        ephemeral: true,
      });
      return;
    }

    if (customId === 'panel_customers') {
      const totalCount = await prisma.customer.count();
      const customers = await prisma.customer.findMany({
        orderBy: { totalBookings: 'desc' },
        take: 10,
      });

      const lines = customers.map(
        (c, idx) =>
          `**${idx + 1}. ${c.name}** — ${c.totalBookings} lịch (${formatDuration(c.totalMinutes)})`
      );

      const embed = new EmbedBuilder()
        .setTitle(`👥 DANH SÁCH KHÁCH HÀNG (${totalCount} khách)`)
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'Dùng /customer <tên> để xem chi tiết' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (customId === 'panel_stats') {
      const stats = await scheduleService.getStats(interaction.guildId || '', 'today');
      const totalHours = (stats.totalBookedMinutes / 60).toFixed(1).replace('.0', '');
      const embed = new EmbedBuilder()
        .setTitle('📊 THỐNG KÊ HÔM NAY')
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(
          `• Tổng lịch: **${stats.totalBookings}**\n` +
          `• Đã hoàn thành: **${stats.completedBookings}**\n` +
          `• Đang thực hiện: **${stats.inProgressBookings}**\n` +
          `• Đã hủy: **${stats.cancelledBookings}**\n` +
          `• Tổng giờ: **${totalHours}H**`
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (customId === 'panel_settings') {
      await interaction.reply({
        content: '⚙️ Vui lòng sử dụng lệnh `/settings view` hoặc `/settings <tùy chọn>` để cấu hình hệ thống.',
        ephemeral: true,
      });
      return;
    }

    if (customId === 'panel_help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('📖 HƯỚNG DẪN SỬ DỤNG HỆ THỐNG')
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(
          '• **➕ Đặt lịch**: Mở form điền thông tin đặt lịch hẹn mới.\n' +
          '• **📅 Hôm nay**: Xem timeline làm việc hôm nay.\n' +
          '• **🟢 Giờ trống**: Xem các khung giờ còn trống.\n' +
          '• **➡️ Lịch tiếp**: Xem lịch đang diễn ra hoặc lịch tiếp theo.\n' +
          '• **👥 Khách hàng**: Danh sách khách hàng và lịch sử.\n' +
          '• **📊 Thống kê**: Báo cáo tổng số giờ làm việc.\n\n' +
          'Bạn cũng có thể dùng trực tiếp các lệnh: `/book`, `/today`, `/free`, `/schedule`, `/cancel`, `/reschedule`...'
        );
      await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      return;
    }

    // 3. Week Schedule Navigation
    if (customId.startsWith('week_')) {
      const parts = customId.split(':');
      const action = parts[0];
      const ts = parseInt(parts[1], 10);
      let anchorDate = new Date(ts);

      if (action === 'week_prev') {
        anchorDate = addDaysTz(anchorDate, -7);
      } else if (action === 'week_next') {
        anchorDate = addDaysTz(anchorDate, 7);
      } else if (action === 'week_today') {
        anchorDate = new Date();
      }

      const embed = await buildWeekScheduleEmbed(interaction.guildId || '', anchorDate);
      const buttons = createWeekNavigationButtons(anchorDate);

      await interaction.update({ embeds: [embed], components: buttons });
      return;
    }

    // 4. Pagination Handlers
    if (customId.startsWith('search:page:')) {
      const page = parseInt(customId.split(':')[2], 10);
      const result = await bookingService.searchBookings({ guildId: interaction.guildId || '' }, page, 8);

      const lines = result.bookings.map((b) => {
        const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[b.status]?.emoji || '⚪';
        return `${statusEmoji} \`${b.bookingCode}\` • **${b.customerName}** • \`${formatDate(b.startAt)} ${formatTime(b.startAt)} → ${formatTime(b.endAt)}\``;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🔎 KẾT QUẢ TÌM KIẾM BOOKING (Tìm thấy: ${result.totalCount})`)
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Trang ${page} / ${result.totalPages}` });

      const components = createPaginationButtons('search', page, result.totalPages);
      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (customId.startsWith('customers:page:')) {
      const page = parseInt(customId.split(':')[2], 10);
      const pageSize = 10;
      const totalCount = await prisma.customer.count();
      const totalPages = Math.ceil(totalCount / pageSize);

      const customers = await prisma.customer.findMany({
        orderBy: { totalBookings: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      const lines = customers.map(
        (c, idx) =>
          `**${(page - 1) * pageSize + idx + 1}. ${c.name}**\n` +
          `   • ${c.totalBookings} lịch (${formatDuration(c.totalMinutes)}) • Hoàn thành: ${c.completedBookings} • Hủy: ${c.cancelledBookings}`
      );

      const embed = new EmbedBuilder()
        .setTitle(`👥 DANH SÁCH KHÁCH HÀNG (${totalCount} khách)`)
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Trang ${page} / ${totalPages}` });

      const components = createPaginationButtons('customers', page, totalPages);
      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (customId.startsWith('cust_history:')) {
      const customerId = customId.split(':')[1];
      const customer = await customerService.getCustomerById(customerId);
      const pageSize = 8;
      const totalCount = await prisma.booking.count({ where: { customerId } });
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      const bookings = await prisma.booking.findMany({
        where: { customerId },
        orderBy: { startAt: 'desc' },
        take: pageSize,
      });

      const lines = bookings.map((b) => {
        const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[b.status]?.emoji || '⚪';
        return `${statusEmoji} **${formatDate(b.startAt)}** (\`${formatTime(b.startAt)} → ${formatTime(b.endAt)}\`) — ${formatDuration(b.durationMinutes)} (\`${b.bookingCode}\`)`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📜 LỊCH SỬ BOOKING — ${customer.name}`)
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(lines.length > 0 ? lines.join('\n\n') : '*Chưa có lịch sử*')
        .setFooter({ text: `Trang 1 / ${totalPages}` });

      const components = totalPages > 1 ? createPaginationButtons(`history:${customerId}`, 1, totalPages) : [];

      await interaction.reply({ embeds: [embed], components, ephemeral: true });
      return;
    }

    if (customId.startsWith('history:') && customId.includes(':page:')) {
      const parts = customId.split(':');
      const customerId = parts[1];
      const page = parseInt(parts[3], 10);
      const customer = await customerService.getCustomerById(customerId);

      const pageSize = 8;
      const totalCount = await prisma.booking.count({ where: { customerId } });
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      const bookings = await prisma.booking.findMany({
        where: { customerId },
        orderBy: { startAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      const lines = bookings.map((b) => {
        const statusEmoji = (BOOKING_STATUS_DISPLAY as any)[b.status]?.emoji || '⚪';
        return `${statusEmoji} **${formatDate(b.startAt)}** (\`${formatTime(b.startAt)} → ${formatTime(b.endAt)}\`) — ${formatDuration(b.durationMinutes)} (\`${b.bookingCode}\`)`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📜 LỊCH SỬ BOOKING — ${customer.name}`)
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Trang ${page} / ${totalPages}` });

      const components = createPaginationButtons(`history:${customerId}`, page, totalPages);
      await interaction.update({ embeds: [embed], components });
      return;
    }
  } catch (error) {
    logger.error({ error, customId }, 'Error in button interaction handler');
    const msg = `❌ ${formatErrorMessage(error)}`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}

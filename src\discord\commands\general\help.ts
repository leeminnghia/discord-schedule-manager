import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { EMBED_COLORS } from '../../../config/constants.js';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Xem hướng dẫn sử dụng toàn bộ danh sách lệnh của Bot'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📖 HƯỚNG DẪN SỬ DỤNG DISCORD SCHEDULE MANAGER')
      .setColor(EMBED_COLORS.PRIMARY)
      .setDescription(
        'Hệ thống quản lý lịch đặt và thời gian làm việc cá nhân chuyên nghiệp.\n' +
        'Múi giờ chuẩn: **Asia/Ho_Chi_Minh (GMT+7)**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '📅 QUẢN LÝ BOOKING',
          value:
            '• `/book` : Đặt lịch hẹn mới cho khách (tự động tính giờ kết thúc, chống trùng)\n' +
            '• `/booking` : Xem chi tiết booking kèm các nút thao tác nhanh\n' +
            '• `/reschedule` : Dời lịch hẹn sang ngày/giờ mới\n' +
            '• `/extend` : Gia hạn thêm thời gian cho lịch hẹn\n' +
            '• `/shorten` : Rút ngắn thời gian lịch hẹn\n' +
            '• `/cancel` : Hủy lịch hẹn (giải phóng slot nhưng giữ lịch sử)\n' +
            '• `/complete` : Đánh dấu hoàn thành lịch hẹn\n' +
            '• `/upcoming` : Xem danh sách 5-10 lịch sắp tới\n' +
            '• `/next` : Xem ngay lịch đang diễn ra hoặc lịch tiếp theo gần nhất\n' +
            '• `/search` : Tìm kiếm lịch theo khách, ngày, trạng thái',
          inline: false,
        },
        {
          name: '🟢 XEM LỊCH & THỜI GIAN TRỐNG',
          value:
            '• `/today` : Xem timeline biểu đồ làm việc chi tiết hôm nay\n' +
            '• `/schedule` : Xem chi tiết lịch và timeline của một ngày bất kỳ\n' +
            '• `/week` : Xem tổng quan lịch làm việc trong tuần\n' +
            '• `/free` : Xem tất cả các khoảng thời gian đang còn trống\n' +
            '• `/findfree` : Tìm các slot trống liên tục có độ dài $\\ge$ X giờ trong N ngày\n' +
            '• `/available` : Tạo văn bản lịch trống siêu ngắn gọn để copy gửi khách\n' +
            '• `/stats` : Xem thống kê hiệu suất làm việc (today, week, month)',
          inline: false,
        },
        {
          name: '👤 QUẢN LÝ KHÁCH HÀNG',
          value:
            '• `/customer` : Xem hồ sơ, tổng số giờ, lần đặt gần nhất & ghi chú của khách\n' +
            '• `/customers` : Danh sách tất cả khách hàng (phân trang)\n' +
            '• `/history` : Xem toàn bộ lịch sử các lần đặt của một khách',
          inline: false,
        },
        {
          name: '⚙️ CẤU HÌNH & HỆ THỐNG',
          value:
            '• `/setup` : Tự động khởi tạo Channel, Category & Dashboard cố định\n' +
            '• `/block` : Khóa thời gian nghỉ ngơi hoặc việc cá nhân\n' +
            '• `/unblock` : Mở khóa lại khoảng thời gian đã block\n' +
            '• `/settings` : Cài đặt buffer time, giờ làm việc tuần, mốc nhắc nhở, summary',
          inline: false,
        }
      )
      .setFooter({ text: 'Discord Booking & Schedule Manager • GMT+7' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

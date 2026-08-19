import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { formatDate, nowInTimezone } from '../../utils/timezone.js';
import { TIMEZONE } from '../../config/constants.js';

export function createQuickBookModal(): ModalBuilder {
  const now = nowInTimezone(TIMEZONE);
  const todayStr = formatDate(new Date(), TIMEZONE);

  // Compute next round hour: e.g. if 14:28 -> suggest 15:00
  let nextHour = now.getHours() + 1;
  let defaultDateStr = todayStr;
  if (nextHour >= 24) {
    nextHour = 8;
  }
  const defaultTimeStr = `${nextHour.toString().padStart(2, '0')}:00`;

  const modal = new ModalBuilder()
    .setCustomId('modal_quick_book')
    .setTitle('➕ Đặt lịch khách mới');

  const customerInput = new TextInputBuilder()
    .setCustomId('customer_name')
    .setLabel('Tên khách hàng')
    .setPlaceholder('Nhập tên khách hàng (ví dụ: Bin, Linh, Khách A...)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const dateInput = new TextInputBuilder()
    .setCustomId('booking_date')
    .setLabel('Ngày hẹn (DD/MM/YYYY)')
    .setValue(defaultDateStr)
    .setPlaceholder('Ví dụ: 19/08/2026')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const timeInput = new TextInputBuilder()
    .setCustomId('booking_time')
    .setLabel('Giờ bắt đầu (HH:mm hoặc 14h, 15h30...)')
    .setValue(defaultTimeStr)
    .setPlaceholder('Ví dụ: 14:00, 15h, 16h30...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const durationInput = new TextInputBuilder()
    .setCustomId('booking_duration')
    .setLabel('Thời lượng (2h, 3h, 1h30m, 2...)')
    .setValue('2h')
    .setPlaceholder('Ví dụ: 2h, 3h, 30m...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const noteInput = new TextInputBuilder()
    .setCustomId('booking_note')
    .setLabel('Ghi chú (Tùy chọn)')
    .setPlaceholder('Ví dụ: Khách quen, Dắt thẻ 2 tiếng...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(customerInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput)
  );

  return modal;
}

export function createRescheduleModal(bookingCode: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`modal_reschedule:${bookingCode}`)
    .setTitle(`🔄 Dời lịch — ${bookingCode}`);

  const todayStr = formatDate(new Date(), TIMEZONE);

  const dateInput = new TextInputBuilder()
    .setCustomId('new_date')
    .setLabel('Ngày mới (DD/MM/YYYY)')
    .setValue(todayStr)
    .setPlaceholder('Ví dụ: 20/08/2026')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const timeInput = new TextInputBuilder()
    .setCustomId('new_time')
    .setLabel('Giờ mới (HH:mm hoặc 15h, 16h...)')
    .setPlaceholder('Ví dụ: 15:00, 16h30...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
  );

  return modal;
}

export function createExtendModal(bookingCode: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`modal_extend:${bookingCode}`)
    .setTitle(`➕ Gia hạn — ${bookingCode}`);

  const durationInput = new TextInputBuilder()
    .setCustomId('extra_duration')
    .setLabel('Thời lượng gia hạn thêm (1h, 2h, 30m...)')
    .setValue('1h')
    .setPlaceholder('Ví dụ: 1h, 30m, 2h...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput));
  return modal;
}

export function createCancelModal(bookingCode: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`modal_cancel:${bookingCode}`)
    .setTitle(`❌ Hủy lịch — ${bookingCode}`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('cancel_reason')
    .setLabel('Lý do hủy lịch (Tùy chọn)')
    .setValue('Khách bận đột xuất')
    .setPlaceholder('Ví dụ: Khách bận đột xuất...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  return modal;
}

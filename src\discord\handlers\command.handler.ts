import { ChatInputCommandInteraction, Collection } from 'discord.js';
import { Command } from '../../types/discord.types.js';
import { logger } from '../../utils/logger.js';
import { formatErrorMessage } from '../../utils/errors.js';

// Import all commands
import { setupCommand } from '../commands/admin/setup.js';
import { settingsCommand } from '../commands/admin/settings.js';
import { blockCommand } from '../commands/admin/block.js';
import { unblockCommand } from '../commands/admin/unblock.js';
import { devseedCommand } from '../commands/admin/devseed.js';
import { testReminderCommand } from '../commands/admin/testreminder.js';

import { bookCommand } from '../commands/booking/book.js';
import { bookingDetailCommand } from '../commands/booking/booking.js';
import { rescheduleCommand } from '../commands/booking/reschedule.js';
import { extendCommand } from '../commands/booking/extend.js';
import { shortenCommand } from '../commands/booking/shorten.js';
import { cancelCommand } from '../commands/booking/cancel.js';
import { completeCommand } from '../commands/booking/complete.js';
import { searchCommand } from '../commands/booking/search.js';
import { upcomingCommand } from '../commands/booking/upcoming.js';
import { nextCommand } from '../commands/booking/next.js';

import { todayCommand } from '../commands/schedule/today.js';
import { tomorrowCommand } from '../commands/schedule/tomorrow.js';
import { scheduleCommand } from '../commands/schedule/schedule.js';
import { weekCommand } from '../commands/schedule/week.js';
import { freeCommand } from '../commands/schedule/free.js';
import { findFreeCommand } from '../commands/schedule/findfree.js';
import { availableCommand } from '../commands/schedule/available.js';
import { statsCommand } from '../commands/schedule/stats.js';

import { customerDetailCommand } from '../commands/customer/customer.js';
import { customersListCommand } from '../commands/customer/customers.js';
import { historyCommand } from '../commands/customer/history.js';

import { helpCommand } from '../commands/general/help.js';
import { panelCommand } from '../commands/general/panel.js';

export const commands = new Collection<string, Command>();

const commandList: Command[] = [
  setupCommand,
  settingsCommand,
  blockCommand,
  unblockCommand,
  devseedCommand,
  testReminderCommand,

  bookCommand,
  bookingDetailCommand,
  rescheduleCommand,
  extendCommand,
  shortenCommand,
  cancelCommand,
  completeCommand,
  searchCommand,
  upcomingCommand,
  nextCommand,

  todayCommand,
  tomorrowCommand,
  scheduleCommand,
  weekCommand,
  freeCommand,
  findFreeCommand,
  availableCommand,
  statsCommand,

  customerDetailCommand,
  customersListCommand,
  historyCommand,

  helpCommand,
  panelCommand,
];

for (const cmd of commandList) {
  commands.set(cmd.data.name, cmd);
}

export async function handleCommandInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error({ error, commandName: interaction.commandName }, 'Error executing slash command');
    const msg = `❌ Có lỗi xảy ra: ${formatErrorMessage(error)}`;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}

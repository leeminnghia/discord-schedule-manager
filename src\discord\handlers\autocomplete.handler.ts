import { AutocompleteInteraction } from 'discord.js';
import { commands } from './command.handler.js';
import { logger } from '../../utils/logger.js';

export async function handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
  const command = commands.get(interaction.commandName);

  if (!command || !command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    logger.error({ error, commandName: interaction.commandName }, 'Error handling autocomplete');
  }
}

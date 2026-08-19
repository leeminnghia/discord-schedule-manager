import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { commands } from './handlers/command.handler.js';
import { logger } from '../utils/logger.js';

export async function deployCommands(guildIds: string[] = []): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const commandData = Array.from(commands.values()).map((c) => c.data.toJSON());

  try {
    logger.info(`Started refreshing ${commandData.length} application (/) commands.`);

    // 1. Deploy to all active guilds for instant availability
    const targetGuilds = new Set<string>(guildIds);
    if (env.DISCORD_GUILD_ID) {
      targetGuilds.add(env.DISCORD_GUILD_ID);
    }

    for (const gid of targetGuilds) {
      if (gid && gid !== 'your_discord_guild_id' && gid !== 'dummy_guild_id_for_test') {
        try {
          await rest.put(
            Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, gid),
            { body: commandData }
          );
          logger.info(`✅ Successfully reloaded application (/) commands for guild ${gid}.`);
        } catch (err: any) {
          logger.warn(`Could not deploy commands to guild ${gid}: ${err.message}`);
        }
      }
    }

    // 2. Also register globally
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
      body: commandData,
    });
    logger.info('✅ Successfully reloaded global application (/) commands.');
  } catch (error) {
    logger.error({ error }, 'Failed to deploy slash commands to Discord');
  }
}

// Run directly if invoked as script
if (process.argv[1]?.endsWith('deploy-commands.ts') || process.argv[1]?.endsWith('deploy-commands.js')) {
  deployCommands().then(() => process.exit(0));
}

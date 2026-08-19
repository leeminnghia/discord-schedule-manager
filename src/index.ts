import { Events, Interaction } from 'discord.js';
import { discordClient } from './discord/client.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase, prisma } from './database/prisma.js';
import { deployCommands } from './discord/deploy-commands.js';
import { handleCommandInteraction } from './discord/handlers/command.handler.js';
import { handleAutocompleteInteraction } from './discord/handlers/autocomplete.handler.js';
import { handleButtonInteraction } from './discord/handlers/button.handler.js';
import { handleSelectMenuInteraction } from './discord/handlers/select-menu.handler.js';
import { handleModalInteraction } from './discord/handlers/modal.handler.js';
import { reminderScheduler } from './scheduler/reminder.scheduler.js';
import { autoStatusScheduler } from './scheduler/auto-status.scheduler.js';
import { dailySummaryScheduler } from './scheduler/daily-summary.scheduler.js';
import { dashboardService } from './services/dashboard.service.js';
import { reminderService } from './services/reminder.service.js';
import { startHealthServer, stopHealthServer } from './server/health.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('🚀 Starting Discord Schedule Manager...');

  // 1. Start HTTP Health check server immediately (critical for Render port detection)
  startHealthServer(env.PORT);

  // 2. Connect database
  await connectDatabase();

  // 2. Setup interaction listener
  discordClient.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommandInteraction(interaction);
      } else if (interaction.isAutocomplete()) {
        await handleAutocompleteInteraction(interaction);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenuInteraction(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalInteraction(interaction);
      }
    } catch (error) {
      logger.error({ error }, 'Unhandled error in interaction router');
    }
  });

  // 3. Client Ready event
  discordClient.once(Events.ClientReady, async (client) => {
    try {
      logger.info(`✅ Logged in as ${client.user.tag}!`);

      const joinedGuilds = client.guilds.cache.map((g) => g.id);
      for (const g of client.guilds.cache.values()) {
        logger.info(`🏰 Joined Server: "${g.name}" (ID: ${g.id})`);
      }

      // Deploy slash commands directly to all joined guilds (Instant) and globally
      await deployCommands(joinedGuilds);

      // Startup recovery for reminders
      await reminderService.processStartupRecovery();

      // Start schedulers
      reminderScheduler.start();
      autoStatusScheduler.start();
      dailySummaryScheduler.start();

      // Initial refresh of dashboards for all guilds
      const allSettings = await prisma.guildSettings.findMany();
      for (const s of allSettings) {
        await dashboardService.refreshAll(s.guildId);
      }

      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🎉 Bot ready.');
      logger.info('📦 Database connected.');
      logger.info('⏰ Scheduler ready.');
      logger.info('📊 Dashboard updated.');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
      logger.error({ err }, 'Error during ClientReady initialization');
    }
  });

  // 4. Log in to Discord
  await discordClient.login(env.DISCORD_TOKEN);
}

// Graceful Shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  reminderScheduler.stop();
  autoStatusScheduler.stop();
  dailySummaryScheduler.stop();

  await stopHealthServer();
  await discordClient.destroy();
  await disconnectDatabase();

  logger.info('Cleanup complete. Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception thrown');
  process.exit(1);
});

// Run bootstrap
bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to bootstrap application');
  process.exit(1);
});

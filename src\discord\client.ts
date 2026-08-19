import { Client, GatewayIntentBits, Partials } from 'discord.js';

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

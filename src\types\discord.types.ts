import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ButtonHandler {
  customId: string | RegExp;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface ModalHandler {
  customId: string | RegExp;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}

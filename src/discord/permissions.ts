import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  PermissionsBitField,
} from 'discord.js';
import { env } from '../config/env.js';
import { PermissionError } from '../utils/errors.js';

export type AnyInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

export function isOwnerOrAdmin(interaction: AnyInteraction): boolean {
  const userId = interaction.user.id;

  // Check if owner ID from env matches
  if (env.OWNER_USER_ID && userId === env.OWNER_USER_ID) {
    return true;
  }

  // Check if user is the Guild Owner
  if (interaction.guild && interaction.guild.ownerId === userId) {
    return true;
  }

  // Check guild administrator permission
  if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  return false;
}

export function assertOwnerOrAdmin(interaction: AnyInteraction): void {
  if (!isOwnerOrAdmin(interaction)) {
    throw new PermissionError('❌ Bạn không có quyền sử dụng chức năng quản trị này.');
  }
}

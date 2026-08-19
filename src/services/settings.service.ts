import { prisma } from '../database/prisma.js';
import { GuildSettings } from '@prisma/client';
import { WeekWorkingHours } from '../types/schedule.types.js';
import { TIMEZONE } from '../config/constants.js';

export const DEFAULT_WORKING_HOURS: WeekWorkingHours = {
  mon: { start: '00:00', end: '24:00', enabled: true },
  tue: { start: '00:00', end: '24:00', enabled: true },
  wed: { start: '00:00', end: '24:00', enabled: true },
  thu: { start: '00:00', end: '24:00', enabled: true },
  fri: { start: '00:00', end: '24:00', enabled: true },
  sat: { start: '00:00', end: '24:00', enabled: true },
  sun: { start: '00:00', end: '24:00', enabled: true },
};

export class SettingsService {
  /**
   * Retrieves or initializes guild settings
   */
  async getSettings(guildId: string): Promise<GuildSettings> {
    let settings = await prisma.guildSettings.findUnique({
      where: { guildId },
    });

    if (!settings) {
      settings = await prisma.guildSettings.create({
        data: {
          guildId,
          timezone: TIMEZONE,
          minimumBufferMinutes: 0,
          workingHoursJson: JSON.stringify(DEFAULT_WORKING_HOURS),
          allowOverbooking: false,
          reminderOffsetsMinutes: '30,10,0',
          dailySummaryTime: '23:00',
          tomorrowSummaryTime: '21:00',
        },
      });
    }

    return settings;
  }

  /**
   * Updates guild settings
   */
  async updateSettings(guildId: string, data: Partial<GuildSettings>): Promise<GuildSettings> {
    return prisma.guildSettings.upsert({
      where: { guildId },
      update: data,
      create: {
        guildId,
        timezone: data.timezone || TIMEZONE,
        minimumBufferMinutes: data.minimumBufferMinutes ?? 0,
        workingHoursJson: data.workingHoursJson || JSON.stringify(DEFAULT_WORKING_HOURS),
        allowOverbooking: data.allowOverbooking ?? false,
        reminderOffsetsMinutes: data.reminderOffsetsMinutes || '30,10,0',
        dailySummaryTime: data.dailySummaryTime || '23:00',
        tomorrowSummaryTime: data.tomorrowSummaryTime || '21:00',
        ...data,
      },
    });
  }

  /**
   * Parses working hours JSON from settings
   */
  parseWorkingHours(settings: GuildSettings): WeekWorkingHours {
    try {
      return JSON.parse(settings.workingHoursJson) as WeekWorkingHours;
    } catch {
      return DEFAULT_WORKING_HOURS;
    }
  }

  /**
   * Parses reminder offsets (e.g. "30,10,0") into integer array
   */
  parseReminderOffsets(settings: GuildSettings): number[] {
    try {
      return settings.reminderOffsetsMinutes
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    } catch {
      return [30, 10, 0];
    }
  }
}

export const settingsService = new SettingsService();

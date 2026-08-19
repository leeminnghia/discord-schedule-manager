export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface DayWorkingHours {
  start: string; // "08:00"
  end: string;   // "23:00"
  enabled: boolean;
}

export type WeekWorkingHours = {
  mon: DayWorkingHours;
  tue: DayWorkingHours;
  wed: DayWorkingHours;
  thu: DayWorkingHours;
  fri: DayWorkingHours;
  sat: DayWorkingHours;
  sun: DayWorkingHours;
};

export interface TimelineItem {
  type: 'BOOKING' | 'BLOCKED' | 'FREE';
  start: Date;
  end: Date;
  durationMinutes: number;
  title: string;
  status?: string;
  bookingCode?: string;
  customerName?: string;
  reason?: string;
}

export interface DayScheduleSummary {
  date: Date;
  formattedDate: string;
  weekdayName: string;
  items: TimelineItem[];
  totalBookings: number;
  completedBookings: number;
  inProgressBookings: number;
  remainingBookings: number;
  cancelledBookings: number;
  totalBookedMinutes: number;
  totalFreeMinutes: number;
  freeSlots: TimeSlot[];
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingItem?: {
    type: 'BOOKING' | 'BLOCKED';
    title: string;
    start: Date;
    end: Date;
  };
  suggestedFreeSlots?: TimeSlot[];
  reason?: string;
}

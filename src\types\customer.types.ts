export interface CreateCustomerInput {
  name: string;
  discordUserId?: string;
  discordUsername?: string;
  phone?: string;
  note?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  discordUserId?: string;
  discordUsername?: string;
  phone?: string;
  note?: string;
}

export interface CustomerStats {
  id: string;
  name: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
  phone?: string | null;
  note?: string | null;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalMinutes: number;
  lastBookingDate?: Date | null;
  nextBookingDate?: Date | null;
}

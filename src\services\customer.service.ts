import { prisma } from '../database/prisma.js';
import { Customer } from '@prisma/client';
import { CreateCustomerInput, UpdateCustomerInput, CustomerStats } from '../types/customer.types.js';
import { BOOKING_STATUS } from '../config/constants.js';
import { NotFoundError } from '../utils/errors.js';

export class CustomerService {
  /**
   * Finds an existing customer by name (case-insensitive) or discordUserId, or creates a new one.
   */
  async findOrCreateCustomer(input: CreateCustomerInput): Promise<Customer> {
    const trimmedName = input.name.trim();

    // 1. Try finding by discordUserId if provided
    if (input.discordUserId) {
      const byDiscord = await prisma.customer.findFirst({
        where: { discordUserId: input.discordUserId },
      });
      if (byDiscord) {
        // Update name or details if changed
        return prisma.customer.update({
          where: { id: byDiscord.id },
          data: {
            name: trimmedName || byDiscord.name,
            discordUsername: input.discordUsername || byDiscord.discordUsername,
            phone: input.phone || byDiscord.phone,
            note: input.note ? `${byDiscord.note ? byDiscord.note + ' | ' : ''}${input.note}` : byDiscord.note,
          },
        });
      }
    }

    // 2. Try finding by name (case insensitive matching)
    const existing = await prisma.customer.findFirst({
      where: {
        name: {
          equals: trimmedName,
        },
      },
    });

    if (existing) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: {
          discordUserId: input.discordUserId || existing.discordUserId,
          discordUsername: input.discordUsername || existing.discordUsername,
          phone: input.phone || existing.phone,
        },
      });
    }

    // 3. Create new customer
    return prisma.customer.create({
      data: {
        name: trimmedName,
        discordUserId: input.discordUserId,
        discordUsername: input.discordUsername,
        phone: input.phone,
        note: input.note,
      },
    });
  }

  /**
   * Retrieves customer by ID
   */
  async getCustomerById(id: string): Promise<Customer> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { startAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      throw new NotFoundError(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    return customer;
  }

  /**
   * Searches customers by name, discord username, or ID
   */
  async searchCustomers(query: string, limit: number = 25): Promise<Customer[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return prisma.customer.findMany({
        orderBy: { totalBookings: 'desc' },
        take: limit,
      });
    }

    return prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: trimmed } },
          { discordUsername: { contains: trimmed } },
          { phone: { contains: trimmed } },
          { id: { equals: trimmed } },
        ],
      },
      orderBy: { totalBookings: 'desc' },
      take: limit,
    });
  }

  /**
   * Recalculates stats for a customer
   */
  async recalculateCustomerStats(customerId: string): Promise<CustomerStats> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        bookings: true,
      },
    });

    if (!customer) {
      throw new NotFoundError('Khách hàng không tồn tại.');
    }

    const totalBookings = customer.bookings.length;
    const completedBookings = customer.bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED).length;
    const cancelledBookings = customer.bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length;
    const totalMinutes = customer.bookings
      .filter((b) => b.status !== BOOKING_STATUS.CANCELLED)
      .reduce((acc, b) => acc + b.durationMinutes, 0);

    const now = new Date();
    const pastBookings = customer.bookings
      .filter((b) => b.startAt < now && b.status !== BOOKING_STATUS.CANCELLED)
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

    const futureBookings = customer.bookings
      .filter((b) => b.startAt >= now && b.status !== BOOKING_STATUS.CANCELLED)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalMinutes,
      },
    });

    return {
      id: customer.id,
      name: customer.name,
      discordUserId: customer.discordUserId,
      discordUsername: customer.discordUsername,
      phone: customer.phone,
      note: customer.note,
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalMinutes,
      lastBookingDate: pastBookings[0]?.startAt || null,
      nextBookingDate: futureBookings[0]?.startAt || null,
    };
  }

  /**
   * Updates customer note
   */
  async updateNote(customerId: string, note: string): Promise<Customer> {
    return prisma.customer.update({
      where: { id: customerId },
      data: { note },
    });
  }
}

export const customerService = new CustomerService();

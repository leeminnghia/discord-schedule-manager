import { PrismaClient } from '@prisma/client';
import { TIMEZONE } from '../src/config/constants.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding sample data for development...');

  const sampleGuildId = '123456789012345678';

  // Seed guild settings
  await prisma.guildSettings.upsert({
    where: { guildId: sampleGuildId },
    update: {},
    create: {
      guildId: sampleGuildId,
      timezone: TIMEZONE,
      minimumBufferMinutes: 10,
      allowOverbooking: false,
    },
  });

  // Seed customer
  const customer = await prisma.customer.create({
    data: {
      name: 'Nguyễn Văn Test',
      phone: '0901234567',
      note: 'Khách hàng thử nghiệm VIP',
    },
  });

  console.log(`✅ Seeded customer: ${customer.name} (${customer.id})`);
}

main()
  .catch((e) => {
    console.error('Error in seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

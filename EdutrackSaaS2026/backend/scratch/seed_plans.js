const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://edutrack_app:edutrack%402026@34.180.7.94:5432/edutrack?sslmode=require"
    }
  }
});

async function main() {
  console.log('Seeding default subscription plans (TRIAL, BASIC, PREMIUM)...');

  const plans = [
    {
      name: 'TRIAL',
      studentLimit: 500,
      teacherLimit: 50,
      parentLimit: 1000,
      storageLimit: 1024,
      features: ['attendance', 'timetable', 'exams', 'billing', 'reports'],
      price: 0,
      durationMonths: 1,
      isDefault: true,
      isActive: true,
    },
    {
      name: 'BASIC',
      studentLimit: 1000,
      teacherLimit: 100,
      parentLimit: 2000,
      storageLimit: 5120,
      features: ['attendance', 'timetable', 'exams', 'billing', 'reports', 'transport'],
      price: 999,
      durationMonths: 12,
      isDefault: false,
      isActive: true,
    },
    {
      name: 'PREMIUM',
      studentLimit: 5000,
      teacherLimit: 500,
      parentLimit: 10000,
      storageLimit: 20480,
      features: ['attendance', 'timetable', 'exams', 'billing', 'reports', 'transport', 'library', 'saas_analytics'],
      price: 2999,
      durationMonths: 12,
      isDefault: false,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`Upserted plan: ${created.name} (ID: ${created.id})`);
  }
}

main()
  .then(() => console.log('Successfully seeded all subscription plans!'))
  .catch(err => console.error('Error seeding subscription plans:', err))
  .finally(() => prisma.$disconnect());

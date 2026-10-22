const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://edutrack_app:edutrack%402026@34.180.7.94:5432/edutrack?sslmode=require&connection_limit=3&pool_timeout=10"
    }
  }
});

async function main() {
  const phone = '7989725121';
  const portal = 'admin';
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

  console.log('Testing sendOtp with connection_limit=3...');

  try {
    // Terminate idle connections in postgres if possible or query users
    const users = await prisma.user.findMany({
      where: { phone: { endsWith: normalizedPhone } }
    });
    console.log('SUCCESS! Found users:', users.map(u => ({ id: u.id, email: u.email, role: u.role, tenantId: u.tenantId })));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

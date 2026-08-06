const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function run() {
  const phone = '7989725121';
  const tenantId = '59529eda-39d9-49f4-9680-9ca4b7b98b53'; // Vikas School
  
  const existing = await prisma.user.findFirst({
    where: { phone: { endsWith: phone } }
  });

  if (existing) {
    console.log('User already exists:', existing);
    return;
  }

  const passwordHash = await bcrypt.hash('Welcome@123', 10);
  const newUser = await prisma.user.create({
    data: {
      email: 'test.admin@vikasschool.edu',
      name: 'Vikas Test Admin',
      passwordHash,
      role: 'SCHOOL_ADMIN',
      phone: phone,
      tenantId
    }
  });

  console.log('Successfully created test user in database:', newUser);
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());

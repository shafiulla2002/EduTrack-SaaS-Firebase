const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module'); // Make sure dist is built or compile it
const { AuthService } = require('./dist/auth/auth.service');
const { PrismaService } = require('./dist/prisma.service');
const axios = require('axios');

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const prisma = app.get(PrismaService);

  // Get Jason (A.P. Greenwood Admin)
  const user = await prisma.user.findFirst({
    where: { email: 'mr.shafiulla143@gmail.com' }
  });

  if (!user) {
    console.error("Jason not found");
    await app.close();
    return;
  }

  const { access_token } = await authService.login(user);
  console.log("Token:", access_token);
  console.log("Tenant ID:", user.tenantId);

  // Call the timetable workload APIs on the backend directly!
  // To test the controller logic locally, we can send requests to port 3001
  try {
    const res = await axios.get('http://localhost:3001/timetable/workload/summary', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Tenant-ID': user.tenantId
      }
    });
    console.log("SUMMARY RESPONSE STATUS:", res.status);
    console.log("SUMMARY RESPONSE DATA:", res.data);
  } catch (err) {
    console.error("SUMMARY API CALL FAILED:", err.response ? err.response.data : err.message);
  }

  await app.close();
}

run().catch(console.error);

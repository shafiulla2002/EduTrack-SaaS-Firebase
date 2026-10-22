import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { TimetableService } from './src/timetable/timetable.service';
import { PrismaService } from './src/prisma.service';
import { TenantContext } from './src/tenants/tenant.context';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const timetableService = app.get(TimetableService);
  const prisma = app.get(PrismaService);

  const tenantId = '778b7f12-d8c3-406d-926c-a403b46100ef';
  console.log("Tenant ID:", tenantId);

  const activeYear = await prisma.academicYear.findFirst({
    where: { tenantId, isActive: true }
  });

  if (!activeYear) {
    console.error("Active academic year not found");
    await app.close();
    return;
  }
  console.log("Active Year ID:", activeYear.id);

  // Call TimetableService in TenantContext zone
  await TenantContext.run(tenantId, async () => {
    try {
      const summary = await timetableService.getWorkloadSummary(activeYear.id);
      console.log("SUMMARY RESPONSE:", summary);

      const teachers = await timetableService.getAllTeacherWorkloads();
      console.log("TEACHERS COUNT:", teachers.length);

      const classes = await timetableService.getAllClassWorkloads();
      console.log("CLASSES COUNT:", classes.length);
    } catch (err: any) {
      console.error("TIMETABLE SERVICE METHOD CALL FAILED:", err.message, err.stack);
    }
  });

  await app.close();
}

run().catch(console.error);

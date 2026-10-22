import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './common/guards/subscription.guard';
import { TenantModule } from './modules/tenant/tenant.module';
import { StudentModule } from './modules/student/student.module';
import { PrismaModule } from './database/prisma.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantModule,
    StudentModule,
    AttendanceModule,
    TeacherModule,
    TimetableModule,
    SubscriptionModule,
    PlatformAdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule {}

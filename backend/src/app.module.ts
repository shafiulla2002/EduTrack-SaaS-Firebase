import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TenantsModule } from './tenants/tenants.module';
import { TenantMiddleware } from './tenants/tenant.middleware';
import { PrismaService } from './prisma.service';
import { SubscriptionGuard } from './common/guards/subscription.guard';
import { AuthModule } from './auth/auth.module';
import { AcademicsModule } from './academics/academics.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ExamsModule } from './exams/exams.module';
import { BillingModule } from './billing/billing.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LibraryModule } from './library/library.module';
import { CommunicationsModule } from './communications/communications.module';
import { ActivityLogModule } from './common/activity-log.module';
import { TimetableModule } from './timetable/timetable.module';
import { ComplaintBoxModule } from './complaint-box/complaint-box.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TeacherPortalModule } from './teacher-portal/teacher-portal.module';
import { HomeworkModule } from './homework/homework.module';
import { ExamScheduleModule } from './exam-schedule/exam-schedule.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { ExamConfigModule } from './exam-config/exam-config.module';
import { TransportModule } from './transport/transport.module';
import { LeaveManagementModule } from './leave-management/leave-management.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TenantsModule,
    AuthModule,
    AcademicsModule,
    StudentsModule,
    TeachersModule,
    AttendanceModule,
    ExamsModule,
    BillingModule,
    ExpensesModule,
    LibraryModule,
    CommunicationsModule,
    ActivityLogModule,
    TimetableModule,
    ComplaintBoxModule,
    DashboardModule,
    TeacherPortalModule,
    HomeworkModule,
    ExamScheduleModule,
    ParentPortalModule,
    ExamConfigModule,
    TransportModule,
    LeaveManagementModule,
    SupportModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule implements NestModule {











  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        'auth/login',
        'auth/send-otp',
        'auth/verify-otp',
        'auth/exchange-code',
        'tenant/register',
        'support/contact',
      )
      .forRoutes('*');
  }
}


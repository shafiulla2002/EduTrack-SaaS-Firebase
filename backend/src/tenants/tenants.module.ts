import { Module, Global, forwardRef } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantController } from './tenant.controller';
import { SchoolSetupController } from './school-setup.controller';
import { SuperAdminController } from './super-admin.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';

@Global()
@Module({
  imports: [AuthModule],
  providers: [TenantsService, PrismaService, SubscriptionSchedulerService],
  controllers: [TenantsController, TenantController, SchoolSetupController, SuperAdminController],
  exports: [TenantsService],
})
export class TenantsModule {}


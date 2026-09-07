import { Controller, Get, Post, Body, Param, Put, UseGuards, Req } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantContext } from './tenant.context';

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post()
  async register(@Body('name') name: string, @Body('subDomain') subDomain: string) {
    return this.tenantsService.create(name, subDomain);
  }

  @Get('current')
  async getCurrentTenant() {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return { message: 'No active tenant context' };
    }
    return this.tenantsService.findById(tenantId);
  }

  @Put('current')
  async updateCurrentTenant(@Body() data: any) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('No active tenant context to update');
    }
    return this.tenantsService.update(tenantId, data);
  }

  @Get()
  async getAll() {
    // In production, this would be guarded by Super Admin RBAC role.
    return this.tenantsService.findAll();
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // -------------------------------------------------------------
  // SCHOOL ADMIN ENDPOINTS
  // -------------------------------------------------------------
  @Get('buses')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  async getBuses(@Req() req: any) {
    return this.transportService.getBuses(req.user.tenantId);
  }

  @Post('buses')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async createBus(@Req() req: any, @Body() dto: any) {
    return this.transportService.createBus(req.user.tenantId, dto);
  }

  @Patch('buses/:id')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateBus(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.transportService.updateBus(req.user.tenantId, id, dto);
  }

  @Delete('buses/:id')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async deleteBus(@Req() req: any, @Param('id') id: string) {
    return this.transportService.deleteBus(req.user.tenantId, id);
  }

  @Get('drivers')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  async getDrivers(@Req() req: any) {
    return this.transportService.getDrivers(req.user.tenantId);
  }

  @Post('drivers')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async createDriver(@Req() req: any, @Body() dto: any) {
    return this.transportService.createDriver(req.user.tenantId, dto);
  }

  @Patch('drivers/:id')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateDriver(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.transportService.updateDriver(req.user.tenantId, id, dto);
  }

  @Delete('drivers/:id')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async deleteDriver(@Req() req: any, @Param('id') id: string) {
    return this.transportService.deleteDriver(req.user.tenantId, id);
  }

  @Get('routes')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  async getRoutes(@Req() req: any) {
    return this.transportService.getRoutes(req.user.tenantId);
  }

  @Post('routes')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async createRoute(@Req() req: any, @Body() dto: any) {
    return this.transportService.createRoute(req.user.tenantId, dto);
  }

  @Post('routes/:id/stops')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async addBusStop(@Req() req: any, @Param('id') routeId: string, @Body() dto: any) {
    return this.transportService.addBusStop(req.user.tenantId, routeId, dto);
  }

  @Delete('stops/:id')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async deleteBusStop(@Req() req: any, @Param('id') stopId: string) {
    return this.transportService.deleteBusStop(req.user.tenantId, stopId);
  }

  @Get('students/assignments')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  async getStudentAssignments(@Req() req: any) {
    return this.transportService.getStudentAssignments(req.user.tenantId);
  }

  @Post('students/assign')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async assignStudentBus(@Req() req: any, @Body() dto: { studentId: string; busId: string | null; busStopId: string | null }) {
    return this.transportService.assignStudentBus(req.user.tenantId, dto);
  }

  @Get('admin/dashboard')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  async getAdminDashboard(@Req() req: any) {
    return this.transportService.getAdminDashboard(req.user.tenantId);
  }

  @Get('trip-history')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  async getTripHistory(@Req() req: any) {
    return this.transportService.getTripHistory(req.user.tenantId);
  }

  // -------------------------------------------------------------
  // DRIVER PORTAL ENDPOINTS
  // -------------------------------------------------------------
  @Get('driver/assigned-bus')
  @Roles(Role.DRIVER, Role.STAFF, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getDriverAssignedBus(@Req() req: any) {
    const userId = req.user.id || req.user.userId || req.user.sub;
    return this.transportService.getDriverAssignedBus(userId, req.user.tenantId);
  }

  @Post('driver/duty')
  @Roles(Role.DRIVER, Role.STAFF, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateDriverDuty(@Req() req: any, @Body('dutyStatus') dutyStatus: string) {
    const userId = req.user.id || req.user.userId || req.user.sub;
    return this.transportService.updateDriverDuty(userId, req.user.tenantId, dutyStatus);
  }

  @Post('driver/gps')
  @Roles(Role.DRIVER, Role.STAFF, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async processDriverGps(
    @Req() req: any,
    @Body() gpsData: { lat: number; lng: number; speed?: number; heading?: number; accuracy?: number; batteryLevel?: number; dutyStatus?: string },
  ) {
    const userId = req.user.id || req.user.userId || req.user.sub;
    console.log(`[Backend GPS Controller] Received GPS ping from userId=${userId}:`, gpsData);
    return this.transportService.processDriverGps(userId, req.user.tenantId, gpsData);
  }

  // -------------------------------------------------------------
  // PARENT PORTAL ENDPOINT
  // -------------------------------------------------------------
  @Get('parent-portal/children/:studentId')
  @Roles(Role.PARENT, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getParentStudentTransport(@Req() req: any, @Param('studentId') studentId: string) {
    const parentUserId = req.user.id || req.user.userId || req.user.sub;
    console.log(`[Backend Parent Portal Controller] Fetching transport info for studentId=${studentId}, parentUserId=${parentUserId}`);
    return this.transportService.getParentStudentTransport(studentId, parentUserId, req.user.tenantId);
  }
}

import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Haversine formula to calculate distance between 2 (lat, lng) points in kilometers
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class TransportService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------
  // SCHOOL ADMIN: BUS MANAGEMENT
  // -------------------------------------------------------------
  async getBuses(tenantId: string) {
    await this.detectAndMarkOfflineBuses(tenantId);
    return this.prisma.bus.findMany({
      where: { tenantId },
      include: {
        driver: {
          include: {
            user: { select: { name: true, phone: true, email: true, avatarUrl: true } },
          },
        },
        route: {
          include: {
            stops: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        students: {
          select: { id: true, rollNo: true, user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBus(tenantId: string, dto: any) {
    if (dto.driverId) {
      const existing = await this.prisma.bus.findFirst({
        where: { tenantId, driverId: dto.driverId, status: 'ACTIVE' },
      });
      if (existing) {
        throw new BadRequestException('This driver is already assigned to another active bus.');
      }
    }

    return this.prisma.bus.create({
      data: {
        busNumber: dto.busNumber,
        registrationNo: dto.registrationNo,
        vehicleModel: dto.vehicleModel || 'Standard School Bus',
        capacity: dto.capacity ? Number(dto.capacity) : 40,
        busPhotoUrl: dto.busPhotoUrl || null,
        pickupTime: dto.pickupTime || '07:30 AM',
        dropTime: dto.dropTime || '02:30 PM',
        status: dto.status || 'ACTIVE',
        dutyStatus: 'OFF_DUTY',
        driverId: dto.driverId || null,
        routeId: dto.routeId || null,
        tenantId,
      },
      include: {
        driver: { include: { user: true } },
        route: { include: { stops: true } },
      },
    });
  }

  async updateBus(tenantId: string, busId: string, dto: any) {
    const bus = await this.prisma.bus.findFirst({ where: { id: busId, tenantId } });
    if (!bus) throw new NotFoundException('Bus not found');

    if (dto.driverId && dto.driverId !== bus.driverId) {
      const existing = await this.prisma.bus.findFirst({
        where: { tenantId, driverId: dto.driverId, status: 'ACTIVE', id: { not: busId } },
      });
      if (existing) {
        throw new BadRequestException('This driver is already assigned to another active bus.');
      }
    }

    return this.prisma.bus.update({
      where: { id: busId },
      data: {
        busNumber: dto.busNumber !== undefined ? dto.busNumber : bus.busNumber,
        registrationNo: dto.registrationNo !== undefined ? dto.registrationNo : bus.registrationNo,
        vehicleModel: dto.vehicleModel !== undefined ? dto.vehicleModel : bus.vehicleModel,
        capacity: dto.capacity !== undefined ? Number(dto.capacity) : bus.capacity,
        busPhotoUrl: dto.busPhotoUrl !== undefined ? dto.busPhotoUrl : bus.busPhotoUrl,
        pickupTime: dto.pickupTime !== undefined ? dto.pickupTime : bus.pickupTime,
        dropTime: dto.dropTime !== undefined ? dto.dropTime : bus.dropTime,
        status: dto.status !== undefined ? dto.status : bus.status,
        driverId: dto.driverId !== undefined ? (dto.driverId || null) : bus.driverId,
        routeId: dto.routeId !== undefined ? (dto.routeId || null) : bus.routeId,
      },
      include: {
        driver: { include: { user: true } },
        route: { include: { stops: true } },
      },
    });
  }

  async deleteBus(tenantId: string, busId: string) {
    const bus = await this.prisma.bus.findFirst({ where: { id: busId, tenantId } });
    if (!bus) throw new NotFoundException('Bus not found');

    return this.prisma.bus.delete({ where: { id: busId } });
  }

  // -------------------------------------------------------------
  // SCHOOL ADMIN: DRIVER MANAGEMENT (Non-Teaching Staff)
  // -------------------------------------------------------------
  async getDrivers(tenantId: string) {
    return this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        OR: [
          { staffRole: 'Driver' },
          { user: { role: 'DRIVER' } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true, isActive: true } },
        assignedBus: { select: { id: true, busNumber: true, registrationNo: true, dutyStatus: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
  }

  async createDriver(tenantId: string, dto: any) {
    const { name, email, phone, password, employeeId, licenseNumber, licenseExpiry, experienceYears, bloodGroup, aadhaarNo, address, emergencyContact } = dto;

    const emailOrPhone = email || `${phone || Date.now()}@schoolbus.driver`;

    const user = await this.prisma.user.create({
      data: {
        name,
        email: emailOrPhone,
        phone: phone || null,
        passwordHash: password || 'Driver@123',
        role: 'DRIVER',
        tenantId,
        isActive: true,
      },
    });

    const staff = await this.prisma.staffProfile.create({
      data: {
        userId: user.id,
        employeeId: employeeId || `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
        designation: 'Bus Driver',
        staffCategory: 'NON_TEACHING',
        staffRole: 'Driver',
        licenseNumber: licenseNumber || null,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        experienceYears: experienceYears ? Number(experienceYears) : null,
        bloodGroup: bloodGroup || null,
        aadhaarNo: aadhaarNo || null,
        whatsappNumber: phone || null,
        address: address || null,
        emergencyContact: emergencyContact || null,
        status: 'Active',
        tenantId,
      },
      include: { user: true },
    });

    return staff;
  }

  async updateDriver(tenantId: string, driverId: string, dto: any) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: driverId, tenantId },
      include: { user: true },
    });
    if (!staff) throw new NotFoundException('Driver not found');

    if (dto.name || dto.phone) {
      await this.prisma.user.update({
        where: { id: staff.userId },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.phone ? { phone: dto.phone } : {}),
        },
      });
    }

    return this.prisma.staffProfile.update({
      where: { id: driverId },
      data: {
        licenseNumber: dto.licenseNumber !== undefined ? dto.licenseNumber : staff.licenseNumber,
        emergencyContact: dto.emergencyContact !== undefined ? dto.emergencyContact : staff.emergencyContact,
        address: dto.address !== undefined ? dto.address : staff.address,
        aadhaarNo: dto.aadhaarNo !== undefined ? dto.aadhaarNo : staff.aadhaarNo,
        whatsappNumber: dto.phone !== undefined ? dto.phone : staff.whatsappNumber,
      },
      include: { user: true, assignedBus: true },
    });
  }

  async deleteDriver(tenantId: string, driverId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: driverId, tenantId },
    });
    if (!staff) throw new NotFoundException('Driver not found');

    return this.prisma.user.delete({ where: { id: staff.userId } });
  }

  // -------------------------------------------------------------
  // SCHOOL ADMIN: ROUTE & STOP MANAGEMENT
  // -------------------------------------------------------------
  async getRoutes(tenantId: string) {
    return this.prisma.busRoute.findMany({
      where: { tenantId },
      include: {
        stops: { orderBy: { sequenceOrder: 'asc' } },
        buses: { select: { id: true, busNumber: true, registrationNo: true } },
      },
      orderBy: { routeName: 'asc' },
    });
  }

  async createRoute(tenantId: string, dto: any) {
    return this.prisma.busRoute.create({
      data: {
        routeName: dto.routeName,
        startPoint: dto.startPoint || null,
        endPoint: dto.endPoint || null,
        description: dto.description || null,
        tenantId,
      },
      include: { stops: true },
    });
  }

  async addBusStop(tenantId: string, routeId: string, dto: any) {
    const route = await this.prisma.busRoute.findFirst({ where: { id: routeId, tenantId } });
    if (!route) throw new NotFoundException('Route not found');

    return this.prisma.busStop.create({
      data: {
        routeId,
        stopName: dto.stopName,
        sequenceOrder: dto.sequenceOrder ? Number(dto.sequenceOrder) : 1,
        pickupTime: dto.pickupTime || '07:45 AM',
        dropTime: dto.dropTime || '02:45 PM',
        lat: dto.lat ? Number(dto.lat) : 18.5204,
        lng: dto.lng ? Number(dto.lng) : 73.8567,
      },
    });
  }

  async deleteBusStop(tenantId: string, stopId: string) {
    const stop = await this.prisma.busStop.findFirst({
      where: { id: stopId, route: { tenantId } },
    });
    if (!stop) throw new NotFoundException('Bus stop not found');

    return this.prisma.busStop.delete({ where: { id: stopId } });
  }

  // -------------------------------------------------------------
  // SCHOOL ADMIN: STUDENT BUS ASSIGNMENT
  // -------------------------------------------------------------
  async getStudentAssignments(tenantId: string) {
    const students = await this.prisma.studentProfile.findMany({
      where: { tenantId },
      select: {
        id: true,
        rollNo: true,
        user: { select: { name: true, phone: true } },
        classSection: {
          select: {
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        busId: true,
        bus: { select: { id: true, busNumber: true, registrationNo: true } },
        busStopId: true,
        busStop: { select: { id: true, stopName: true, pickupTime: true, dropTime: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    return students;
  }

  async assignStudentBus(tenantId: string, dto: { studentId: string; busId: string | null; busStopId: string | null }) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.studentProfile.update({
      where: { id: dto.studentId },
      data: {
        busId: dto.busId || null,
        busStopId: dto.busStopId || null,
      },
      include: { bus: true, busStop: true },
    });
  }

  // -------------------------------------------------------------
  // SCHOOL ADMIN: LIVE FLEET DASHBOARD & STATS
  // -------------------------------------------------------------
  async getAdminDashboard(tenantId: string) {
    await this.detectAndMarkOfflineBuses(tenantId);
    const totalBuses = await this.prisma.bus.count({ where: { tenantId } });
    const activeBuses = await this.prisma.bus.count({ where: { tenantId, status: 'ACTIVE' } });
    const busesRunning = await this.prisma.bus.count({
      where: { tenantId, dutyStatus: { in: ['STARTING_ROUTE', 'EN_ROUTE', 'REACHED_STOP'] } },
    });
    const driversOnDuty = await this.prisma.bus.count({
      where: { tenantId, dutyStatus: { not: 'OFF_DUTY' } },
    });
    const offlineDrivers = totalBuses - driversOnDuty;

    const thirtySecsAgo = new Date(Date.now() - 30 * 1000);
    const gpsNotUpdating = await this.prisma.bus.count({
      where: {
        tenantId,
        dutyStatus: { not: 'OFF_DUTY' },
        OR: [
          { lastGpsUpdate: null },
          { lastGpsUpdate: { lt: thirtySecsAgo } },
        ],
      },
    });

    const studentsAssigned = await this.prisma.studentProfile.count({
      where: { tenantId, busId: { not: null } },
    });

    const routesRunning = await this.prisma.busRoute.count({
      where: { tenantId, buses: { some: { dutyStatus: { not: 'OFF_DUTY' } } } },
    });

    const buses = await this.prisma.bus.findMany({
      where: { tenantId },
      include: {
        driver: {
          include: { user: { select: { name: true, phone: true } } },
        },
        route: {
          include: { stops: { orderBy: { sequenceOrder: 'asc' } } },
        },
        students: { select: { id: true } },
      },
    });

    return {
      kpis: {
        totalBuses,
        activeBuses,
        busesRunning,
        driversOnDuty,
        offlineDrivers,
        gpsNotUpdating,
        studentsAssigned,
        routesRunning,
        delayedBuses: 0,
      },
      buses,
    };
  }

  // -------------------------------------------------------------
  // DRIVER PORTAL: MOBILE GPS & DUTY CONTROLLER
  // -------------------------------------------------------------
  async getDriverAssignedBus(userId: string, tenantId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        OR: [
          { userId },
          { user: { id: userId } },
        ],
      },
      include: { user: true },
    });
    if (!staff) throw new NotFoundException('Driver staff profile not found');

    const bus = await this.prisma.bus.findFirst({
      where: { driverId: staff.id, tenantId },
      include: {
        route: {
          include: { stops: { orderBy: { sequenceOrder: 'asc' } } },
        },
        students: {
          select: {
            id: true,
            rollNo: true,
            user: { select: { name: true, phone: true } },
            busStop: { select: { stopName: true, pickupTime: true } },
          },
        },
      },
    });

    if (!bus) {
      return {
        driver: staff,
        bus: null,
        validations: {
          hasAssignedBus: false,
          hasAssignedRoute: false,
          isBusActive: false,
          isTripCompletedToday: false,
          canStartTrip: false,
          validationError: 'No bus is assigned to your driver account.',
        },
      };
    }

    const hasAssignedRoute = Boolean(bus.routeId && bus.route);
    const isBusActive = bus.status === 'ACTIVE';

    // Check if today's trip is already completed
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const completedTripToday = await this.prisma.busTrip.findFirst({
      where: {
        busId: bus.id,
        tenantId,
        status: 'COMPLETED',
        endTime: { gte: startOfToday },
      },
    });
    const isTripCompletedToday = Boolean(completedTripToday && bus.dutyStatus === 'TRIP_COMPLETED');

    let validationError: string | null = null;
    if (!hasAssignedRoute) {
      validationError = 'Assigned bus does not have a route configured.';
    } else if (!isBusActive) {
      validationError = `Assigned bus status is ${bus.status}. It must be ACTIVE to start a trip.`;
    } else if (isTripCompletedToday) {
      validationError = 'Today\'s trip has already been completed for this bus.';
    }

    const canStartTrip = hasAssignedRoute && isBusActive && !isTripCompletedToday;

    return {
      driver: staff,
      bus,
      validations: {
        hasAssignedBus: true,
        hasAssignedRoute,
        isBusActive,
        isTripCompletedToday,
        canStartTrip,
        validationError,
      },
    };
  }

  async updateDriverDuty(userId: string, tenantId: string, dutyStatus: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        OR: [{ userId }, { user: { id: userId } }],
      },
    });
    if (!staff) throw new NotFoundException('Driver profile not found');

    const bus = await this.prisma.bus.findFirst({ where: { driverId: staff.id, tenantId } });
    if (!bus) throw new NotFoundException('No bus assigned to driver');

    let stdStatus = dutyStatus;
    if (dutyStatus === 'STARTING_ROUTE' || dutyStatus === 'EN_ROUTE' || dutyStatus === 'ON_ROUTE') {
      stdStatus = 'ON_ROUTE';
    } else if (dutyStatus === 'SCHOOL_REACHED' || dutyStatus === 'REACHED_STOP' || dutyStatus === 'NEAR_SCHOOL') {
      stdStatus = 'NEAR_SCHOOL';
    } else if (dutyStatus === 'ROUTE_COMPLETED' || dutyStatus === 'TRIP_COMPLETED') {
      stdStatus = 'TRIP_COMPLETED';
    } else if (dutyStatus === 'OFF_DUTY' || dutyStatus === 'OFFLINE') {
      stdStatus = 'OFFLINE';
    } else if (dutyStatus === 'PAUSED') {
      stdStatus = 'PAUSED';
    }

    const updatedBus = await this.prisma.bus.update({
      where: { id: bus.id },
      data: { dutyStatus: stdStatus },
    });

    // Handle BusTrip record management
    if (stdStatus === 'ON_ROUTE') {
      await this.prisma.busTrip.create({
        data: {
          busId: bus.id,
          driverId: staff.id,
          routeId: bus.routeId,
          tripType: 'PICKUP',
          status: 'IN_PROGRESS',
          tenantId,
        },
      }).catch(err => console.error('Failed to create trip:', err));

      await this.notifyParentsForBus(bus.id, tenantId, '🚌 Bus Route Started', `Bus ${bus.busNumber} has started its trip.`);
    } else if (stdStatus === 'NEAR_SCHOOL') {
      await this.notifyParentsForBus(bus.id, tenantId, '🏫 Bus Approaching School', `Bus ${bus.busNumber} is approaching school.`);
    } else if (stdStatus === 'TRIP_COMPLETED' || stdStatus === 'OFFLINE') {
      await this.prisma.busTrip.updateMany({
        where: { busId: bus.id, tenantId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', endTime: new Date() },
      }).catch(err => console.error('Failed to close trips:', err));

      if (stdStatus === 'TRIP_COMPLETED') {
        await this.notifyParentsForBus(bus.id, tenantId, '🏁 Trip Completed', `Bus ${bus.busNumber} trip has completed safely.`);
      }
    }

    return updatedBus;
  }

  async processDriverGps(
    userId: string,
    tenantId: string,
    gpsData: {
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      batteryLevel?: number;
      dutyStatus?: string;
    },
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        OR: [{ userId }, { user: { id: userId } }],
      },
    });
    if (!staff) throw new NotFoundException('Driver profile not found');

    const bus = await this.prisma.bus.findFirst({
      where: { driverId: staff.id, tenantId },
      include: { route: { include: { stops: { orderBy: { sequenceOrder: 'asc' } } } } },
    });
    if (!bus) throw new NotFoundException('No assigned bus found for this driver');

    // GPS Accuracy Filtering: Ignore readings with accuracy > 500 meters to prevent erratic jumps
    if (gpsData.accuracy !== undefined && gpsData.accuracy > 500) {
      console.warn(`[GPS Filtering] High uncertainty ping (${gpsData.accuracy}m > 500m). Skipping location update.`);
      return bus;
    }

    const now = new Date();
    const currentDuty = gpsData.dutyStatus || bus.dutyStatus || 'ON_ROUTE';

    console.log(`[Backend processDriverGps] Updating Bus ID=${bus.id} (${bus.busNumber}) with lat=${gpsData.lat}, lng=${gpsData.lng}, speed=${gpsData.speed || 0}km/h, dutyStatus=${currentDuty}, timestamp=${now.toISOString()}`);

    const updatedBus = await this.prisma.bus.update({
      where: { id: bus.id },
      data: {
        currentLat: gpsData.lat,
        currentLng: gpsData.lng,
        currentSpeed: gpsData.speed || 0,
        currentHeading: gpsData.heading || 0,
        batteryLevel: gpsData.batteryLevel !== undefined ? gpsData.batteryLevel : bus.batteryLevel,
        lastGpsUpdate: now,
        dutyStatus: currentDuty,
      },
    });

    // Log GPS data point
    await this.prisma.busGpsLog.create({
      data: {
        busId: bus.id,
        driverId: staff.id,
        latitude: gpsData.lat,
        longitude: gpsData.lng,
        speed: gpsData.speed || 0,
        heading: gpsData.heading || 0,
        dutyStatus: currentDuty,
        batteryLevel: gpsData.batteryLevel || null,
        recordedAt: now,
        tenantId,
      },
    }).catch(err => console.error('GPS Log Error:', err));

    // Geofencing Proximity Notification & Auto Trip Completion Check
    if (bus.route?.stops && bus.route.stops.length > 0) {
      const stops = bus.route.stops;
      for (const stop of stops) {
        if (stop.lat && stop.lng) {
          const distKm = getHaversineDistanceKm(gpsData.lat, gpsData.lng, stop.lat, stop.lng);

          // 500m Proximity check for pickup stops
          if (distKm <= 0.5) {
            console.log(`[Geofence] Bus ${bus.busNumber} is within 500m of stop ${stop.stopName}`);
            const stopStudents = await this.prisma.studentProfile.findMany({
              where: { busStopId: stop.id, tenantId },
              include: { parentProfile: { select: { userId: true } } },
            });
            for (const stud of stopStudents) {
              if (stud.parentProfile?.userId) {
                await this.prisma.notification.create({
                  data: {
                    recipientId: stud.parentProfile.userId,
                    title: '🚏 Bus Approaching Stop',
                    message: `Bus ${bus.busNumber} is approaching ${stop.stopName} (~500m away).`,
                    type: 'IN_APP',
                  },
                }).catch(() => {});
              }
            }
          }
        }
      }

      // Auto-detect when bus reaches the final stop / school (within 100m of last stop)
      const lastStop = stops[stops.length - 1];
      if (lastStop && lastStop.lat && lastStop.lng) {
        const distToFinalKm = getHaversineDistanceKm(gpsData.lat, gpsData.lng, lastStop.lat, lastStop.lng);
        if (distToFinalKm <= 0.1 && currentDuty === 'ON_ROUTE') {
          // Auto update status to NEAR_SCHOOL
          await this.prisma.bus.update({
            where: { id: bus.id },
            data: { dutyStatus: 'NEAR_SCHOOL' },
          });
          await this.notifyParentsForBus(bus.id, tenantId, '🏫 Bus Reached Destination', `Bus ${bus.busNumber} has arrived at ${lastStop.stopName}.`);
        }
      }
    }

    return updatedBus;
  }

  // Helper function to dispatch notifications to parents of assigned students
  private async notifyParentsForBus(busId: string, tenantId: string, title: string, message: string) {
    const students = await this.prisma.studentProfile.findMany({
      where: { busId, tenantId },
      include: { parentProfile: { select: { userId: true } } },
    });
    for (const stud of students) {
      if (stud.parentProfile?.userId) {
        await this.prisma.notification.create({
          data: {
            recipientId: stud.parentProfile.userId,
            title,
            message,
            type: 'IN_APP',
          },
        }).catch(() => {});
      }
    }
  }

  // -------------------------------------------------------------
  // PARENT PORTAL: LIVE TRANSPORT TRACKER
  // -------------------------------------------------------------
  async getParentStudentTransport(studentId: string, parentUserId: string, tenantId: string) {
    await this.detectAndMarkOfflineBuses(tenantId);
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, tenantId },
      include: {
        user: { select: { name: true } },
        bus: {
          include: {
            driver: {
              include: {
                user: { select: { name: true, phone: true, avatarUrl: true } },
              },
            },
            route: {
              include: { stops: { orderBy: { sequenceOrder: 'asc' } } },
            },
          },
        },
        busStop: true,
      },
    });

    if (!student) throw new NotFoundException('Student not found');
    if (!student.bus) {
      return {
        hasBusAssigned: false,
        message: 'No bus assigned for this student.',
      };
    }

    const bus = student.bus;
    const isOnline = bus.lastGpsUpdate
      ? (Date.now() - new Date(bus.lastGpsUpdate).getTime()) < 180000 && bus.dutyStatus !== 'OFFLINE' && bus.dutyStatus !== 'OFF_DUTY'
      : (bus.dutyStatus === 'ON_ROUTE' || bus.dutyStatus === 'NEAR_SCHOOL');

    // Calculate dynamic ETA & Next Stop if bus has current lat/lng
    let etaMinutes = 8;
    let distanceKm = 2.5;
    let currentStop = 'Starting Depot';
    let nextStop = student.busStop?.stopName || 'School Main Gate';

    if (bus.currentLat && bus.currentLng && bus.route?.stops && bus.route.stops.length > 0) {
      // Find nearest stop and target stop
      let targetStop = student.busStop || bus.route.stops[0];
      if (targetStop.lat && targetStop.lng) {
        distanceKm = Number(getHaversineDistanceKm(bus.currentLat, bus.currentLng, targetStop.lat, targetStop.lng).toFixed(1));
        const speedKmh = bus.currentSpeed && bus.currentSpeed > 5 ? bus.currentSpeed : 30;
        etaMinutes = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
      }
      nextStop = targetStop.stopName;
    }

    return {
      hasBusAssigned: true,
      studentName: student.user?.name || 'Student',
      bus: {
        id: bus.id,
        busNumber: bus.busNumber,
        registrationNo: bus.registrationNo,
        vehicleModel: bus.vehicleModel,
        capacity: bus.capacity,
        pickupTime: bus.pickupTime,
        dropTime: bus.dropTime,
        dutyStatus: bus.dutyStatus,
        isOnline,
        currentLat: bus.currentLat || 18.5204,
        currentLng: bus.currentLng || 73.8567,
        currentSpeed: bus.currentSpeed || 0,
        currentHeading: bus.currentHeading || 0,
        lastGpsUpdate: bus.lastGpsUpdate,
      },
      driver: bus.driver ? {
        name: bus.driver.user?.name || 'Primary Driver',
        phone: bus.driver.user?.phone || bus.driver.whatsappNumber || 'N/A',
        licenseNumber: bus.driver.licenseNumber || 'Verified License',
        avatarUrl: bus.driver.user?.avatarUrl || null,
      } : null,
      route: bus.route ? {
        id: bus.route.id,
        routeName: bus.route.routeName,
        stops: bus.route.stops,
      } : null,
      assignedStop: student.busStop,
      telemetry: {
        etaMinutes,
        distanceKm,
        currentStop,
        nextStop,
      },
    };
  }

  // -------------------------------------------------------------
  // TRIP HISTORY & REPORTS
  // -------------------------------------------------------------
  async getTripHistory(tenantId: string) {
    return this.prisma.busTrip.findMany({
      where: { tenantId },
      include: {
        bus: { select: { busNumber: true, registrationNo: true } },
        driver: { include: { user: { select: { name: true } } } },
        route: { select: { routeName: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });
  }

  private async detectAndMarkOfflineBuses(tenantId: string) {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    
    // Find buses that are not OFFLINE / OFF_DUTY but haven't sent a GPS ping in > 60 seconds
    const staleBuses = await this.prisma.bus.findMany({
      where: {
        tenantId,
        dutyStatus: { notIn: ['OFFLINE', 'OFF_DUTY'] },
        OR: [
          { lastGpsUpdate: null },
          { lastGpsUpdate: { lt: sixtySecondsAgo } },
        ],
      },
    });

    if (staleBuses.length > 0) {
      console.log(`[Offline Detector] Marking ${staleBuses.length} stale buses as OFFLINE`);
      await this.prisma.bus.updateMany({
        where: { id: { in: staleBuses.map(b => b.id) } },
        data: { dutyStatus: 'OFFLINE' },
      });
      
      // Close their active trips as well
      await this.prisma.busTrip.updateMany({
        where: {
          busId: { in: staleBuses.map(b => b.id) },
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
        },
      });
    }
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransportService } from './transport.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/transport-live',
})
@Injectable()
export class TransportTrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TransportTrackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly transportService: TransportService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET') || 'edutrack-super-secret-key-change-in-production-19823612';
      const payload = this.jwtService.verify(token, { secret });
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        client.disconnect();
        return;
      }

      // Attach user info to socket
      (client as any).user = user;
      this.logger.log(`Client connected: ${client.id} (User: ${user.id})`);
    } catch (err) {
      this.logger.warn(`Invalid connection attempt: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Driver sends GPS updates
   */
  @SubscribeMessage('driverGpsUpdate')
  async handleDriverGpsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      busId: string;
      tripId: string;
      latitude: number;
      longitude: number;
      speed: number;
      heading: number;
    }
  ) {
    const user = (client as any).user;
    if (!user) return;

    // Verify driver is assigned to this bus trip (or is a teacher/driver role)
    // For simplicity, we just check role DRIVER or TEACHER or SUPER_ADMIN
    if (!['DRIVER', 'TEACHER', 'SUPER_ADMIN'].includes(user.role)) return;

    // Log the GPS in DB and calculate next stop ETA / distance
    const processedUpdate = await this.transportService.processDriverGps(
      user.id,
      user.tenantId,
      {
        ...data,
        lat: data.latitude,
        lng: data.longitude,
      }
    );

    // Broadcast to everyone in the bus room (parents, admins)
    this.server.to(`bus_${data.busId}`).emit('busLocationUpdate', processedUpdate);
    
    // Broadcast to master admin room
    this.server.to('admin_tracking').emit('adminBusLocationUpdate', processedUpdate);
  }

  /**
   * Parent joins a bus room to track
   */
  @SubscribeMessage('joinBusRoom')
  async handleJoinBusRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { busId: string }
  ) {
    const user = (client as any).user;
    if (!user) return;

    if (user.role === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: user.id },
        include: { students: { select: { busId: true } } },
      });
      const hasChildOnBus = parentProfile?.students.some(child => child.busId === data.busId);
      if (!hasChildOnBus) {
        this.logger.warn(`Parent ${user.id} attempted to join unauthorized bus room ${data.busId}`);
        return;
      }
    }

    const room = `bus_${data.busId}`;
    client.join(room);
    this.logger.log(`User ${user.id} joined room ${room}`);
    
    // Fetch last known location from the service
    const busInfo = await this.prisma.bus.findUnique({
      where: { id: data.busId },
      select: { currentLat: true, currentLng: true, currentSpeed: true, currentHeading: true, dutyStatus: true, lastGpsUpdate: true }
    });
    if (busInfo) {
      client.emit('busLocationUpdate', busInfo);
    }
  }

  @SubscribeMessage('leaveBusRoom')
  handleLeaveBusRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { busId: string }
  ) {
    client.leave(`bus_${data.busId}`);
  }

  /**
   * Admin joins master tracking room
   */
  @SubscribeMessage('joinAdminTracking')
  handleJoinAdminTracking(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'SCHOOL_ADMIN') return;
    
    client.join('admin_tracking');
  }
}

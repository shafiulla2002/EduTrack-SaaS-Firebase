import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string, namespace: string = '/transport-live') {
    if (!this.socket) {
      this.socket = io(`${SOCKET_URL}${namespace}`, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log(`Connected to Socket.IO ${namespace}:`, this.socket?.id);
      });

      this.socket.on('disconnect', () => {
        console.log(`Disconnected from Socket.IO ${namespace}`);
      });
      
      this.socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
      });
    }
    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();

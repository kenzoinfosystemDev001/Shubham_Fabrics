import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'floorboard',
})
export class FloorBoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FloorBoardGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Shop-floor client connected: ${client.id}`);
    client.emit('connected', { timestamp: new Date().toISOString(), status: 'online' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Shop-floor client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  broadcastFloorUpdate(event: string, payload: any) {
    if (this.server) {
      this.server.emit(event, payload);
    }
  }
}
